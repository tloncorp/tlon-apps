// Owner recovery, fenced receipts, and durable export. Uses a local deterministic
// model fixture and never sends a publication to an external destination.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { text as readText } from 'node:stream/consumers'
import { mkdtemp, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const run = promisify(execFile)
const client = new Client()
const hand = new HandClient(client, { hand: `ops-${randomUUID()}`, worker: 'worker-before-crash' })
const other = new HandClient(client, { hand: hand.hand, worker: 'replacement-worker' })
const directory = await mkdtemp(join(tmpdir(), 'harness-hand-archive-'))
let sessionId, binding, retired = false
const auxiliaryBindings = []
let modelCalls = 0
const model = createServer(async (req, res) => {
  modelCalls++
  const { messages } = JSON.parse(await readText(req))
  const asked = messages.findLast((m) => m.role === 'user').content.includes('Reply with exactly RECOVERY_OK.')
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: asked ? 'RECOVERY_OK' : 'UNEXPECTED_PROMPT' } }],
    usage: { prompt_tokens: 1, completion_tokens: 1 } }))
})

async function until(fn, label) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const result = await fn()
    if (result) return result
    await sleep(150)
  }
  throw new Error(`Timed out: ${label}`)
}

try {
  await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve))
  await client.start()
  ;({ sessionId } = await client.call('session/new', { name: `hand-ops-${randomUUID().slice(0, 8)}` }))
  const config = await client.call('harness/session/config', { sessionId })
  await client.call('harness/session/configure', { sessionId, config: { ...config,
    url: `http://127.0.0.1:${model.address().port}/completions`, model: 'hand-operations-fixture', key: '', headers: [], tools: [] } })
  ;({ binding } = await hand.register({ address: 'test-only:never-published', sessionId, actors: ['alice'] }))
  const { binding: sentinel } = await hand.register({ address: 'test-only:retention-sentinel', sessionId, actors: ['alice'], enabled: false })
  auxiliaryBindings.push(sentinel)
  const start = Date.now()
  const { inputId } = await hand.observe(binding, { event: 'message-1', actor: 'alice', text: 'Reply with exactly RECOVERY_OK.' })
  const admissionMs = Date.now() - start
  const [effect] = await until(async () => {
    const records = await hand.outbox()
    return records.length && records
  }, 'model reply')
  assert.equal(effect.effectId, inputId)
  assert.equal(effect.kind, 'reply')
  assert.match(effect.text, /RECOVERY_OK/)
  const snapshot = await client.call('harness/session/snapshot', { sessionId })
  const first = await hand.claim(inputId)
  assert.equal(first.attempt, 1)
  assert.equal((await hand.health()).claims.some((claim) => claim.effectId === inputId), true)

  const uncertain = await hand.resolve(inputId, { attempt: 1, status: 'uncertain', reason: 'Worker died after attempting external send' })
  assert.equal(uncertain.attempt, 2)
  await assert.rejects(hand.receipt(inputId, 'delivered', 'stale', 1), /Stale delivery attempt/)
  await assert.rejects(hand.retry(inputId), /uncertain/)
  const failed = await hand.resolve(inputId, { attempt: 2, status: 'failed', reason: 'Test destination confirms nothing was sent' })
  assert.equal(failed.attempt, 3)
  await hand.retry(inputId)
  const claimed = await other.claim(inputId)
  assert.equal(claimed.attempt, 4)
  await assert.rejects(hand.receipt(inputId, 'delivered', 'stale', 1), /Stale delivery attempt/)
  const abandoned = await other.resolve(inputId, { attempt: 4, status: 'abandoned', reason: 'Test-only publication; intentionally not sent' })
  assert.equal(abandoned.status, 'abandoned')
  assert.equal(abandoned.resolutions.length, 3)
  await assert.rejects(other.receipt(inputId, 'delivered', 'late', 4), /Stale delivery attempt/)
  assert.deepEqual(await hand.outbox(), [])
  assert.deepEqual(await client.call('harness/session/snapshot', { sessionId }), snapshot, 'delivery recovery never changes the session')

  await hand.enable(binding, false)
  const descriptor = await hand.archive(binding)
  const archivePath = join(directory, 'binding.jsonl')
  const { stdout } = await run(process.execPath, ['tests-js/archive-hand.mjs', binding, archivePath], { env: process.env, timeout: 90_000 })
  retired = true
  const lines = (await readFile(archivePath, 'utf8')).trim().split('\n').map(JSON.parse)
  assert.equal(lines[0].digest, descriptor.digest)
  assert.equal(lines[1].publication.status, 'abandoned')
  assert.deepEqual(lines.at(-1), { complete: true, digest: descriptor.digest, records: 1 })
  assert.equal((await stat(archivePath)).mode & 0o777, 0o600)
  await hand.retire(binding, descriptor.digest, archivePath) // Lost ack is safe.
  assert.equal((await hand.status(sentinel)).binding, sentinel, 'retirement preserves other bindings')
  const { binding: next } = await hand.register({ address: 'test-only:next-epoch', sessionId, actors: ['alice'], enabled: false })
  auxiliaryBindings.push(next)
  assert.notEqual(next, binding, 'retirement must not reset the identity allocator')
  assert.notEqual(next, sentinel)
  await assert.rejects(hand.status(binding), /Unknown binding/)
  await assert.rejects(hand.observe(binding, { event: 'message-1', actor: 'alice', text: 'Reply with exactly RECOVERY_OK.' }), /Unknown binding/)
  assert.deepEqual(await client.call('harness/session/snapshot', { sessionId }), snapshot, 'archival retains session memory')
  assert.equal(modelCalls, 1, 'delivery recovery, archival and retired replay never call a model')

  console.log(JSON.stringify({ ok: true, admissionMs, archive: archivePath,
    checks: ['owner recovery', 'stale receipt fencing', 'no uncertain retry', 'explicit abandonment', 'session unchanged', 'fsynced archive', 'idempotent retirement', 'other bindings retained', 'identity allocator retained', 'retired replay rejection'] }, null, 2))
  console.log(stdout.trim())
} finally {
  if (retired && sessionId) {
    for (const id of auxiliaryBindings) await hand.remove(id)
    await client.call('session/delete', { sessionId })
  }
  else if (sessionId) console.error(`Retained test session ${sessionId} and binding ${binding}; inspect before cleanup.`)
  await client.close()
  model.closeAllConnections(); await new Promise((resolve) => model.close(resolve))
}
