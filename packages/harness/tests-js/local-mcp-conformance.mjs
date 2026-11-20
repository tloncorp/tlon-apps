// Exercise the installed aggregate MCP proxy through Harness. A deterministic
// provider follows its discovery schemas and invokes the real ship-identity
// tool. EXPECT_MCP_UPSTREAM also checks a configured upstream's catalog/schema;
// it never executes that upstream's tools or changes its configuration.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { text } from 'node:stream/consumers'
import { Client, base, cookie } from './lib/ship-client.mjs'

const expected = process.env.SOAK_EXPECT_SHIP
const expectedUpstream = process.env.EXPECT_MCP_UPSTREAM
const expectedRequests = expectedUpstream ? 10 : 8
assert.ok(expected?.startsWith('~'), 'Set SOAK_EXPECT_SHIP to the local test ship')
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'Use a loopback ship')
const client = new Client()
const sessionId = `local-mcp-${randomUUID()}`
let started = false, created = false, serverId, localKey, identityTool, upstreamTool
let requests = 0, listed = false, called = false, upstreamChecked = false
const failures = []
const rpcResults = (body) => {
  const payload = body.replace(/^HTTP \d+\r?\n\r?\n/, '')
  if (payload.trim().startsWith('{')) return [JSON.parse(payload)]
  return payload.split(/\r?\n/).filter(line => line.startsWith('data:'))
    .map(line => JSON.parse(line.slice(5).trim()))
}
const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const invoke = (id, name, args = {}) => [tool(id, 'call_mcp_tool', { server: serverId, name, arguments: JSON.stringify(args) })]
const result = (receipt) => {
  assert.ok(receipt.content.startsWith('HTTP 200\n\n'), 'The proxy returns a successful HTTP response')
  const results = rpcResults(receipt.content)
  assert.equal(results.length, 1)
  assert.ok(results[0].result && !results[0].error && !results[0].result.isError, 'The MCP request succeeds')
  return results[0].result
}
const content = (receipt) => JSON.parse(result(receipt).content.find(row => row.type === 'text').text)
const provider = createServer(async (req, res) => {
  try {
    assert.equal(req.url, '/completions')
    const raw = await text(req)
    assert.ok(!raw.includes(localKey), 'The local API key never reaches the provider')
    const body = JSON.parse(raw)
    requests++
    assert.ok(requests <= expectedRequests, 'No retry loop')
    assert.ok(body.tools.some(row => row.function.name === 'list_mcp_tools'))
    const allReceipts = body.messages.filter(row => row.role === 'tool')
    const schemas = allReceipts.filter(row => row.tool_call_id.startsWith('schema-'))
    const receipts = allReceipts.filter(row => !row.tool_call_id.startsWith('schema-'))
    let calls = []
    if (!receipts.length) calls = [tool('discover', 'list_mcp_servers', {})]
    else if (receipts.length === 1) {
      const servers = JSON.parse(receipts[0].content)
      assert.deepEqual(servers.map(row => row.id), [serverId])
      assert.deepEqual(Object.keys(servers[0]).sort(), ['id', 'name'])
      calls = [tool('list', 'list_mcp_tools', { server: serverId })]
    } else if (receipts.length === 2) {
      const tools = result(receipts[1]).tools
      assert.deepEqual(tools.map(row => row.name).sort(), ['call', 'describe', 'list_upstreams', 'search'])
      assert.ok(tools.every(row => row.description && !row.inputSchema), 'Discovery returns summaries without schemas')
      if (!schemas.length) {
        calls = tools.map(row => tool(`schema-${row.name}`, 'list_mcp_tools', { server: serverId, name: row.name }))
      } else {
        assert.equal(schemas.length, tools.length)
        for (const receipt of schemas) {
          const [definition] = result(receipt).tools
          assert.equal(receipt.tool_call_id, `schema-${definition.name}`)
          assert.equal(definition.inputSchema.type, 'object')
        }
        listed = true
        calls = invoke('upstreams', 'list_upstreams')
      }
    } else if (receipts.length === 3) {
      const { upstreams } = content(receipts[2])
      assert.ok(upstreams.some(row => row.enabled), 'Enabled upstreams are visible')
      if (expectedUpstream) assert.ok(upstreams.some(row => row.id === expectedUpstream && row.enabled), 'The requested upstream is visible')
      calls = invoke('find-identity', 'search', { query: 'get-our-id' })
    } else if (receipts.length === 4) {
      identityTool = content(receipts[3]).tools.find(row => row.name.endsWith('_mcp/get-our-id'))?.name
      assert.ok(identityTool, 'Search discovers the prefixed native identity tool')
      calls = invoke('describe-identity', 'describe', { name: identityTool })
    } else if (receipts.length === 5) {
      const schema = content(receipts[4])
      assert.equal(schema.name, identityTool)
      assert.equal(schema.inputSchema.type, 'object')
      calls = invoke('identity', 'call', { name: identityTool, arguments: {} })
    } else if (receipts.length === 6) {
      assert.ok(JSON.stringify(result(receipts[5])).includes(expected), 'The native tool returns the actual ship identity through the proxy')
      called = true
      if (expectedUpstream) calls = invoke('find-upstream', 'search', { server: expectedUpstream })
    } else if (receipts.length === 7 && expectedUpstream) {
      const catalog = content(receipts[6])
      assert.ok(catalog.total > 0 && catalog.tools.length > 0, 'The requested upstream advertises real tools')
      assert.ok(catalog.tools.every(row => row.name.startsWith(`${expectedUpstream}_`)))
      upstreamTool = catalog.tools[0].name
      calls = invoke('describe-upstream', 'describe', { name: upstreamTool })
    } else {
      assert.ok(expectedUpstream && receipts.length === 8)
      const schema = content(receipts[7])
      assert.equal(schema.name, upstreamTool)
      assert.equal(schema.inputSchema.type, 'object')
      upstreamChecked = true
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
      role: 'assistant', content: calls.length ? '' : 'Local MCP verified.', ...(calls.length ? { tool_calls: calls } : {}),
    } }], usage: { prompt_tokens: 10, completion_tokens: 10 } }))
  } catch (error) {
    failures.push(error.message)
    res.writeHead(500); res.end('Local MCP fixture assertion failed')
  }
})

