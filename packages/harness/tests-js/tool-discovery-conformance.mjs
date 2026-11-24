// Exercise shared tool execution through ACP with a deterministic provider.
// Does not change the MCP registry, credentials, defaults, or hand permissions.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), grants = new GrantedTurns(client), sessions = [], observed = []
let tool = 'list_mcp_servers', expectedGrant = true
const server = createServer(async (req, res) => {
  const raw = await readText(req)
  const body = JSON.parse(raw)
  observed.push(body)
  const reply = body.messages.find((message) => message.role === 'tool')
  const names = (body.tools || []).map((entry) => entry.function.name)
  assert.equal(names.includes(tool), expectedGrant)
  const message = reply ? { role: 'assistant', content: 'TOOLS_OK' }
    : { role: 'assistant', content: '', tool_calls: [{ id: 'fixture-call', type: 'function',
      function: { name: tool, arguments: tool === 'web_search' ? '{"query":"Urbit"}' : '{}' } }] }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: reply ? 'stop' : 'tool_calls', message }],
    usage: { prompt_tokens: 30, completion_tokens: 10 } }))
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  const brave = await client.call('harness/status', { provider: 'brave' })
  const configured = await client.call('harness/mcp/servers')
  for (const which of ['current_time', 'list_mcp_servers', 'web_search']) for (const granted of [true, false]) {
    // Search with a real credential is opt-in; the default test checks that a
    // missing key gives actionable feedback without making a network request.
    if (which === 'web_search' && brave['has-key'] && granted) continue
    tool = which; expectedGrant = which === 'current_time' || granted
    const { sessionId } = await client.call('session/new', { name: `tools-${randomUUID().slice(0, 8)}` })
    sessions.push(sessionId)
    await client.call('harness/session/configure', { sessionId, config: {
      url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture',
      key: '', headers: [], system: 'Use the available tools.', 'max-context': 80000,
      tools: granted ? [which === 'list_mcp_servers' ? { mcp: 'discovery-fixture' } : 'web'] : [],
    } })
    await grants.prompt(sessionId, 'Run the tool.')
    const result = observed.at(-1).messages.find((message) => message.role === 'tool').content
    if (which === 'current_time') {
      const time = JSON.parse(result)
      assert.equal(time.timezone, 'UTC')
      assert.ok(Math.abs(Date.now() - Date.parse(time.utc)) < 15000)
      assert.equal(Date.parse(time.utc), time.unixSeconds * 1000)
      assert.equal(new Date(time.utc).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' }), time.weekday)
    }
    else if (!granted) assert.match(result, /not granted for this session/)
    else if (which === 'web_search') assert.match(result, /Add a Brave Search API key/)
    else {
      const servers = JSON.parse(result)
      assert.deepEqual(servers.map((s) => s.id).sort(), configured.filter((s) => s.enabled && s.id === 'discovery-fixture').map((s) => s.id).sort())
      assert.ok(servers.every((s) => Object.keys(s).sort().join(',') === 'id,name'))
    }
  }
  console.log(JSON.stringify({ ok: true, clockWithoutGrants: true, mcpDiscovery: true, permissionEnforcement: true, searchMissingKey: !brave['has-key'] }))
} finally {
  await grants.close().catch(() => {})
  for (const sessionId of sessions) await client.call('session/delete', { sessionId }).catch(() => {})
  await client.close()
  await new Promise((resolve) => server.close(resolve))
}
