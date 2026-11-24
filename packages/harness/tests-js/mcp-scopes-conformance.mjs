// Local deterministic provider/MCP fixtures. Only temporary sessions and server
// registrations are changed; the original registry is restored in finally.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), grants = new GrantedTurns(client), sessions = [], failures = []
const prefix = `scope-${randomUUID()}`, a = `${prefix}-a`, b = `${prefix}-b`, c = `${prefix}-c`
let original, registry, fixtures, url, sid, config, mode, mcpCalls = [], receipts = [], childReceipts = []
const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const configure = (servers) => client.call('harness/mcp/configure', { servers })
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw)
    if (req.url.startsWith('/mcp/')) {
      mcpCalls.push({ url: req.url, method: body.method, name: body.params?.name })
      assert.equal(req.url, '/mcp/a', 'ungranted servers must never receive requests')
      if (mode === 'revoke') await client.call('harness/session/configure', { sessionId: sid, config: { ...config, tools: [] } })
      if (mode === 'disable') await configure(registry.map((s) => s.id === a ? { ...s, enabled: false } : s))
      if (mode === 'remove') await configure(registry.filter((s) => s.id !== a))
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text: 'MCP_FIXTURE_SECRET' }] } }))
      return
    }
    receipts = body.messages.filter((m) => m.role === 'tool')
    const child = body.messages.some((m) => m.role === 'system' && m.content.includes('You are a subagent'))
    if (child) {
      assert.ok(!body.tools.some((t) => ['run_subagent', 'cron_add'].includes(t.function.name)))
      if (receipts.length) childReceipts = receipts
    }
    let calls = []
    if (!receipts.length) {
      assert.equal(body.tools.filter((t) => t.function.name === 'list_mcp_servers').length, 1)
      if (mode === 'child') {
        calls = child ? [tool('discover', 'list_mcp_servers', {}), tool('b-list', 'list_mcp_tools', { server: b })]
          : [tool('child', 'run_subagent', { prompt: 'Exercise the MCP grants.' })]
      } else if (mode === 'scope') {
        await configure([...registry, fixtures[2]])
        calls = [tool('discover', 'list_mcp_servers', {}), tool('a-list', 'list_mcp_tools', { server: a }),
          tool('a-call', 'call_mcp_tool', { server: a, name: 'arbitrary_server_tool', arguments: '{}' }),
          tool('b-list', 'list_mcp_tools', { server: b }), tool('c-call', 'call_mcp_tool', { server: c, name: 'mutate', arguments: '{}' })]
      } else calls = [tool('delayed', 'call_mcp_tool', { server: a, name: 'read', arguments: '{}' })]
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
      role: 'assistant', content: calls.length ? '' : 'SCOPES_OK', ...(calls.length ? { tool_calls: calls } : {}),
    } }], usage: { prompt_tokens: 20, completion_tokens: 10 } }))
  } catch (error) { failures.push(error); res.writeHead(500); res.end('fixture assertion failed') }
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
  await client.start()
  original = await client.call('harness/mcp/servers')
  fixtures = [a, b, c].map((id, i) => ({ id, name: `Fixture ${i}`, url: `${url}/mcp/${['a', 'b', 'c'][i]}`, headers: [], enabled: true }))
  registry = [...original, ...fixtures.slice(0, 2)]
  for (const next of ['scope', 'revoke', 'disable', 'remove', 'child']) {
    mode = next; mcpCalls = []; receipts = []
    await configure(registry)
    ;({ sessionId: sid } = await client.call('session/new', { name: `${prefix}-${mode}` }))
    sessions.push(sid)
    config = { url: `${url}/completions`, model: 'fixture', key: '', headers: [], system: 'Fixture', 'max-context': 80000, tools: [{ mcp: a }] }
    if (mode === 'child') { config.tools.push('subagents'); sessions.push(`${sid}--1--child`) }
    await client.call('harness/session/configure', { sessionId: sid, config })
    await grants.prompt(sid, 'Run the fixture.')
    if (mode === 'scope') {
      assert.deepEqual(JSON.parse(receipts.find((r) => r.tool_call_id === 'discover').content).map((s) => s.id), [a])
      for (const id of ['b-list', 'c-call']) assert.match(receipts.find((r) => r.tool_call_id === id).content, /not granted/)
      assert.equal(mcpCalls.length, 2)
      assert.equal(mcpCalls[1].name, 'arbitrary_server_tool')
    } else if (mode === 'child') {
      assert.equal(mcpCalls.length, 0)
      assert.deepEqual(JSON.parse(childReceipts.find((r) => r.tool_call_id === 'discover').content).map((s) => s.id), [a])
      assert.match(childReceipts.find((r) => r.tool_call_id === 'b-list').content, /not granted/)
      const childConfig = await client.call('harness/session/config', { sessionId: `${sid}--1--child` })
      // The hand parent's %cron is copied into the saved config; the child's turn
      // is checked above to drop it, since delegation never gets scheduling.
      assert.deepEqual(childConfig.tools.filter((grant) => grant !== 'cron'), [{ mcp: a }])
    } else {
      assert.equal(mcpCalls.length, 1)
      assert.match(receipts[0].content, /rejected: MCP/)
      assert.ok(!receipts[0].content.includes('MCP_FIXTURE_SECRET'))
    }
  }
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ ok: true, perServer: true, futureServersDenied: true, arbitraryToolsOnGrantedServer: true, revocationFenced: true, disabledAndRemovedFenced: true, childInheritance: true }))
} finally {
  await grants.close().catch(() => {})
  if (original) await configure(original)
  for (const sessionId of sessions) await client.call('session/delete', { sessionId }).catch(() => {})
  await client.close(); server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  if (failures.length) throw new AggregateError(failures, 'Fixture assertions failed')
}
