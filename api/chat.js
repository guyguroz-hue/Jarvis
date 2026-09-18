/**
 * SiliconFlow proxy (Vercel Edge Function).
 *
 * WHY THIS EXISTS: the API key must never reach the browser. Anything named
 * VITE_* is inlined into the public bundle and readable by any visitor. The key
 * is read here, server-side, from SILICONFLOW_API_KEY (no VITE_ prefix).
 *
 * The upstream response body is piped straight through, so the client receives
 * tokens as they are generated and no SSE parsing happens on the server.
 */
export const config = { runtime: 'edge' }

const BASE_URL = process.env.SILICONFLOW_BASE_URL || 'https://api.siliconflow.cn/v1'
/**
 * Pick a model with SILICONFLOW_MODEL. The default is a starting point, not a
 * recommendation — browse the catalogue and choose for yourself.
 *
 * For a spoken assistant, latency beats capability: a huge reasoning model
 * gives a better answer several seconds too late. Prefer a "Flash" variant or
 * a small model; the task is two sentences of conversation.
 */
const MODEL = process.env.SILICONFLOW_MODEL || 'zai-org/GLM-5.3-Flash'

// Abuse limits. This endpoint is unauthenticated, so anyone who finds the URL
// can spend your credit — these caps bound the damage per request.
const MAX_MESSAGES = 21
const MAX_CHARS = 6000
const MAX_TOKENS = 400

const SYSTEM_PROMPT = `You are JARVIS, the assistant behind a real-time augmented-reality heads-up display.

Your replies are spoken aloud through a speech synthesiser, so:
- Keep answers to 1-3 short sentences. Never use lists, markdown, code blocks or emoji.
- Write numbers and units the way they should be read out loud.
- Reply in the same language the user spoke to you in.

You are calm, precise and dry. You do not pad answers with pleasantries.
If you do not know something, say so plainly in one sentence.`

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  })

export default async function handler(request) {
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const key = process.env.SILICONFLOW_API_KEY
  if (!key) {
    return json(
      { error: 'SILICONFLOW_API_KEY is not set. Add it in the Vercel project settings.' },
      500
    )
  }

  // Weak but free: reject requests that did not originate from this deployment.
  // It stops casual scraping of the endpoint, not a determined caller, since
  // Origin is trivially forged outside a browser.
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (origin && host && !origin.includes(host)) {
    return json({ error: 'Cross-origin requests are not accepted.' }, 403)
  }

  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ error: 'Malformed request body.' }, 400)
  }

  const incoming = Array.isArray(payload?.messages) ? payload.messages : null
  if (!incoming?.length) return json({ error: 'messages[] is required.' }, 400)

  // Keep only well-formed turns, drop any client-supplied system prompt, and
  // retain the most recent exchanges.
  const history = incoming
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-MAX_MESSAGES)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }))

  if (!history.length) return json({ error: 'No usable messages.' }, 400)

  const total = history.reduce((n, m) => n + m.content.length, 0)
  if (total > MAX_CHARS) return json({ error: 'Conversation too long.' }, 413)

  const base = {
    model: payload.model || MODEL,
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
    stream: true,
    temperature: 0.6,
    max_tokens: MAX_TOKENS,
  }

  const send = (body) =>
    fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })

  let upstream
  try {
    /**
     * Ask hybrid reasoning models to skip their chain of thought. Thinking adds
     * seconds of silence before the first word, which is intolerable when the
     * reply is spoken aloud.
     *
     * Not every model accepts the parameter, and some reject the whole request
     * for an unknown field — so a 400 is retried once without it rather than
     * failing outright.
     */
    upstream = await send({ ...base, enable_thinking: false })
    if (upstream.status === 400) {
      upstream = await send(base)
    }
  } catch (err) {
    return json({ error: `Upstream unreachable: ${err.message}` }, 502)
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => '')
    // Surface the status but never echo the key or full upstream headers.
    // 401 is almost always a key/region mismatch — say so, since the raw
    // upstream message is rarely helpful.
    const hint =
      upstream.status === 401
        ? 'Check SILICONFLOW_API_KEY, and that SILICONFLOW_BASE_URL matches the region you registered in (.com keys do not work against .cn).'
        : upstream.status === 404
          ? `Model "${base.model}" was not found. Set SILICONFLOW_MODEL to one from the catalogue.`
          : undefined

    return json(
      {
        error: hint ?? `Upstream error ${upstream.status}`,
        detail: detail.slice(0, 300),
      },
      upstream.status === 401 ? 500 : 502
    )
  }

  return new Response(upstream.body, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
    },
  })
}
