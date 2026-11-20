// Real ship dispatcher, local ACP subprocess, and stdio MCP facade. The only
// ship writes are an isolated fixture conversation and its own cleanup.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { createProvider } from '../acp/local-agent-provider.mjs'

const expected = process.env.SOAK_EXPECT_SHIP
assert.ok(expected?.startsWith('~'), 'Set SOAK_EXPECT_SHIP to the local test ship')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a loopback ship')
const identity = await fetch(`${base}/~/name`, { headers: { cookie }, redirect: 'error', signal: AbortSignal.timeout(5000) })
assert.ok(identity.ok)
assert.equal((await identity.text()).trim().replace(/^"|"$/g, ''), expected)

const root = await mkdtemp(join(tmpdir(), 'harness-acp-conformance-'))
const trace = join(root, 'trace.jsonl')
const token = randomUUID() + randomUUID()
const client = new Client()
const sessionId = `local-acp-${randomUUID()}`
let provider, started = false, created = false
try {
  provider = await createProvider({ repo: root, state: join(root, 'state.json'), token, port: 0,
    command: [process.execPath, fileURLToPath(new URL('../acp/fixtures/agent.mjs', import.meta.url)), trace],
    harnessTools: ['current_time', 'calculate'], timeoutMs: 60000, toolTimeoutMs: 15000,
  })
  await client.start(); started = true
  await client.call('session/new', { name: sessionId }); created = true
  await client.call('harness/session/configure', { sessionId, config: {
    url: `${provider.url}/v1/chat/completions`, model: 'local-acp', key: '',
    system: 'Read-only local ACP tool relay fixture.', headers: [{ name: 'Authorization', value: `Bearer ${token}` }],
    'max-context': 80000, tools: [],
  } })
  const result = await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'relay-twice' }] })
  assert.equal(result.stopReason, 'end_turn')
  const snapshot = await client.call('harness/session/snapshot', { sessionId })
  const receipts = snapshot.entries.filter(entry => entry.role === 'tool')
  assert.deepEqual(receipts.map(entry => entry.name), ['current_time', 'calculate'])
  const journal = JSON.parse(await readFile(join(root, 'state.json'), 'utf8'))
  assert.equal(journal.pending, null)
  assert.equal(journal.receipts.filter(receipt => receipt.calls.length).length, 2)
  const results = journal.history.filter(message => message.role === 'tool')
  assert.equal(results.length, 2)
  assert.ok(results.every(message => !message.content.startsWith('error:')))
  assert.match(results[0].content, /UTC|unix|iso/i)
  assert.match(results[1].content, /2/)
  const frames = (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
  assert.equal(frames.filter(frame => frame.method === 'session/prompt').length, 1)
  console.log(JSON.stringify({ ok: true, nativeTools: receipts.map(entry => entry.name), acpPrompts: 1, paidInference: false }))
} finally {
  try { if (created) await client.call('session/delete', { sessionId }) } finally {
    try { if (started) await client.close() } finally {
      await provider?.close()
      await rm(root, { recursive: true, force: true })
    }
  }
}
