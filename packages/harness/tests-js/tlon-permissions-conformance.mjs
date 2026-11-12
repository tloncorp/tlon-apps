import assert from 'node:assert/strict'
import { Client, base, cookie } from './lib/ship-client.mjs'

// This changes conversation permissions on the local test ship, then restores them.
assert.equal(new URL(base).hostname, '127.0.0.1', 'Use the local test ship')
const client = new Client()
assert.equal(client.ship, 'nec', 'This test is scoped to ~nec')
await client.start()
let restore
try {
  const initial = await client.call('harness/tlon/permissions')
  const { owner, ...body } = initial
  const addition = ['~bud', '~bus', '~zod', '~nus'].find(ship => ship !== owner && !body.allowedShips.includes(ship))
  assert.ok(addition && body.allowedShips.length < 64, 'The fixture needs one free allowlist slot')
  const allowedShips = [...body.allowedShips, addition]
  const saved = await client.call('harness/tlon/permissions', { ...body, allowedShips })
  restore = { ...body, revision: saved.revision }
  assert.deepEqual(new Set(saved.allowedShips), new Set(allowedShips))
  await assert.rejects(client.call('harness/tlon/permissions', body), /changed/i)
  const status = await client.call('harness/tlon')
  await assert.rejects(client.call('harness/tlon/configure', {
    ...status.policy, expectedRevision: initial.revision,
  }), /changed/i)
  const response = await fetch(`${base}/spider/harness/json/hosted-permissions/json.json`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(20_000),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.status, 200)
  assert.deepEqual(result.body, saved)
  console.log('Native and hosted permissions share revision-checked state: PASS')
} finally {
  try { if (restore) await client.call('harness/tlon/permissions', restore) }
  finally { await client.close() }
}
