// Exercise both RPC protocol directions through the real tool driver, using
// a deterministic local provider and a temporary self-peer grant. No paid AI.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client, cookie } from './lib/ship-client.mjs'

const ship = cookie.split('=')[0].slice('urbauth-'.length)
const peerSession = `peer-tool--${ship}`, client = new Client(), failures = []
let before, sessionId, changed = false, requests = 0, receipts = []
const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const server = createServer(async (request, response) => {
  try {
    const text = await readText(request)
    const payload = JSON.parse(text)
    requests++
    receipts = payload.messages.filter((entry) => entry.role === 'tool')
    const calls = receipts.length ? [] : [
      tool('catalog', 'list_peer_tools', { ship }),
      tool('clock', 'call_peer_tool', { ship, name: 'current_time', arguments: {} }),
      tool('denied-admin', 'call_peer_tool', { ship, name: 'harness_admin', arguments: { method: 'harness/peers/remote', params: '{}' } }),
    ]
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
      role: 'assistant', content: calls.length ? '' : 'RPC_CLIENT_OK', ...(calls.length ? { tool_calls: calls } : {}),
    } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
  } catch (error) { failures.push(error); response.writeHead(500); response.end('Fixture failed') }
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  before = await client.call('harness/peers')
  assert.ok(!before.owners.some((entry) => entry.ship === ship), 'Use a development ship that is not its own explicit owner')
  assert.ok(!(await client.call('session/list')).sessions.some((entry) => entry.sessionId === peerSession), 'Preserve existing direct-tool history; use another development ship')
  const grant = { ship, tools: ['skills'], inflows: [], budget: 0, model: null }
  await client.call('harness/peers/configure', { revision: before.revision, config: before.config, limits: before.limits, grants: [...before.grants.filter((entry) => entry.ship !== ship), grant] })
  changed = true
  ;({ sessionId } = await client.call('session/new', { name: `rpc-client-${randomUUID()}` }))
  await client.call('harness/session/configure', { sessionId, config: {
    url: `http://127.0.0.1:${server.address().port}/completions`, model: 'rpc-fixture', key: '', headers: [],
    system: 'Deterministic RPC client fixture.', 'max-context': 80000, tools: ['peers'],
  } })
  await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'Exercise direct tool RPC.' }] })
  assert.deepEqual(failures, [])
  assert.equal(requests, 2, 'Only the caller fixture runs: initial turn and tool-result continuation')
  const catalog = JSON.parse(receipts.find((entry) => entry.tool_call_id === 'catalog').content)
  assert.ok(catalog.tools.some((entry) => entry.name === 'read_skill'))
  assert.ok(!catalog.tools.some((entry) => entry.name === 'harness_admin'))
  assert.ok(catalog.tools.every((entry) => !entry.inputSchema))
  assert.match(JSON.parse(receipts.find((entry) => entry.tool_call_id === 'clock').content).utc, /^\d{4}-/)
  assert.match(receipts.find((entry) => entry.tool_call_id === 'denied-admin').content, /not granted/)
  const served = await client.call('harness/session/snapshot', { sessionId: peerSession })
  assert.deepEqual(served.usage, { prompt: 0, completion: 0 })
  assert.equal(served.entries.filter((entry) => entry.role === 'tool').length, 1)
  console.log('PASS direct tool client roundtrip: resource schema, non-owner admin denial, correlated results, zero serving inference')
} finally {
  if (sessionId) await client.call('session/delete', { sessionId })
  if (changed) {
    await client.call('session/delete', { sessionId: peerSession })
    const current = await client.call('harness/peers')
    await client.call('harness/peers/configure', { revision: current.revision, config: before.config, limits: before.limits, grants: before.grants })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
