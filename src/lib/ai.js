/**
 * Client side of the AI link.
 *
 * Talks only to our own /api/chat proxy — never to SiliconFlow directly, so no
 * credential is ever present in the browser.
 */

const OPEN_TAG = '<think>'
const CLOSE_TAG = '</think>'

/** Longest suffix of `text` that is also a prefix of `tag`. */
function tailPartial(text, tag) {
  const max = Math.min(tag.length - 1, text.length)
  for (let n = max; n > 0; n--) {
    if (text.endsWith(tag.slice(0, n))) return n
  }
  return 0
}

/**
 * Strip <think>…</think> reasoning from a token stream.
 *
 * Nearly every current model is a hybrid reasoning model. When its chain of
 * thought lands in `content` rather than a separate field, it would be
 * displayed on the HUD and READ ALOUD — JARVIS narrating its own deliberation.
 *
 * Tags arrive split across network chunks, so a partial tag at the tail is held
 * back rather than emitted, and released once the next chunk disambiguates it.
 */
export function createThinkStripper() {
  let inside = false
  let pending = ''

  return function push(chunk) {
    let text = pending + chunk
    pending = ''
    let out = ''

    while (text) {
      if (!inside) {
        const at = text.indexOf(OPEN_TAG)
        if (at !== -1) {
          out += text.slice(0, at)
          text = text.slice(at + OPEN_TAG.length)
          inside = true
          continue
        }
        const hold = tailPartial(text, OPEN_TAG)
        out += text.slice(0, text.length - hold)
        pending = hold ? text.slice(text.length - hold) : ''
        text = ''
      } else {
        const at = text.indexOf(CLOSE_TAG)
        if (at !== -1) {
          text = text.slice(at + CLOSE_TAG.length)
          inside = false
          continue
        }
        pending = text.slice(text.length - tailPartial(text, CLOSE_TAG))
        text = ''
      }
    }

    return out
  }
}

/** Parse one SSE frame's `data:` payload. Returns null for keep-alives. */
function parseFrame(frame) {
  const line = frame.split('\n').find((l) => l.startsWith('data:'))
  if (!line) return null
  const data = line.slice(5).trim()
  if (!data || data === '[DONE]') return data === '[DONE]' ? '[DONE]' : null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

/**
 * Stream a completion. Calls onToken(text) as fragments arrive and resolves
 * with the full reply.
 */
export async function streamChat(messages, { signal, onToken } = {}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
    signal,
  })

  if (!res.ok) {
    let message = `Neural link error ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* non-JSON error body — keep the status text */
    }
    throw new Error(message)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const strip = createThinkStripper()
  let buffer = ''
  let full = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by a blank line. Keep the trailing partial.
    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      const parsed = parseFrame(frame)
      if (!parsed) continue
      if (parsed === '[DONE]') return full

      // Only `content` is read. Models that expose their chain of thought as a
      // separate `reasoning_content` field are therefore ignored outright; the
      // stripper handles the ones that inline it as <think> tags instead.
      const delta = parsed.choices?.[0]?.delta?.content
      if (delta) {
        const visible = strip(delta)
        if (visible) {
          full += visible
          onToken?.(visible)
        }
      }
    }
  }

  return full.trimStart()
}
