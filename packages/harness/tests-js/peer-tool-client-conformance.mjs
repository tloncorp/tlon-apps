// Exercise both RPC protocol directions through the real tool driver: a session
// on this ship calls the peer ship's tools, using a deterministic local provider
// and temporary grants on both ships. No paid AI.
// SHIP_COOKIE=... PEER_URL=... PEER_COOKIE=... PEER_SHIP=~lux node tests-js/peer-tool-client-conformance.mjs
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client, cookie, readCookie } from './lib/ship-client.mjs'

const peerUrl = process.env.PEER_URL, peerShip = process.env.PEER_SHIP
assert.ok(peerUrl && process.env.PEER_COOKIE && /^~[a-z-]+$/.test(peerShip || ''), 'Set PEER_URL, PEER_COOKIE and PEER_SHIP for the serving development ship')
const ship = cookie.split('=')[0].slice('urbauth-'.length)
assert.notEqual(ship, peerShip, 'A ship cannot be its own peer; use two development ships')
const peerSession = `peer-tool--${ship}`, client = new Client(), failures = []
const peer = new Client({ url: peerUrl, auth: await readCookie(process.env.PEER_COOKIE) })
let before, peerBefore, sessionId, changed = false, peerChanged = false, requests = 0, receipts = []
const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const server = createServer(async (request, response) => {
  try {
    const text = await readText(request)
    const payload = JSON.parse(text)
    requests++
    receipts = payload.messages.filter((entry) => entry.role === 'tool')
    const calls = receipts.length ? [] : [
      tool('catalog', 'list_peer_tools', { ship: peerShip }),
      tool('clock', 'call_peer_tool', { ship: peerShip, name: 'current_time', arguments: {} }),
      tool('denied-admin', 'call_peer_tool', { ship: peerShip, name: 'harness_admin', arguments: { method: 'harness/peers/remote', params: '{}' } }),
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
  await peer.start()
  before = await client.call('harness/peers')
  peerBefore = await peer.call('harness/peers')
  assert.ok(!peerBefore.owners.some((entry) => entry.ship === ship), 'Use a peer ship that this ship does not own')
  assert.ok(!(await peer.call('session/list')).sessions.some((entry) => entry.sessionId === peerSession), 'Preserve existing direct-tool history; use another development ship')
  // Calls need mutual trust: this ship trusts the peer it calls, and the peer grants this ship skills.
  const trust = { ship: peerShip, tools: [], inflows: [], budget: 0, model: null }
  await client.call('harness/peers/configure', { revision: before.revision, config: before.config, limits: before.limits, grants: [...before.grants.filter((entry) => entry.ship !== peerShip), trust] })
  changed = true
  const grant = { ship, tools: ['skills'], inflows: [], budget: 0, model: null }
  await peer.call('harness/peers/configure', { revision: peerBefore.revision, config: peerBefore.config, limits: peerBefore.limits, grants: [...peerBefore.grants.filter((entry) => entry.ship !== ship), grant] })
  peerChanged = true
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
  const served = await peer.call('harness/session/snapshot', { sessionId: peerSession })
  assert.deepEqual(served.usage, { prompt: 0, completion: 0 })
  assert.equal(served.entries.filter((entry) => entry.role === 'tool').length, 1)
  console.log('PASS direct tool client roundtrip: resource schema, non-owner admin denial, correlated results, zero serving inference')
} finally {
  if (sessionId) await client.call('session/delete', { sessionId })
  if (peerChanged) {
    await peer.call('session/delete', { sessionId: peerSession })
    const current = await peer.call('harness/peers')
    await peer.call('harness/peers/configure', { revision: current.revision, config: peerBefore.config, limits: peerBefore.limits, grants: peerBefore.grants })
  }
  if (changed) {
    const current = await client.call('harness/peers')
    await client.call('harness/peers/configure', { revision: current.revision, config: before.config, limits: before.limits, grants: before.grants })
  }
  await client.close(); await peer.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
