import { useCallback, useEffect, useRef, useState } from 'react'
import { streamChat } from '../lib/ai'
import { extractCommand } from '../lib/wake'
import { useSpeech } from './useSpeech'

const MAX_HISTORY = 12 // 6 exchanges — the proxy trims again server-side

/**
 * Ties speech, the model and the HUD together.
 *
 * Continuous listening is gated on a wake word; the mic button bypasses it for
 * a direct question. Replies stream in, then are spoken — and speaking closes
 * the microphone, so JARVIS never transcribes itself.
 */
export function useAssistant({ lang = 'he-IL', log } = {}) {
  const [status, setStatus] = useState('idle') // idle | thinking | speaking | error
  const [reply, setReply] = useState('')
  const [query, setQuery] = useState('')
  const [error, setError] = useState(null)
  const [armed, setArmed] = useState(false) // continuous listening engaged

  const historyRef = useRef([])
  const abortRef = useRef(null)
  const busyRef = useRef(false)
  const logRef = useRef(log)
  const speakRef = useRef(null)
  const canSpeakRef = useRef(false)

  useEffect(() => {
    logRef.current = log
  }, [log])

  /** Send a question and stream the answer. */
  const ask = useCallback(async (text) => {
    const question = text?.trim()
    if (!question || busyRef.current) return

    busyRef.current = true
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setQuery(question)
    setReply('')
    setError(null)
    setStatus('thinking')
    logRef.current?.('user', question)

    const messages = [...historyRef.current, { role: 'user', content: question }]

    try {
      let streamed = ''
      const full = await streamChat(messages, {
        signal: controller.signal,
        onToken: (token) => {
          streamed += token
          setReply(streamed)
        },
      })

      const answer = (full || streamed).trim()
      if (!answer) throw new Error('Empty response from neural link.')

      historyRef.current = [
        ...messages,
        { role: 'assistant', content: answer },
      ].slice(-MAX_HISTORY)

      logRef.current?.('ai', answer)
      // Only enter the speaking state if synthesis can actually run — otherwise
      // nothing would ever fire onend and the status would stick there.
      if (canSpeakRef.current) {
        setStatus('speaking')
        speakRef.current?.(answer)
      } else {
        setStatus('idle')
      }
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setStatus('error')
      logRef.current?.('err', err.message)
    } finally {
      busyRef.current = false
    }
  }, [])

  /** Every final transcript passes through the wake-word gate. */
  const handleFinal = useCallback(
    (transcript) => {
      const { matched, command } = extractCommand(transcript)
      if (!matched) return

      if (!command) {
        // Name only — acknowledge instead of querying the model.
        const ack = lang.startsWith('he') ? 'כן?' : 'Yes?'
        setQuery(transcript)
        setReply(ack)
        logRef.current?.('ai', ack)
        if (canSpeakRef.current) {
          setStatus('speaking')
          speakRef.current?.(ack)
        }
        return
      }

      ask(command)
    },
    [ask, lang]
  )

  const speech = useSpeech({ lang, onFinal: handleFinal })

  // useSpeech is created after ask(), so hand it over through a ref.
  useEffect(() => {
    speakRef.current = speech.speak
    canSpeakRef.current = speech.supported.synthesis
  }, [speech.speak, speech.supported.synthesis])

  // Mirror the voice state into the assistant's status.
  useEffect(() => {
    if (speech.speaking) setStatus('speaking')
    else setStatus((s) => (s === 'speaking' ? 'idle' : s))
  }, [speech.speaking])

  const arm = useCallback(() => {
    setArmed(true)
    // Must happen inside the tap handler — see unlockSpeech().
    speech.unlockSpeech()
    speech.startListening()
    logRef.current?.('sys', 'Voice interface armed — say "Jarvis"')
  }, [speech])

  const disarm = useCallback(() => {
    setArmed(false)
    speech.stopListening()
    speech.stopSpeaking()
    logRef.current?.('sys', 'Voice interface disarmed')
  }, [speech])

  const cancel = useCallback(() => {
    abortRef.current?.abort()
    speech.stopSpeaking()
    busyRef.current = false
    setStatus('idle')
  }, [speech])

  const reset = useCallback(() => {
    historyRef.current = []
    setReply('')
    setQuery('')
    setError(null)
    logRef.current?.('sys', 'Conversation context cleared')
  }, [])

  useEffect(() => () => abortRef.current?.abort(), [])

  return {
    status,
    query,
    reply,
    error: error ?? speech.error,
    armed,
    listening: speech.listening,
    speaking: speech.speaking,
    interim: speech.interim,
    supported: speech.supported,
    ask,
    arm,
    disarm,
    cancel,
    reset,
  }
}
