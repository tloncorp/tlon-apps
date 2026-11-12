import test from 'node:test'
import assert from 'node:assert/strict'
import { migrateProviderState } from './provider-state-migration.mjs'

test('version 1 migration preserves history, session, receipts, and uncertainty', () => {
  const old = { version: 1, identity: 'identity', sessionId: 'session', history: [{ role: 'user', content: 'task' }], pending: { hash: 'hash', at: 'date' }, receipts: [{ hash: 'first', text: 'answer' }] }
  const current = migrateProviderState(old)
  assert.deepEqual(current, { ...old, version: 2, receipts: [{ hash: 'first', text: 'answer', calls: [] }] })
  assert.equal(old.version, 1)
  assert.equal(migrateProviderState(current), current)
})
