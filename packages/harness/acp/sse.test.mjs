import test from 'node:test'
import assert from 'node:assert/strict'
import { readSSE } from './sse.mjs'

async function decode(text, size = 1, options) {
  const bytes = Buffer.from(text)
  async function* chunks() { for (let i = 0; i < bytes.length; i += size) yield bytes.subarray(i, i + size) }
  return Array.fromAsync(readSSE(chunks(), options))
}

test('SSE decodes UTF-8 and CRLF split across bytes, multiline data and comments', async () => {
  assert.deepEqual(await decode(': alive\r\nid: 12\r\nevent: harness\r\ndata: 🐛\r\ndata: second\r\n\r\n'), [{ id: '12', event: 'harness', data: '🐛\nsecond' }])
})
test('SSE supports CR-only lines and does not dispatch a partial frame', async () => {
  assert.deepEqual(await decode('data: one\r\rdata: incomplete'), [{ id: '', event: 'message', data: 'one' }])
})
test('SSE rejects oversized frames and invalid UTF-8', async () => {
  await assert.rejects(decode('data: abcdef\n\n', 2, { maxBytes: 6 }), /size limit/)
  async function* malformed() { yield Buffer.from([0xc3, 0x28]) }
  await assert.rejects(Array.fromAsync(readSSE(malformed())))
})
