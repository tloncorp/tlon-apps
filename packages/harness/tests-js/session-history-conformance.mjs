// Native paging, immutable event cursors and read-only inspection; no inference.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'

const client = new Client(), sessionId = `history-${randomUUID().slice(0, 8)}`
let created = false
try {
  await client.start()
  await client.call('session/new', { name: sessionId }); created = true
  for (let n = 0; n < 48; n++) await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: '/memory' }] })
  const recent = await client.call('harness/session/snapshot', { sessionId })
  assert.equal(recent.entries.length, 40)
  assert.ok(recent.before > 0)
  let entries = recent.entries, before = recent.before
  // Appending new work must not shift a cursor into an older page.
  await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: '/memory' }] })
  while (before != null) {
    const page = await client.call('harness/session/history', { sessionId, before })
    assert.ok(page.entries.length <= 40)
    assert.ok(page.entries.every((row) => row.eventCount < before))
    assert.ok(page.before == null || page.before < before)
    entries = [...page.entries, ...entries]; before = page.before
  }
  assert.equal(entries.length, 96)
  assert.equal(new Set(entries.map((row) => row.id)).size, 96)
  assert.ok(entries.every((row, n) => n === 0 || entries[n - 1].eventCount < row.eventCount))
  const fresh = await client.call('harness/session/snapshot', { sessionId })
  await assert.rejects(client.call('session/load', { sessionId }), /single-load budget/)
  await client.call('session/resume', { sessionId })
  const same = await client.call('harness/session/snapshot', { sessionId, since: fresh.revision })
  assert.equal(same.entries, null)
  assert.equal(same.revision, fresh.revision)
  const empty = await client.call('harness/session/history', { sessionId, before: 0 })
  assert.deepEqual(empty.entries, [])
  assert.equal(empty.before, null)
  console.log('PASS recent window, complete paged history, append-stable cursors, no duplicate rows and unchanged polling')
} finally {
  if (created) await client.call('session/delete', { sessionId })
  await client.close()
}
