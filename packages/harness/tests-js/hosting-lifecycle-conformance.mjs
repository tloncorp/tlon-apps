// Seed/check durable recovery evidence around an operator-controlled upgrade,
// restart on a disposable test ship. No pier copies, provider calls or real destination.
// LIFECYCLE_ID must be a unique fixture name reused for each check.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const sessionId = process.env.LIFECYCLE_ID
assert.match(sessionId || '', /^hosting-life-[a-z0-9-]{4,40}$/)
const mode = process.argv[2]
assert.ok(['seed', 'check'].includes(mode))
const client = new Client(), hand = new HandClient(client, { hand: sessionId, worker: 'fixture-worker-before-restart' })
try {
  await client.start()
  if (mode === 'seed') {
    await client.call('session/new', { name: sessionId })
    await client.call('harness/session/configure', { sessionId, config: {
      url: 'http://127.0.0.1:1/never-dispatch', model: 'lifecycle-fixture', key: '', headers: [],
      system: 'Durable lifecycle fixture; no inference', 'max-context': 80000, tools: ['skills', 'curl'],
    } })
    await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: `/remember ${sessionId} KEEP_ACROSS_RESTART_AND_RESTORE` }] })
    await client.call('harness/skill/save', { name: sessionId, desc: 'Lifecycle fixture', body: 'Retain these literal instructions.', revision: '' })
    await hand.bind(sessionId, { address: 'fixture-only:never-publish', sessionId, actors: ['fixture-actor'] })
    await hand.action('notify', { binding: sessionId, event: 'pending', actor: 'fixture-actor', text: 'Pending literal notification' })
    const { inputId } = await hand.action('notify', { binding: sessionId, event: 'claimed', actor: 'fixture-actor', text: 'Claimed literal notification' })
    await hand.claim(inputId)
    await hand.enable(sessionId, false)
  }
  const snapshot = await client.call('harness/session/snapshot', { sessionId })
  const config = await client.call('harness/session/config', { sessionId })
  const skill = await client.call('harness/skill', { name: sessionId })
  const status = await hand.status(sessionId)
  const records = await hand.records(sessionId, null, 16)
  assert.equal(config.model, 'lifecycle-fixture')
  assert.deepEqual(config.tools, ['skills', 'curl'])
  const memoryResponse = await fetch(`${base}/~/scry/harness/memory/${sessionId}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(memoryResponse.ok)
  const memory = await memoryResponse.json()
  assert.equal(memory.text, 'KEEP_ACROSS_RESTART_AND_RESTORE')
  assert.equal(skill.body, 'Retain these literal instructions.')
  assert.equal(status.enabled, false, 'external effects remain fenced')
  assert.equal(status.observations.length, 2)
  assert.ok(status.observations.every((item) => item.phase === 'completed'))
  const publications = records.records.map((record) => record.publication)
  assert.deepEqual(publications.map((publication) => publication.status).sort(), ['claimed', 'pending'])
  assert.equal(publications.find((publication) => publication.status === 'claimed').attempt, 1)
  const defaults = await client.call('harness/defaults')
  const credentials = await client.call('harness/status', { provider: 'openrouter' })
  const digest = createHash('sha256').update(JSON.stringify({ snapshot, memory, config, skill, status, records, defaults, credentials })).digest('hex')
  console.log(JSON.stringify({ ok: true, mode, sessionId, digest, credentialPresent: credentials['has-key'],
    checks: ['conversation config and grants', 'shared fact', 'shared skill', 'disabled binding', 'accepted literal work', 'pending and claimed publication evidence'] }))
} finally { await client.close() }
