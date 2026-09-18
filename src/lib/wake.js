/**
 * Wake-word gating for continuous listening.
 *
 * Continuous recognition transcribes every sound in the room, so acting on
 * every utterance is unusable. A command counts only once the wake word is
 * heard, and the wake word itself is stripped before the text reaches the model.
 *
 * Several spellings are listed per language because speech recognition
 * transliterates a name inconsistently — especially across scripts.
 */
export const WAKE_WORDS = [
  'jarvis',
  'jervis',
  'jarvix',
  'javis',
  "ג'ארוויס",
  'ג׳ארוויס',
  'גארוויס',
  "ג'רוויס",
  'ג׳רוויס',
  'גרוויס',
]

// Punctuation and whitespace that may trail the wake word, in either script.
const LEADING_JUNK = /^[\s,.:;!?—–-]+/

/**
 * @returns {{matched: boolean, command: string}}
 *   matched — the wake word appeared
 *   command — everything after it, trimmed; empty when the user only said the name
 */
export function extractCommand(transcript, wakeWords = WAKE_WORDS) {
  if (typeof transcript !== 'string' || !transcript.trim()) {
    return { matched: false, command: '' }
  }

  const haystack = transcript.toLowerCase()

  // Prefer the EARLIEST match, so "jarvis, what is jarvis" keeps the full question.
  let best = -1
  let bestLength = 0
  for (const word of wakeWords) {
    const at = haystack.indexOf(word.toLowerCase())
    if (at !== -1 && (best === -1 || at < best)) {
      best = at
      bestLength = word.length
    }
  }

  if (best === -1) return { matched: false, command: '' }

  const command = transcript.slice(best + bestLength).replace(LEADING_JUNK, '').trim()
  return { matched: true, command }
}
