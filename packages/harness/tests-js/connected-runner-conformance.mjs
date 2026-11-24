// Two outbound runners against a loopback test ship. Deterministic agents,
// isolated conversations, native clock/math tools, no paid model calls.
import assert from 'node:assert/strict'
import { randomUUID, randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { createRunner } from '../acp/connected-runner.mjs'

const expected = process.env.SOAK_EXPECT_SHIP
assert.ok(expected?.startsWith('~'), 'Set SOAK_EXPECT_SHIP to the local test ship')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a loopback ship')
const identity = await fetch(`${base}/~/name`, { headers: { cookie }, redirect: 'error', signal: AbortSignal.timeout(5000) })
assert.ok(identity.ok)
assert.equal((await identity.text()).trim().replace(/^"|"$/g, ''), expected)

const root = await mkdtemp(join(tmpdir(), 'harness-runner-conformance-'))
const client = new Client(), created = [], registered = [], runners = []
try {
  await client.start()
  for (const label of ['Claude fixture', 'Codex fixture']) {
    const id = `fixture-${randomUUID()}`, key = `hrr_${randomBytes(32).toString('hex')}`
    await client.call('harness/runners', { action: 'create', id, label, key }); registered.push(id)
    const trace = join(root, `${id}.trace`)
    const runner = await createRunner({ ship: base, runner: id, key, repo: root, state: join(root, `${id}.json`),
      command: [process.execPath, fileURLToPath(new URL('../acp/fixtures/agent.mjs', import.meta.url)), trace],
      harnessTools: ['current_time', 'calculate'], log: message => { if (process.env.RUNNER_DEBUG) console.error(`${label}: ${message}`) },
    })
    const running = runner.run(); void running.catch(() => {})
    runners.push({ runner, running, trace, id })
    await client.call('session/new', { name: id }); created.push(id)
    await client.call('harness/session/configure', { sessionId: id, config: {
      url: `connected://${id}`, model: '', key: '', headers: [], tools: [], 'max-context': 80000,
      system: 'Read-only connected runner fixture.',
    } })
  }
  await Promise.all(runners.map(async ({ id, trace }) => {
    const result = await client.call('session/prompt', { sessionId: id, prompt: [{ type: 'text', text: 'relay-twice' }] })
    assert.equal(result.stopReason, 'end_turn')
    const snapshot = await client.call('harness/session/snapshot', { sessionId: id })
    assert.deepEqual(snapshot.entries.filter(entry => entry.role === 'tool').map(entry => entry.name), ['current_time', 'calculate'], JSON.stringify(snapshot))
    const frames = (await readFile(trace, 'utf8')).trim().split('\n').map(JSON.parse)
    assert.equal(frames.filter(frame => frame.method === 'session/prompt').length, 1)
  }))
  const listed = await client.call('harness/runners', { action: 'list' })
  assert.ok(registered.every(id => listed.some(row => row.id === id && row.status === 'online')))
  assert.ok(listed.every(row => !Object.hasOwn(row, 'key')))
  console.log(JSON.stringify({ ok: true, concurrentRunners: 2, isolatedConversations: 2, nativeTools: ['current_time', 'calculate'], paidInference: false }))
} finally {
  for (const id of created) await client.call('session/delete', { sessionId: id }).catch(() => {})
  for (const id of registered) await client.call('harness/runners', { action: 'revoke', id }).catch(() => {})
  for (const { runner } of runners) await runner.close()
  await client.close()
  await rm(root, { recursive: true, force: true })
}
