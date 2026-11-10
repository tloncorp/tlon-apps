import assert from 'node:assert/strict'
import test from 'node:test'
import { webcrypto } from 'node:crypto'
import { clientId } from './client-id.mjs'

test('client IDs use randomUUID when available', () => {
  const crypto = { randomUUID() { assert.equal(this, crypto); return 'test-uuid' } }
  assert.equal(clientId(crypto), 'test-uuid')
})

test('LAN HTTP clients generate distinct IDs without randomUUID', () => {
  const crypto = { getRandomValues: (bytes) => webcrypto.getRandomValues(bytes) }
  const ids = Array.from({ length: 100 }, () => clientId(crypto))
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[0-9a-f]{32}$/)
})

test('clients without Web Crypto still get distinct correlation IDs in the same millisecond', (t) => {
  t.mock.method(Date, 'now', () => 123456789)
  t.mock.method(Math, 'random', () => 0.5)
  const ids = Array.from({ length: 100 }, () => clientId(null))
  assert.equal(new Set(ids).size, ids.length)
  for (const id of ids) assert.match(id, /^[a-z0-9-]+$/)
})
