// Three real ships share one channel conversation: ~zod is the bot, the peer
// (~lux) its owner and the guest (~nec) a trusted ship. A local deterministic
// provider observes each turn's input and offered tools. Restores defaults and
// policy; test messages remain.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base, readCookie } from './lib/ship-client.mjs'

const nest = process.env.TEST_NEST, peerUrl = process.env.PEER_URL, guestUrl = process.env.GUEST_URL
assert.ok(nest && peerUrl && guestUrl && process.env.PEER_COOKIE && process.env.GUEST_COOKIE,
  'Set TEST_NEST, PEER_URL, PEER_COOKIE, GUEST_URL and GUEST_COOKIE')
const name = (auth) => auth.split('=')[0].slice('urbauth-'.length)
const owner = { url: peerUrl, cookie: await readCookie(process.env.PEER_COOKIE) }
const guest = { url: guestUrl, cookie: await readCookie(process.env.GUEST_COOKIE) }
owner.ship = name(owner.cookie); guest.ship = name(guest.cookie)
const ship = name(cookie), client = new Client(), marker = `shared-${randomUUID()}`, failures = [], turns = {}
assert.equal(new Set([ship, owner.ship, guest.ship]).size, 3, 'The bot, owner and guest are three ships')
let event = 0, defaults, policy
const [, host, channelName] = nest.split('/')
// The adapter names a channel's session for its host and channel; a thread's adds -thread.
const room = `${host.slice(1)}-${channelName.slice(0, 24)}-`, thread = `${room.slice(0, -1)}-thread-`
const call = (id, fn, args) => ({ id, type: 'function', function: { name: fn, arguments: JSON.stringify(args) } })
const answer = (res, content, calls = []) => res.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
  role: 'assistant', content, ...(calls.length ? { tool_calls: calls } : {}),
} }], usage: { prompt_tokens: 20, completion_tokens: 10 } }))
const words = (content) => typeof content === 'string' ? content : JSON.stringify(content ?? '')
const server = createServer(async (req, res) => {
  try {
    const body = JSON.parse(await readText(req)), last = body.messages.findLastIndex((m) => m.role === 'user')
    const input = words(body.messages[last].content), results = body.messages.slice(last + 1).filter((m) => m.role === 'tool')
    const step = input.match(new RegExp(`${marker}-(\\w+)`))?.[1]
    res.writeHead(200, { 'content-type': 'application/json' })
    if (!step) return answer(res, 'NO_STEP')
    if (!results.length) {
      turns[step] = { input, offered: body.tools?.map((t) => t.function.name) ?? [], history: body.messages.slice(0, last).map((m) => words(m.content)).join('\n') }
      // A guest forges a call to a tool its grants lack.
      if (step.startsWith('guest')) return answer(res, '', [call(`forged-${step}`, 'curl', { url: 'http://127.0.0.1:9/' })])
    } else turns[step].refusal = results[0].content
    return answer(res, `${marker}-${step}-ok`)
  } catch (error) { failures.push(error); answer(res, 'FIXTURE_ERROR') }
})
async function scry(path) {
  const res = await fetch(`${owner.url}/~/scry/${path}.json`, { headers: { cookie: owner.cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(res.ok, `scry ${path}: ${res.status}`); return res.json()
}
async function poke(who, action) {
  const res = await fetch(`${who.url}/~/channel/${marker}-${who.ship.slice(1)}`, { method: 'PUT', headers: { cookie: who.cookie, 'content-type': 'application/json' },
    body: JSON.stringify([{ id: ++event, action: 'poke', ship: who.ship.slice(1), app: 'channels', mark: 'channel-action-1', json: { channel: { nest, action: { post: action } } } }]),
    signal: AbortSignal.timeout(15000) })
  assert.ok(res.ok, `poke as ${who.ship}: ${res.status}`)
}
async function until(label, check, timeout = 45000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (failures.length) throw new AggregateError(failures)
    const value = await check()
    if (value) { console.log(`PASS ${label}`); return value }
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
const reply = (post, step) => post?.essay?.author === ship && JSON.stringify(post.essay.content).includes(`${marker}-${step}-ok`)
// Each speaker mentions the bot in the channel and waits for its answer there.
async function speak(who, step) {
  await poke(who, { add: { content: [{ inline: [{ ship }, ` ${marker}-${step}`] }], author: who.ship, sent: Date.now(), kind: '/chat', meta: null, blob: null } })
  return until(`${step}: ${who.ship} answered in the channel`, async () =>
    Object.entries((await scry(`channels/v5/${nest}/posts/newest/32/post`)).posts).find(([, post]) => reply(post, step))?.[0])
}
const sessions = async () => (await client.call('harness/tlon')).sessions
const roomSessions = async () => (await sessions()).filter((sid) => sid.startsWith(room) && !sid.startsWith(thread))
async function oneRoom(label) {
  const ids = await roomSessions()
  assert.equal(ids.length, 1, `${label}: the channel has one session, not ${JSON.stringify(ids)}`)
  return ids[0]
}
const entries = async (sessionId) => (await client.call('harness/session/snapshot', { sessionId })).entries.map((e) => words(e.body))
function spoken(step, who) {
  const seen = turns[step]
  assert.ok(seen, `${step}: the model ran`)
  assert.ok(seen.input.includes(`${who.ship}: `) && seen.input.indexOf(`${who.ship}: `) < seen.input.indexOf(`${marker}-${step}`),
    `${step}: the model input names ${who.ship} before the text: ${seen.input}`)
  for (const other of [owner, guest].filter((w) => w !== who)) assert.ok(!seen.input.includes(`${other.ship}: `), `${step}: input names ${other.ship}`)
}
function ownerTools(step) {
  spoken(step, owner)
  for (const tool of ['curl', 'http_fetch']) assert.ok(turns[step].offered.includes(tool), `${step}: the owner is offered ${tool}: ${turns[step].offered}`)
}
function guestTools(step, granted) {
  spoken(step, guest)
  assert.ok(!turns[step].offered.includes('curl'), `${step}: the guest is offered the owner's curl`)
  assert.equal(turns[step].offered.includes('http_fetch'), granted, `${step}: the guest's web grant ${granted ? 'is' : 'is not'} offered`)
  assert.match(turns[step].refusal, /not granted/, `${step}: the guest's forged curl call is refused`)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  defaults = await client.call('harness/defaults'); policy = (await client.call('harness/tlon')).policy
  await client.call('harness/defaults/configure', { config: { ...defaults, url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture', key: '', headers: [], tools: ['web', 'curl'] } })
  const shared = { enabled: true, owner: owner.ship, response: 'mentions', allowed: [], channels: [] }
  await client.call('harness/tlon/configure', { ...shared, trusted: [{ ship: guest.ship, tools: ['web'] }] })

  // Guest first: opening the shared session does not narrow the owner's turn after it.
  await speak(guest, 'guest1')
  const sid = await oneRoom('after the guest spoke')
  await speak(owner, 'owner1')
  assert.equal(await oneRoom('after the owner spoke'), sid, 'owner and guest share the channel session')
  guestTools('guest1', true); ownerTools('owner1')
  assert.ok(turns.owner1.history.includes(`${marker}-guest1`), 'the owner\'s turn sees the guest\'s message in the same transcript')
  console.log('PASS owner and guest share one channel session, each named, each with its own tools (guest first)')

  // Owner first: the owner's tools do not leak into the guest's turn after it.
  const parent = await speak(owner, 'owner2')
  await speak(guest, 'guest2')
  ownerTools('owner2'); guestTools('guest2', true)
  assert.equal(await oneRoom('owner first'), sid)
  const transcript = (await entries(sid)).join('\n')
  for (const step of ['guest1', 'owner1', 'owner2', 'guest2']) assert.ok(transcript.includes(`${marker}-${step}`), `${step} is in the channel session`)
  console.log('PASS the owner\'s tools do not leak to the guest after it (owner first)')

  // A reply in a thread of the channel has its own session.
  await poke(owner, { reply: { id: parent, action: { add: { content: [{ inline: [`${marker}-thread1`] }], author: owner.ship, sent: Date.now() } } } })
  await until('thread reply answered in the thread', async () => Object.values((await scry(`channels/v5/${nest}/posts/newest/32/post`)).posts[parent]?.seal?.replies || {})
    .some((r) => r?.['reply-essay']?.author === ship && JSON.stringify(r['reply-essay'].content).includes(`${marker}-thread1-ok`)))
  const threads = (await sessions()).filter((sid) => sid.startsWith(thread))
  assert.equal(threads.length, 1, `one thread session: ${threads}`)
  assert.notEqual(threads[0], sid)
  assert.equal(await oneRoom('after the thread'), sid)
  assert.ok(!(await entries(sid)).join('\n').includes(`${marker}-thread1`), 'the thread reply is not in the channel session')
  spoken('thread1', owner)
  console.log('PASS a thread of the channel has its own session')

  // Changing, then revoking, the guest's grants keeps the channel session and its history.
  await client.call('harness/tlon/configure', { ...shared, trusted: [{ ship: guest.ship, tools: [] }] })
  assert.equal(await oneRoom('after the guest\'s grants changed'), sid, 'a guest grant change keeps the channel session')
  await speak(guest, 'guest3')
  guestTools('guest3', false)
  await speak(owner, 'owner3')
  ownerTools('owner3')
  await client.call('harness/tlon/configure', { ...shared, trusted: [] })
  assert.equal(await oneRoom('after the guest was revoked'), sid, 'revoking the guest keeps the channel session')
  await speak(owner, 'owner4')
  ownerTools('owner4')
  for (const step of ['guest1', 'owner1', 'owner2', 'guest2', 'guest3', 'owner3']) assert.ok(turns.owner4.history.includes(`${marker}-${step}`), `the owner's next turn still sees ${step}`)
  assert.ok((await entries(sid)).join('\n').includes(`${marker}-owner4`))
  assert.equal(await oneRoom('at the end'), sid)
  console.log('PASS a guest grant change and revocation keep the channel session and its history')
  assert.deepEqual(failures, [])
  for (const [step, seen] of Object.entries(turns)) console.log(`${step}: input ${JSON.stringify(seen.input)}; offered [${seen.offered.join(', ')}]${seen.refusal ? `; forged curl returned ${seen.refusal}` : ''}`)
  console.log(JSON.stringify({ ok: true, sharedSession: sid, threadSession: threads[0] }))
} finally {
  if (defaults) await client.call('harness/defaults/configure', { config: { ...defaults, key: '' } })
  if (policy) await client.call('harness/tlon/configure', policy)
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
