import test from 'node:test'
import assert from 'node:assert/strict'
import { streamChat } from './ai.js'

/** Build a fake fetch that emits the given SSE chunks. */
function mockFetch(chunks, { ok = true, status = 200, body } = {}) {
  return async () => ({
    ok,
    status,
    json: async () => body ?? {},
    body: {
      getReader() {
        let i = 0
        return {
          read: async () =>
            i < chunks.length
              ? { done: false, value: new TextEncoder().encode(chunks[i++]) }
              : { done: true },
        }
      },
    },
  })
}

const frame = (text) =>
  `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`

test('assembles tokens from well-formed frames', async () => {
  globalThis.fetch = mockFetch([frame('Hel'), frame('lo'), 'data: [DONE]\n\n'])
  const seen = []
  const out = await streamChat([{ role: 'user', content: 'hi' }], {
    onToken: (t) => seen.push(t),
  })
  assert.equal(out, 'Hello')
  assert.deepEqual(seen, ['Hel', 'lo'])
})

test('handles a frame split across two network chunks', async () => {
  // The boundary falls mid-JSON — the parser must buffer, not drop it.
  const whole = frame('spatial')
  globalThis.fetch = mockFetch([whole.slice(0, 12), whole.slice(12), 'data: [DONE]\n\n'])
  const out = await streamChat([{ role: 'user', content: 'hi' }])
  assert.equal(out, 'spatial')
})

test('ignores keep-alives and unparseable frames', async () => {
  globalThis.fetch = mockFetch([': ping\n\n', 'data: {oops\n\n', frame('ok'), 'data: [DONE]\n\n'])
  const out = await streamChat([{ role: 'user', content: 'hi' }])
  assert.equal(out, 'ok')
})

test('surfaces the server error message', async () => {
  globalThis.fetch = mockFetch([], { ok: false, status: 500, body: { error: 'KEY missing' } })
  await assert.rejects(() => streamChat([{ role: 'user', content: 'hi' }]), /KEY missing/)
})

test('falls back to a status message when the error body is not JSON', async () => {
  globalThis.fetch = async () => ({
    ok: false,
    status: 502,
    json: async () => {
      throw new Error('not json')
    },
  })
  await assert.rejects(() => streamChat([{ role: 'user', content: 'hi' }]), /502/)
})

test('terminates when the stream ends without a DONE marker', async () => {
  globalThis.fetch = mockFetch([frame('truncated')])
  const out = await streamChat([{ role: 'user', content: 'hi' }])
  assert.equal(out, 'truncated')
})
