// Local hosted HTTP conformance. Temporarily edits default instructions and
// creates one uniquely named shared skill; cleanup uses the same revision fences.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client, base, cookie } from './lib/ship-client.mjs'

assert.equal(new URL(base).hostname, '127.0.0.1', 'Use a local test ship')
const client = new Client()
assert.equal(process.env.HOSTED_CONTENT_TEST_SHIP, client.ship, 'Explicitly name the local test ship in HOSTED_CONTENT_TEST_SHIP')
const name = `hosted-content-${randomUUID()}`
let soulBefore, soulSaved, skillSaved

async function hosted(endpoint, body, expected = 200) {
  const response = await fetch(`${base}/spider/harness/json/hosted-${endpoint}/json.json`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(30_000),
  })
  assert.equal(response.status, 200, `${endpoint}: HTTP response`)
  const result = await response.json()
  assert.equal(result.status, expected, `${endpoint}: hosted response`)
  return result.body
}

try {
  await client.start()
  const capabilities = await hosted('capabilities', {})
  assert.equal(capabilities.soul, true)
  assert.equal(capabilities.skills, true)
  for (const endpoint of ['soul', 'skills']) {
    const anonymous = await fetch(`${base}/spider/harness/json/hosted-${endpoint}/json.json`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
      redirect: 'manual', signal: AbortSignal.timeout(10_000),
    })
    // Spider's authenticated route can surface the auth assertion as HTTP 500.
    assert.ok([302, 303, 401, 403, 500].includes(anonymous.status), `${endpoint}: anonymous request is denied (${anonymous.status})`)
    await anonymous.body?.cancel()
  }
  const defaults = await client.call('harness/defaults')
  soulBefore = await hosted('soul', {})
  assert.equal(soulBefore.body, defaults.system)
  soulSaved = await hosted('soul', { revision: soulBefore.revision, body: `${soulBefore.body}\n` })
  assert.equal(soulSaved.body, `${soulBefore.body}\n`)
  assert.notEqual(soulSaved.revision, soulBefore.revision)
  assert.deepEqual(await hosted('soul', {}), soulSaved)
  assert.deepEqual(await client.call('harness/defaults'), { ...defaults, system: soulSaved.body })
  await hosted('soul', { revision: soulBefore.revision, body: 'Must not save' }, 409)
  await hosted('soul', { body: 'Must not save' }, 409)
  await hosted('soul', { revision: soulSaved.revision, body: true }, 400)
  await hosted('soul', { revision: soulSaved.revision, body: 'Must not save', tools: [] }, 400)
  const restored = await hosted('soul', { revision: soulSaved.revision, body: soulBefore.body })
  assert.deepEqual(restored, soulBefore)
  soulSaved = undefined
  assert.deepEqual(await client.call('harness/defaults'), defaults)

  const catalog = await hosted('skills', {})
  assert.deepEqual(catalog, await client.call('harness/skills'))
  assert.ok(!catalog.some(skill => skill.name === name))
  await hosted('skills', { name }, 404)
  const input = { name, desc: 'Hosted content conformance', body: 'Read this instruction.\n'.repeat(1500), revision: '' }
  const created = await hosted('skills', input)
  skillSaved = created
  assert.equal(created.body, input.body)
  assert.deepEqual(await client.call('harness/skill', { name }), created)
  assert.deepEqual(await hosted('skills', { name }), created)
  await hosted('skills', input, 409)
  await hosted('skills', { name, desc: '', body: 'Must not save' }, 409)
  await hosted('skills', { ...created, body: 'x'.repeat(65537) }, 400)
  await hosted('skills', { ...created, body: '' }, 400)
  await hosted('skills', { ...created, desc: true }, 400)
  await hosted('skills', { ...created, delete: true }, 400)
  const saved = await hosted('skills', { ...created, body: 'Revised instructions.' })
  skillSaved = saved
  assert.equal(saved.body, 'Revised instructions.')
  assert.notEqual(saved.revision, created.revision)
  assert.deepEqual(await client.call('harness/skill', { name }), saved)
  await assert.rejects(client.call('harness/skill/save', { ...created, body: 'Stale native write' }), /changed/i)
  assert.deepEqual((await hosted('skills', {})).filter(skill => skill.name !== name), catalog)
  await client.call('harness/skill/delete', { name, revision: saved.revision })
  skillSaved = undefined
  assert.deepEqual(await hosted('skills', {}), catalog)
  console.log('Hosted soul and skills: authenticated reads, writes, shared revisions, input validation, and cleanup PASS')
} finally {
  try {
    if (soulSaved) await hosted('soul', { revision: soulSaved.revision, body: soulBefore.body })
    if (skillSaved) await client.call('harness/skill/delete', { name, revision: skillSaved.revision })
  } finally { await client.close() }
}