try {
  const response = await fetch(`${base}/~/name`, { headers: { cookie }, redirect: 'error' })
  assert.ok(response.ok)
  assert.equal((await response.text()).trim().replace(/^"|"$/g, ''), expected)
  const keyResponse = await fetch(`${base}/apps/mcp/api/client-key`, { headers: { cookie }, redirect: 'error' })
  if (keyResponse.status === 404) {
    console.error('Needs %mcp-proxy, install the %mcp desk (github.com/tloncorp/mcp): /apps/mcp/api/client-key returned HTTP 404. No local MCP checks ran.')
    process.exit(1)
  }
  assert.ok(keyResponse.ok)
  localKey = (await keyResponse.json()).clientKey
  assert.ok(localKey, 'The proxy has a client key')
  await client.start(); started = true
  const registry = await client.call('harness/mcp/servers')
  const local = registry.find(row => row.url === `urbit://${expected}/mcp-proxy`)
  assert.ok(local?.enabled, 'The automatically registered local MCP server must be enabled')
  assert.deepEqual(local.headers, [], 'No key is stored in registry headers')
  serverId = local.id
  await new Promise(resolve => provider.listen(0, '127.0.0.1', resolve))
  await client.call('session/new', { name: sessionId }); created = true
  await client.call('harness/session/configure', { sessionId, config: {
    url: `http://127.0.0.1:${provider.address().port}/completions`, model: 'local-mcp-fixture', key: '',
    system: 'Read-only local MCP fixture.', headers: [], 'max-context': 80000, tools: [{ mcp: serverId }],
  } })
  await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'Inspect the local MCP tools and read this ship’s identity.' }] })
  assert.deepEqual(failures, [])
  assert.ok(listed && called, 'Discovery and real native tool execution both complete')
  assert.equal(requests, expectedRequests)
  if (expectedUpstream) assert.ok(upstreamChecked)
  assert.deepEqual(await client.call('harness/mcp/servers'), registry, 'The registry stays unchanged')
  console.log(JSON.stringify({ ok: true, proxyDiscovery: listed, nativeToolCall: called, upstreamChecked, registryUnchanged: true, paidInference: false }))
} finally {
  try {
    if (created) await client.call('session/delete', { sessionId })
  } finally {
    try {
      if (started) await client.close()
    } finally {
      provider.closeAllConnections()
      if (provider.listening) await new Promise(resolve => provider.close(resolve))
    }
  }
}
