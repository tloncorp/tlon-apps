// Only the owner changes a DM's settings and shared memory, by command or
// through the memory tool. The
// peer (~lux) DMs the bot, first as its owner, then as a ship with only a DM
// grant, while the bot's own ship owns it. Leaves marked test messages and
// audit records; restores defaults, policy and the DM's configuration.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { text as readText } from 'node:stream/consumers'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { authorShip, assertBotAuthor } from './lib/author.mjs'

const peerUrl = process.env.PEER_URL
assert.ok(peerUrl && process.env.PEER_COOKIE, 'Set PEER_URL and PEER_COOKIE')
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `owner-settings-${randomUUID()}`, client = new Client()
const name = `o${randomUUID().slice(0, 8)}`, refused = /Only the owner can change this conversation/
const dm = {}
let event = 0, stamp = 0, originals
// Commands never reach the model; any other request is a failure. A message
// asking the bot to remember is answered by a memory save, then a reply.
const requests = [], saves = []
const server = createServer(async (req, res) => {
  const body = await readText(req)
  const messages = JSON.parse(body || '{}').messages ?? []
  if (!body.includes(`${marker}-ask`)) {
    requests.push(req.url)
    res.writeHead(500, { 'content-type': 'application/json' }); return res.end('{}')
  }
  const done = messages.filter((m) => m.role === 'tool')
  saves.push(...done.map((m) => m.content))
  const message = done.length ? { role: 'assistant', content: `${marker}-done` }
    : { role: 'assistant', content: '', tool_calls: [{ id: 'save-1', type: 'function', function: { name: 'memory', arguments: JSON.stringify({ operation: 'save', name: `${name}-tool`, text: `${marker}-tool`, revision: '0' }) } }] }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: done.length ? 'stop' : 'tool_calls', message }] }))
})
async function scry(path, remote = false, missing) {
  const r = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, { headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000) })
  if (r.status === 404 && missing !== undefined) return missing
  assert.ok(r.ok, `${path}: ${r.status}`); return r.json()
}
async function until(description, check) {
  const end = Date.now() + 60000
  while (Date.now() < end) {
    const value = await check(); if (value) return value
    await sleep(150)
  }
  throw new Error(`Timed out: ${description}`)
}
// The peer has no DM with the bot until its first message.
const messages = async () => Object.entries((await scry(`chat/v4/dm/${ship}/writs/newest/100/heavy`, true, { writs: {} })).writs).map(([id, p]) => ({ id, ...p.essay }))
async function send(text) {
  stamp = Math.max(Date.now(), stamp + 1)
  const da = (((BigInt(stamp) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const essay = { content: [{ inline: [text] }], author: peer, sent: stamp, blob: null, kind: '/chat', meta: null }
  const json = { ship, diff: { id: `${peer}/${da}`, delta: { add: { essay, time: null } } } }
  const r = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app: 'chat', mark: 'chat-dm-action-2', json }]), signal: AbortSignal.timeout(15000) })
  assert.ok(r.ok)
}
const memorySets = async () => (await scry(`harness/events/${dm.sid}`)).filter((e) => e.type === 'memory-set').length
const model = async () => (await client.call('harness/session/config', { sessionId: dm.sid })).model
// The peer sends a command in its DM; the bot's reply, and how many memory edits it made.
async function command(text, expected) {
  const ids = new Set((await messages()).map((p) => p.id)), sessions = new Set((await client.call('harness/tlon')).sessions)
  const before = dm.sid ? await memorySets() : 0
  await send(text)
  const ack = await until(`${text} answered`, async () => (await messages()).find((p) => !ids.has(p.id) && authorShip(p.author) === ship && expected.test(JSON.stringify(p.content))))
  assertBotAuthor(ack.author, ship)
  if (!dm.sid) dm.sid = await until('the DM session', async () => (await client.call('harness/tlon')).sessions.find((sid) => !sessions.has(sid)))
  return (await memorySets()) - before
}
// With another owner, the peer holds only a grant for its DM.
const owner = (who) => client.call('harness/tlon/configure', { enabled: true, owner: who, trusted: [], dmGrants: who === peer ? [] : [peer], channelGrants: [], response: 'mentions', allowed: [], channels: [] })
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await client.call('harness/tlon')).policy }
  const url = `http://127.0.0.1:${server.address().port}`
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '', url, model: 'fixture', headers: [], tools: [] } })

  // As the owner, the peer changes its DM's memory and model.
  await owner(peer)
  await command(`/memory ${name}`, /No matching shared memories/)
  dm.originalConfig = await client.call('harness/session/config', { sessionId: dm.sid })
  await client.call('harness/session/configure', { sessionId: dm.sid, config: { ...dm.originalConfig, key: '', url, model: 'fixture', headers: [], tools: [] } })
  assert.equal(await command(`/remember ${name} ${marker}-owner`, /Memory saved/), 1)
  assert.equal(await command('/model owner-model', /Model set to: .*owner-model/), 0)
  assert.equal(await model(), 'owner-model')
  console.log('PASS the owner remembers and changes the model in its DM')

  // With only a DM grant, the same commands change nothing.
  await owner(ship)
  assert.equal(await command(`/remember ${name} ${marker}-guest`, refused), 0)
  assert.equal(await command(`/forget ${name}`, refused), 0)
  assert.equal(await command('/model guest-model', refused), 0)
  assert.equal(await model(), 'owner-model', 'a DM partner\'s /model leaves the model')
  await command(`/memory ${name}`, new RegExp(`${marker}-owner`))
  console.log('PASS a ship with only a DM grant cannot remember, forget or change the model in its DM')
  assert.equal(await command(`${marker}-ask Please remember that I like tea.`, new RegExp(`${marker}-done`)), 0)
  assert.deepEqual(saves, ['error: Only the owner can change shared memory.'])
  await command(`/memory ${name}-tool`, /No matching shared memories/)
  console.log('PASS asked by a ship with only a DM grant, the memory tool stores nothing')

  await owner(peer)
  assert.equal(await command(`/forget ${name}`, /Memory forgotten/), 1)
  console.log('PASS the owner still forgets in its DM')
  assert.deepEqual(requests, [], 'commands do not request inference')
} finally {
  if (dm.originalConfig) await client.call('harness/session/configure', { sessionId: dm.sid, config: { ...dm.originalConfig, key: '' } })
  if (originals) {
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
