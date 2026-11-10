// Two development ships, native Ames/Gall, no provider calls. Grants the peer access
// for the run and restores the list. Refuse to touch an existing direct-tool conversation.
// SHIP_COOKIE=... TEST_PEER_PANE=... PEER_SHIP=~bud node tests-js/peer-rpc-conformance.mjs
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomBytes } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie } from './lib/ship-client.mjs'

const pane = process.env.TEST_PEER_PANE, peer = process.env.PEER_SHIP
assert.ok(pane && /^~[a-z-]+$/.test(peer || ''), 'Set TEST_PEER_PANE and PEER_SHIP for the sending development ship')
const ship = cookie.split('=')[0].slice('urbauth-'.length)
const sessionId = `peer-tool--${peer}`, client = new Client(), run = promisify(execFile)
const stamp = new Date()
const seconds = String(stamp.getUTCHours() * 3600 + stamp.getUTCMinutes() * 60 + stamp.getUTCSeconds()).replace(/\B(?=(\d{3})+$)/g, '.')
const issued = `(add ~${stamp.getUTCFullYear()}.${stamp.getUTCMonth() + 1}.${stamp.getUTCDate()} (mul ~s1 ${seconds}))`
const nextId = () => `0v${BigInt(`0x${randomBytes(16).toString('hex')}`).toString(32).replace(/\B(?=([0-9a-v]{5})+$)/g, '.')}`
let created = false, before
async function send(id, name, args = {}, date = issued) {
  const literal = JSON.stringify(args).replaceAll('\\', '\\\\').replaceAll("'", "\\'")
  await run('tmux', ['send-keys', '-t', pane, '--', `:${ship}/harness &harness-rpc-0 [%invoke ${id} ${date} '${name}' '${literal}']`, 'Enter'])
  await sleep(200)
}
async function snapshot() { return client.call('harness/session/snapshot', { sessionId }) }
async function until(count) {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const sessions = (await client.call('session/list')).sessions
    if (sessions.some((entry) => entry.sessionId === sessionId)) {
      created = true
      const value = await snapshot()
      if (value.phase === 'idle' && value.entries.filter((entry) => entry.role === 'tool').length >= count) return value
    }
    await sleep(100)
  }
  throw new Error('Direct RPC did not complete; verify Ames connectivity and the peer grant')
}
try {
  await client.start()
  assert.ok(!(await client.call('session/list')).sessions.some((entry) => entry.sessionId === sessionId), 'Existing direct-tool history must be preserved; use another fixture peer')
  before = await client.call('harness/peers')
  assert.ok(!before.grants.some((entry) => entry.ship === peer), 'Use a fixture peer without a saved grant')
  const policy = await client.call('harness/peers/configure', { revision: before.revision, config: before.config, limits: before.limits, grants: [...before.grants, { ship: peer, tools: [], inflows: [], budget: 0, model: null }] })
  const id = nextId()
  await send(id, 'current_time')
  const first = await until(1)
  assert.equal(first.entries.filter((entry) => entry.role === 'tool').length, 1)
  assert.match(JSON.parse(first.entries.at(-1).body).utc, /^\d{4}-/)
  await send(id, 'current_time') // Exact duplicate: return receipt, never execute.
  await send(id, 'read_skill', { name: 'fixture' }) // Same ID with changed payload: reject.
  await send(nextId(), 'invented_fixture_tool') // Unknown tool: reject.
  await send(nextId(), 'current_time', {}, '~2020.1.1') // Expired: reject.
  await send(nextId(), 'current_time') // Ordered Ames barrier.
  const second = await until(2)
  assert.equal(second.entries.filter((entry) => entry.role === 'tool').length, 2)
  assert.deepEqual(second.usage, { prompt: 0, completion: 0 })
  if (policy.owners.some((entry) => entry.ship === peer)) {
    await send(nextId(), 'harness_admin', { method: 'harness/peers/remote', params: '{}' })
    const admin = await until(3)
    const frame = JSON.parse(admin.entries.at(-1).body)
    assert.ok(Array.isArray(frame.result?.ships), 'Owner direct RPC reaches the administrative handler')
    assert.deepEqual(admin.usage, { prompt: 0, completion: 0 })
  }
  console.log('PASS native Ames direct tools: zero serving tokens, duplicate/mismatch/unknown/expired rejection, owner admin read when applicable')
} finally {
  if (created) await client.call('session/delete', { sessionId })
  if (before) {
    const current = await client.call('harness/peers')
    await client.call('harness/peers/configure', { revision: current.revision, config: before.config, limits: before.limits, grants: before.grants })
  }
  await client.close()
}
