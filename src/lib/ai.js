/**
 * Client side of the AI link.
 *
 * Talks only to our own /api/chat proxy — never to SiliconFlow directly, so no
 * credential is ever present in the browser.
 */

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

      const delta = parsed.choices?.[0]?.delta?.content
      if (delta) {
        full += delta
        onToken?.(delta)
      }
    }
  }

  return full
}
