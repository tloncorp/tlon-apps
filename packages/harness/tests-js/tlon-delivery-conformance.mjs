// Disposable two-ship test: real Messenger, controlled inference, actual Gall
// suspension/revival. Restores policy/defaults and leaves delivery evidence.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const peerUrl = process.env.PEER_URL, pane = process.env.SHIP_DOJO_PANE
const inChannel = process.env.SURFACE === 'channel', nest = process.env.TEST_NEST
const hostPane = process.env.CHANNEL_HOST_DOJO_PANE
assert.ok(peerUrl && pane && process.env.PEER_COOKIE, 'Set PEER_URL, PEER_COOKIE, SHIP_DOJO_PANE')
assert.ok(!inChannel || nest, 'Set TEST_NEST for channel delivery')
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length)
const marker = `delivery-${randomUUID()}`, client = new Client(), run = promisify(execFile)
const hand = new HandClient(client, { hand: 'tlon', worker: marker })
let event = 0, defaults, policy, suspended = false, hostSuspended = false, sessionId
const requests = []
const server = createServer(async (req, res) => {
  const raw = await readText(req)
  requests.push({ body: JSON.parse(raw), res })
})
const finish = (index, suffix) => requests[index].res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: `${marker}-${suffix}` } }] }))
async function until(label, check) {
  const end = Date.now() + 45000
  while (Date.now() < end) {
    const value = await check()
    if (value) { console.log(`PASS ${label}`); return value }
    await sleep(150)
  }
  throw new Error(`Timed out: ${label}`)
}
async function dojo(command, target = pane) {
  await run('tmux', ['send-keys', '-t', target, '-l', '--', command])
  await run('tmux', ['send-keys', '-t', target, 'Enter'])
  await sleep(500)
}
async function status() {
  const r = await fetch(`${base}/~/scry/harness-tlon/status.json`, { headers: { cookie }, signal: AbortSignal.timeout(10000) })
  return r.ok ? r.json() : null
}
async function suspend() {
  suspended = true
  await dojo('|rein %harness [%.n %harness-tlon]')
  await until('adapter really suspended', async () => !await status())
}
async function resume() {
  await dojo('|rein %harness [%.y %harness-tlon]')
  await until('adapter reconnected to head', async () => (await status())?.headConnected)
  suspended = false
}
async function posts() {
  const path = inChannel ? `channels/v4/${nest}/posts/newest/64/outline` : `chat/v4/dm/${ship}/writs/newest/64/light`
  const r = await fetch(`${peerUrl}/~/scry/${path}.json`, { headers: { cookie: peerCookie } })
  assert.ok(r.ok)
  const page = await r.json()
  return Object.entries(page.writs || page.posts).map(([key, p]) => ({ ...p, fixtureId: inChannel ? key : p.seal.id.split('/')[1] }))
}
const matches = async (suffix) => (await posts()).filter((p) => p.essay?.author === ship && JSON.stringify(p.essay.content).includes(`${marker}-${suffix}`))
async function send(suffix) {
  const da = (((BigInt(Date.now()) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const essay = { content: [{ inline: [...(inChannel ? [{ ship }] : []), `${marker} ${suffix}`] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null }
  const r = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([
    { id: ++event, action: 'poke', ship: peer.slice(1), app: inChannel ? 'channels' : 'chat', mark: inChannel ? 'channel-action-1' : 'chat-dm-action-2', json: inChannel ? { channel: { nest, action: { post: { add: essay } } } } : { ship, diff: { id: `${peer}/${da}`, delta: { add: { time: null, essay } } } } },
  ]) })
  assert.ok(r.ok)
}
async function idle() {
  return until('idle hand has no clock wake or pending sends', async () => {
    const s = await status()
    return s?.headConnected && s.deliveryMode === 'events' && !s.pending && !s.delivering && s.maintenanceWake === null
  })
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  defaults = await client.call('harness/defaults'); policy = (await client.call('harness/tlon')).policy
  await client.call('harness/defaults/configure', { config: { url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture', key: '', headers: [], system: 'Fixture', 'max-context': 80000, tools: [] } })
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, response: 'mentions', allowed: [], channels: [], trusted: [] })
  await idle()
  await send('first'); await until('first DM reaches inference', () => requests.length === 1)
  ;[sessionId] = (await status()).sessions
  finish(0, 'first'); await until('ordinary reply delivered', async () => (await matches('first')).length === 1); await idle()

  await send('offline'); await until('second DM reaches inference', () => requests.length === 2)
  await suspend(); finish(1, 'offline')
  const [pending] = await until('reply persists while adapter is down', async () => {
    const records = (await hand.outbox()).filter((r) => r.sessionId === sessionId)
    return records.length === 1 && records
  })
  assert.equal(pending.status, 'pending'); assert.equal(pending.attempt, 0)
  assert.equal((await matches('offline')).length, 0)
  await resume(); await until('reconnect snapshot drains queued reply', async () => (await matches('offline')).length === 1); await idle()

  await send('held'); await until('third DM reaches inference', () => requests.length === 3)
  await send('behind'); await until('next DM is durably queued', async () => (await hand.health()).waiting === 1)
  await suspend(); finish(2, 'held'); await until('head continues queued inference without adapter', () => requests.length === 4)
  finish(3, 'behind')
  const queued = await until('two replies persist in order', async () => {
    const records = (await hand.outbox()).filter((r) => r.sessionId === sessionId)
    return records.length === 2 && records
  })
  const held = queued.find((r) => r.text === `${marker}-held`)
  const claim = await hand.claim(held.effectId)
  await hand.resolve(held.effectId, { attempt: claim.attempt, status: 'uncertain', reason: 'Fixture: claim made without ever invoking a publisher' })
  await resume(); await idle()
  assert.equal((await matches('held')).length, 0); assert.equal((await matches('behind')).length, 0)
  await assert.rejects(hand.retry(held.effectId), /uncertain/)
  console.log('PASS recovered uncertainty blocks the destination without a retry timer')
  await suspend()
  const unresolved = await hand.effect(held.effectId)
  await hand.resolve(held.effectId, { attempt: unresolved.attempt, status: 'failed', reason: 'Fixture confirms publisher was never called' })
  await hand.retry(held.effectId)
  await resume()
  await until('recovered pending replies drain in admission order', async () => (await matches('held')).length === 1 && (await matches('behind')).length === 1)
  await idle()
  const nativeStamp = (p) => BigInt(p.fixtureId.replaceAll('.', ''))
  const ordered = (await posts()).filter((p) => p.essay?.author === ship && [ 'held', 'behind' ].some((s) => JSON.stringify(p.essay.content).includes(`${marker}-${s}`))).sort((a, b) => nativeStamp(a) < nativeStamp(b) ? -1 : 1)
  assert.notEqual(ordered[0].fixtureId, ordered[1].fixtureId, 'same-event deliveries have distinct native IDs')
  assert.ok(JSON.stringify(ordered[0].essay.content).includes(`${marker}-held`))

  await send('retry'); await until('retry fixture reaches inference', () => requests.length === 5)
  await suspend(); finish(4, 'retry')
  const [retry] = await until('retry fixture waits in outbox', async () => {
    const records = (await hand.outbox()).filter((r) => r.sessionId === sessionId)
    return records.length === 1 && records
  })
  const failed = await hand.claim(retry.effectId)
  await hand.receipt(retry.effectId, 'failed', '', failed.attempt)
  await resume(); await idle()
  assert.equal((await matches('retry')).length, 0)
  await hand.retry(retry.effectId)
  await until('explicit retry wakes the idle adapter without a timer', async () => (await matches('retry')).length === 1)
  await idle()

  await dojo('|revive %harness')
  await until('whole-desk revive reconnects', async () => (await status())?.headConnected)
  await send('revived'); await until('post-revive DM reaches inference', () => requests.length === 6)
  finish(5, 'revived'); await until('post-revive reply delivered', async () => (await matches('revived')).length === 1); await idle()
  for (const suffix of ['first', 'offline', 'held', 'behind', 'retry', 'revived']) assert.equal((await matches(suffix)).length, 1, `no duplicate ${suffix}`)
  assert.equal(requests.length, 6, 'recovery never reruns inference')
  console.log('PASS whole-desk revival, reply order, no duplicate sends or inference')
  if (inChannel && hostPane) {
    await send('confirmation'); await until('confirmation fixture reaches inference', () => requests.length === 7)
    hostSuspended = true
    await dojo('|rein %groups [%.n %channels-server]', hostPane)
    finish(6, 'confirmation')
    const publication = await until('local acceptance is not a host receipt', async () => {
      const records = (await hand.outbox()).filter((r) => r.sessionId === sessionId && r.text === `${marker}-confirmation`)
      return records.length === 1 && records[0].status === 'claimed' && records[0]
    })
    assert.equal((await matches('confirmation')).length, 0)
    await suspend()
    await dojo('|rein %groups [%.y %channels-server]', hostPane)
    hostSuspended = false
    await until('host accepts the post while adapter is down', async () => (await matches('confirmation')).length === 1)
    await resume()
    await until('recovery proves publication from the native cache', async () => (await hand.effect(publication.effectId)).status === 'delivered')
    await idle()
    assert.equal((await matches('confirmation')).length, 1)
    assert.equal(requests.length, 7)
  }
} finally {
  if (hostSuspended) await dojo('|rein %groups [%.y %channels-server]', hostPane)
  if (suspended) await resume()
  if (policy) await client.call('harness/tlon/configure', policy)
  if (defaults) await client.call('harness/defaults/configure', { config: { ...defaults, key: '' } })
  await client.close()
  for (const { res } of requests) if (!res.writableEnded) res.destroy()
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
  await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([{ id: ++event, action: 'delete' }]) })
}
