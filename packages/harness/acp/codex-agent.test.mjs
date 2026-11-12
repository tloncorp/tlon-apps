import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { CodexAgent } from './codex-agent.mjs'
import { validateAgentOptions } from './local-agent-provider.mjs'

test('Codex initializes, configures MCP, resumes, streams only reply text, and declines approvals', async t => {
  const root = await mkdtemp(join(tmpdir(), 'harness-codex-'))
  const trace = join(root, 'trace'), updates = []
  const agent = new CodexAgent([process.execPath, fileURLToPath(new URL('./fixtures/codex.mjs', import.meta.url)), trace], { cwd: root, onUpdate: value => updates.push(value), sandbox: 'workspace-write', model: 'fixture-model' })
  t.after(async () => { await agent.close(); await rm(root, { recursive: true, force: true }) })
  assert.equal((await agent.request('initialize', {}, 3000)).agentCapabilities.loadSession, true)
  const session = { cwd: root, mcpServers: [{ name: 'harness', command: 'node', args: ['bridge.mjs'], env: [{ name: 'BRIDGE_TOKEN', value: 'fixture' }] }] }
  assert.equal((await agent.request('session/new', session, 3000)).sessionId, 'codex-fixture')
  assert.equal((await agent.request('session/prompt', { prompt: [{ type: 'text', text: 'hello' }] }, 3000)).stopReason, 'end_turn')
  await agent.request('session/load', { ...session, sessionId: 'codex-fixture' }, 3000)
  const frames = (await readFile(trace, 'utf8')).trim().split('\n').map(JSON.parse)
  assert.equal(frames.find(frame => frame.method === 'thread/start').params.sandbox, 'workspace-write')
  assert.equal(frames.find(frame => frame.method === 'thread/start').params.approvalPolicy, 'never')
  assert.deepEqual(frames.find(frame => frame.method === 'thread/start').params.config.mcp_servers.harness, { command: 'node', args: ['bridge.mjs'], env: { BRIDGE_TOKEN: 'fixture' }, required: true })
  assert.equal(frames.find(frame => frame.method === 'thread/resume').params.threadId, 'codex-fixture')
  assert.equal(frames.find(frame => frame.id === 'approval').result.decision, 'decline')
  assert.deepEqual(updates.map(value => value.update.content.text), ['Codex reply'])
  const pending = agent.request('session/prompt', { prompt: [{ type: 'text', text: 'hang' }] }, 3000)
  const rejected = assert.rejects(pending, /interrupted/)
  for (let i = 0; i < 100 && !agent.turn?.id; i++) await delay(5)
  agent.notify('session/cancel', { sessionId: 'codex-fixture' })
  await rejected
})

test('runtime options reject unsupported combinations before accepting remote work', () => {
  const options = { command: ['codex', 'app-server'], agentType: 'codex', model: '', sandbox: 'read-only', allow: [], harnessTools: [] }
  assert.doesNotThrow(() => validateAgentOptions(options))
  assert.throws(() => validateAgentOptions({ ...options, allow: ['edit'] }), /sandbox/)
  assert.throws(() => validateAgentOptions({ ...options, agentType: 'acp', model: 'ignored' }), /Configure the model/)
  assert.throws(() => validateAgentOptions({ ...options, agentType: 'unknown' }), /Invalid local agent/)
})
