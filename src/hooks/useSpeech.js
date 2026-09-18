import { useCallback, useEffect, useRef, useState } from 'react'

const SpeechRecognitionCtor =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null

export const speechSupport = {
  recognition: Boolean(SpeechRecognitionCtor),
  synthesis: typeof window !== 'undefined' && 'speechSynthesis' in window,
}

/**
 * Web Speech API: continuous recognition plus synthesis.
 *
 * THE FEEDBACK LOOP is the thing this hook exists to prevent. If the microphone
 * stays open while speechSynthesis is talking, recognition transcribes JARVIS's
 * own voice and the assistant answers itself, forever. Recognition is therefore
 * suspended for the duration of every utterance and resumed afterwards.
 *
 * Second hazard: browsers end a recognition session on their own (silence
 * timeouts, mobile power management). "Continuous" listening is really a
 * restart loop, which must not fire when the failure is permanent — a denied
 * microphone would otherwise spin forever.
 */
export function useSpeech({ lang = 'he-IL', onFinal } = {}) {
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState(null)

  const recognitionRef = useRef(null)
  const wantListeningRef = useRef(false)
  const speakingRef = useRef(false)
  const fatalRef = useRef(false)
  const restartTimer = useRef(null)
  const langRef = useRef(lang)
  const onFinalRef = useRef(onFinal)

  useEffect(() => {
    langRef.current = lang
    if (recognitionRef.current) recognitionRef.current.lang = lang
  }, [lang])

  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  /** recognition.start() throws if a session is already running. */
  const safeStart = useCallback(() => {
    const rec = recognitionRef.current
    if (!rec || speakingRef.current || fatalRef.current) return
    try {
      rec.start()
    } catch {
      /* already started — harmless */
    }
  }, [])

  // ---- build the recognition instance once ----
  useEffect(() => {
    if (!SpeechRecognitionCtor) return

    const rec = new SpeechRecognitionCtor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = langRef.current
    recognitionRef.current = rec

    rec.onstart = () => {
      setListening(true)
      setError(null)
    }

    rec.onresult = (event) => {
      let pending = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        const text = result[0]?.transcript ?? ''
        if (result.isFinal) {
          const finalText = text.trim()
          if (finalText) onFinalRef.current?.(finalText)
        } else {
          pending += text
        }
      }
      setInterim(pending)
    }

    rec.onerror = (event) => {
      // Distinguish "nothing was said" from "you may never listen again".
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        fatalRef.current = true
        wantListeningRef.current = false
        setError('Microphone permission denied. Enable it in your browser settings.')
      } else if (event.error === 'audio-capture') {
        fatalRef.current = true
        wantListeningRef.current = false
        setError('No microphone available.')
      }
      // 'no-speech', 'aborted' and 'network' are transient — onend will restart.
    }

    rec.onend = () => {
      setListening(false)
      setInterim('')
      if (wantListeningRef.current && !speakingRef.current && !fatalRef.current) {
        restartTimer.current = setTimeout(safeStart, 250)
      }
    }

    return () => {
      wantListeningRef.current = false
      clearTimeout(restartTimer.current)
      rec.onend = null
      rec.onerror = null
      rec.onresult = null
      try {
        rec.abort()
      } catch {
        /* already stopped */
      }
      recognitionRef.current = null
    }
  }, [safeStart])

  const startListening = useCallback(() => {
    if (!SpeechRecognitionCtor) {
      setError('Speech recognition is unsupported in this browser.')
      return
    }
    fatalRef.current = false
    wantListeningRef.current = true
    safeStart()
  }, [safeStart])

  const stopListening = useCallback(() => {
    wantListeningRef.current = false
    clearTimeout(restartTimer.current)
    try {
      recognitionRef.current?.stop()
    } catch {
      /* not running */
    }
    setListening(false)
  }, [])

  // ---- synthesis ----
  const pickVoice = useCallback((code) => {
    const voices = window.speechSynthesis?.getVoices?.() ?? []
    if (!voices.length) return null
    const base = code.split('-')[0]
    return (
      voices.find((v) => v.lang === code) ||
      voices.find((v) => v.lang?.startsWith(base)) ||
      null
    )
  }, [])

  // Voices load asynchronously; touching the list early primes it.
  useEffect(() => {
    if (!speechSupport.synthesis) return
    const prime = () => window.speechSynthesis.getVoices()
    prime()
    window.speechSynthesis.addEventListener('voiceschanged', prime)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', prime)
  }, [])

  const speak = useCallback(
    (text) => {
      if (!text || !speechSupport.synthesis) return
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = langRef.current
      const voice = pickVoice(langRef.current)
      if (voice) utterance.voice = voice
      utterance.rate = 1.03
      utterance.pitch = 0.95

      const release = () => {
        speakingRef.current = false
        setSpeaking(false)
        // Resume listening only if the user still wants it.
        if (wantListeningRef.current && !fatalRef.current) {
          restartTimer.current = setTimeout(safeStart, 300)
        }
      }

      utterance.onstart = () => {
        speakingRef.current = true
        setSpeaking(true)
        // Close the mic BEFORE the voice starts, or JARVIS hears itself.
        try {
          recognitionRef.current?.stop()
        } catch {
          /* not running */
        }
      }
      utterance.onend = release
      utterance.onerror = release

      window.speechSynthesis.speak(utterance)
    },
    [pickVoice, safeStart]
  )

  /**
   * iOS gates the FIRST utterance behind a user gesture. Speaking a silent
   * utterance from inside a tap handler unlocks synthesis for the rest of the
   * session, so later replies — which are not tied to a gesture — still play.
   */
  const unlockSpeech = useCallback(() => {
    if (!speechSupport.synthesis) return
    try {
      const silent = new SpeechSynthesisUtterance('')
      silent.volume = 0
      window.speechSynthesis.speak(silent)
    } catch {
      /* best effort */
    }
  }, [])

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis?.cancel()
    speakingRef.current = false
    setSpeaking(false)
  }, [])

  // Never leave a voice talking after the component goes away.
  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  return {
    supported: speechSupport,
    listening,
    speaking,
    interim,
    error,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    unlockSpeech,
  }
}
