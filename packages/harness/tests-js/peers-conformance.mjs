// Owner-facing peer policy roundtrip against a development ship. No inference
// or remote asks; restore the exact explicit grants and serving config after.
import assert from 'node:assert/strict'
import { Client } from './lib/ship-client.mjs'

const client = new Client()
let before, changed = false
try {
  await client.start()
  before = await client.call('harness/peers')
  const ship = ['~nec', '~bud', '~zod'].find((ship) => !before.grants.some((grant) => grant.ship === ship))
  assert.ok(ship, 'Need a free fixture peer identity')
  for (const inherited of before.trusted) {
    assert.equal(inherited.budget, 0, 'Tlon trust is unlimited by default')
    assert.deepEqual(inherited.inflows, [], 'Trust does not publish shared skills')
  }
  const grant = { ship, tools: [], model: null, budget: 0, inflows: [] }
  const saved = await client.call('harness/peers/configure', { revision: before.revision, config: before.config, grants: [...before.grants, grant] })
  changed = true
  assert.deepEqual(saved.grants.find((entry) => entry.ship === ship), grant)
  assert.deepEqual((await client.call('harness/peers')).grants, saved.grants)
  await assert.rejects(client.call('harness/peers/configure', { revision: before.revision, config: before.config, grants: before.grants }), /changed/)
  for (const budget of [-1, 0.5, '100', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(client.call('harness/peers/configure', { revision: saved.revision, config: saved.config, grants: [{ ...grant, budget }] }), /valid ships|limits/)
  }
  const capped = await client.call('harness/peers/configure', { revision: saved.revision, config: saved.config, grants: saved.grants.map((entry) => entry.ship === ship ? { ...entry, budget: 12345 } : entry) })
  assert.equal(capped.grants.find((entry) => entry.ship === ship).budget, 12345)
  const defaults = await client.call('harness/defaults')
  const configured = await client.call('harness/peers/configure', { revision: capped.revision, config: { ...defaults, key: 'fixture-not-a-real-key', tools: ['code'] }, grants: capped.grants })
  assert.equal('key' in configured.config, false)
  assert.deepEqual(configured.config.tools, [])
  const inherited = await client.call('harness/peers/configure', { revision: configured.revision, config: null, grants: capped.grants })
  assert.equal(inherited.config, null)
  const limits = [...(before.limits || []).filter((entry) => entry.ship !== ship), { ship, budget: 4321 }]
  const limited = await client.call('harness/peers/configure', { revision: inherited.revision, config: null, grants: before.grants, limits })
  assert.equal(limited.limits.find((entry) => entry.ship === ship).budget, 4321)
  assert.deepEqual(limited.grants, before.grants, 'A limit does not create a standalone grant')
  console.log('PASS native peer settings: trusted defaults, roundtrip, limits, stale-write fencing, validation, serving defaults and key omission')
} finally {
  if (changed) {
    const current = await client.call('harness/peers')
    await client.call('harness/peers/configure', { revision: current.revision, config: before.config, grants: before.grants, limits: before.limits || [] })
  }
  await client.close()
}
