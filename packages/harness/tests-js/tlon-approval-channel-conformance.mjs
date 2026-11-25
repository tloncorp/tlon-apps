// A ship without access that mentions the bot in a channel opens one approval request,
// and the bot's owner is sent one card about it, on two real ships: the bot (its own
// owner) and a peer on no list, which hosts a fresh group with one channel. A post that
// does not mention the bot opens nothing, a thread reply within the denial limit opens no
// second request or card (the Hoon tests check joining past the limit), and leaving the
// channel leaves it open. Nothing the peer sends starts a model turn. Runs apart from
// tlon-denial-conformance: the denial limit lets a ship open one request per five minutes.
// Restores policy and defaults and deletes the group. Prints the card's A2UI entry on a
// CARD line for checking with the app's validator.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { text as readText } from 'node:stream/consumers'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'
import { authorShip, assertBotAuthor } from './lib/author.mjs'

assert.ok(process.env.PEER_COOKIE && process.env.PEER_URL, 'Set PEER_COOKIE and PEER_URL for a local fake peer')
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((line) => /\turbauth-~/.test(line)).split('\t')
const peer = row[5].slice('urbauth-'.length), peerCookie = `${row[5]}=${row[6]}`
const ship = cookie.split('=')[0].slice('urbauth-'.length), client = new Client()
assert.ok(['~lux', '~nec', '~bud', '~zod'].includes(ship) && ['~lux', '~nec', '~bud', '~zod'].includes(peer) && ship !== peer)
const marker = `ask-${randomUUID().slice(0, 8)}`, slug = marker, group = `${peer}/${slug}`
const room = `chat/${peer}/${slug}-room`
const prompts = []
let event = 0, policy, defaults, created = false
const server = createServer(async (req, res) => {
  prompts.push(await readText(req))
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: `${marker}-answer` } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
})
const da = (ms) => ((BigInt(ms) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n
async function scry(path, remote = false) {
  const response = await fetch(`${remote ? process.env.PEER_URL : base}/~/scry/${path}.json`, {
    headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000),
  })
  if (response.status === 404) return null
  assert.ok(response.ok, `${path}: HTTP ${response.status}`)
  return response.json()
}
async function poke(app, mark, json) {
  const response = await fetch(`${process.env.PEER_URL}/~/channel/${slug}`, {
    method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app, mark, json }]),
    signal: AbortSignal.timeout(15000),
  })
  assert.ok(response.ok, `${app}: HTTP ${response.status}`)
}
async function until(label, check, timeout = 45000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const value = await check()
    if (value) { console.log(`PASS ${label}`); return value }
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
const groups = (remote = false) => scry('groups/v2/groups', remote)
const joined = async () => Object.hasOwn(await scry('channels/v4/channels'), room)
const status = () => client.call('harness/tlon')
const requests = (s) => s.requests.filter((request) => request.ship === peer)
const denials = (s) => s.events.filter((notice) => notice.kind === 'permission-denied' && notice.actor === peer)
// The text of each message the peer sends, so a check that it was ignored looks for
// exactly what was sent.
const sentText = (label) => `${marker}-${label}`
const seen = (label) => prompts.some((prompt) => new RegExp(`${sentText(label)}(?![\\w-])`).test(prompt))
async function post(label, mention) {
  await poke('channels', 'channel-action-1', { channel: { nest: room, action: { post: { add: {
    content: [{ inline: [...(mention ? [{ ship }, ' '] : []), sentText(label)] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null,
  } } } } })
}
async function reply(parent, label) {
  await poke('channels', 'channel-action-1', { channel: { nest: room, action: { post: { reply: { id: parent, action: { add: {
    content: [{ inline: [{ ship }, ` ${sentText(label)}`] }], author: peer, sent: Date.now(), blob: null,
  } } } } } } })
}
const posts = async () => Object.entries((await scry(`channels/v5/${room}/posts/newest/32/post`))?.posts || {})
const posted = (label) => async () => (await posts()).find(([, value]) => JSON.stringify(value?.essay?.content).includes(sentText(label)))
const replied = (parent, label) => async () => {
  const thread = (await posts()).find(([key]) => key === parent)?.[1]
  return Object.values(thread?.seal?.replies || {}).some((value) => JSON.stringify(value?.['reply-essay']?.content).includes(sentText(label)))
}
// The bot is its own owner, so its cards to the owner are in its DM with itself.
const cardText = `Channel mention request from ${peer}`
const plain = (content) => content.flatMap((verse) => verse.inline || []).map((item) => typeof item === 'string' ? item : item.ship ?? '').join('')
const after = (id, start) => BigInt(id.split('/').at(-1).replaceAll('.', '')) > start
async function cards(start) {
  return Object.values((await scry(`chat/v4/dm/${ship}/writs/newest/64/light`))?.writs || {})
    .filter((value) => authorShip(value.essay?.author) === ship && after(value.seal.id, start) && plain(value.essay.content) === cardText)
}
function entry(card) {
  const entries = JSON.parse(card.essay.blob)
  assert.equal(entries.length, 1)
  return entries[0]
}
function components(card) {
  const update = entry(card).messages.find((message) => message.updateComponents).updateComponents
  return new Map(update.components.map((component) => [component.id, component]))
}
const answered = async () => (await posts()).some(([, value]) => authorShip(value?.essay?.author) === ship)
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  policy = (await status()).policy
  defaults = await client.call('harness/defaults')
  await client.call('harness/defaults/configure', { config: { ...defaults, url: `http://127.0.0.1:${server.address().port}`, model: 'ask-fixture', key: '', headers: [], tools: [] } })
  assert.ok(!(await groups(true))[group], 'Fixture group must not exist')
  created = true
  const response = await fetch(`${process.env.PEER_URL}/spider/groups/group-create-thread/group-create-1/group-ui-2.json`, {
    method: 'POST', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ groupId: group, meta: { title: slug }, guestList: [], channels: [] }), signal: AbortSignal.timeout(30000),
  })
  assert.ok(response.ok, `create group: HTTP ${response.status}`)
  await until('fixture group created', async () => (await groups(true))[group])
  await poke('channels', 'channel-action-2', { create: {
    kind: 'chat', name: `${slug}-room`, group, title: 'Room', description: '', meta: null, readers: [], writers: [],
  } })
  await until('fixture channel created', async () => Object.keys((await groups(true))[group].channels).length === 1)
  await poke('groups', 'group-action-4', { group: { flag: group, 'a-group': { entry: { privacy: 'public' } } } })
  await until('fixture group made public', async () => (await groups(true))[group].admissions.privacy === 'public')
  await client.call('harness/tlon/configure', { enabled: true, owner: ship, response: 'mentions', allowed: [], channels: [], trusted: [] })
  await client.pokeAgent('groups', 'group-join', { flag: group, 'join-all': true })
  await until('the bot joined the channel', joined, 90000)
  const testStart = da(Date.now())

  await post('unmentioned', false)
  await until('a post that does not mention the bot arrived', posted('unmentioned'))
  await sleep(3000)
  const quiet = await status()
  assert.deepEqual(requests(quiet), [], 'a post that does not mention the bot opened a request')
  assert.deepEqual(denials(quiet), [], 'a post that does not mention the bot was recorded as an attempt')
  assert.deepEqual(await cards(testStart), [], 'a post that does not mention the bot sent the owner a card')
  console.log('PASS a post that does not mention the bot opens nothing')

  await post('mention', true)
  const [request] = await until('a mention from a ship without access opens a request', async () => {
    const open = requests(await status())
    return open.length && open
  })
  assert.deepEqual(Object.keys(request).sort(), ['address', 'at', 'id', 'ship'], 'a request holds its ship, place, id and time only')
  assert.equal(request.address, room)
  assert.match(request.id, /^c[0-9a-f]{4}$/)
  const [card] = await until('the owner is sent a card about it', async () => {
    const found = await cards(testStart)
    return found.length && found
  })
  assertBotAuthor(card.essay.author, ship)
  console.log(`CARD ${JSON.stringify(entry(card))}`)
  const parts = components(card)
  assert.equal(parts.get('title').text, `Let the bot reply to ${peer} in Room?`)
  assert.equal(parts.get('context1').text, 'Channel: Room')
  assert.equal(parts.get('context2').text, `Group: ${slug}`)
  assert.ok(parts.get('copy').text.includes(sentText('mention')))
  const buttons = ['allow', 'reject', 'ban'].map((id) => [parts.get(parts.get(id).child).text, parts.get(id).action.event.context.text])
  assert.deepEqual(buttons, [['Allow', `/allow ${request.id} ${peer}`], ['Reject', `/reject ${request.id} ${peer}`], ['Block', `/ban ${request.id} ${peer}`]])
  console.log('PASS the card names the peer, the channel and its message, and its buttons carry the request id and ship')

  const [parent] = await posted('mention')()
  await reply(parent, 'thread')
  await until('a thread reply mentioning the bot arrived', replied(parent, 'thread'))
  await sleep(3000)
  assert.equal(denials(await status()).length, 1, 'a thread reply within the limit recorded another denial')
  assert.deepEqual(requests(await status()), [request], 'a thread reply opened another request')
  assert.equal((await cards(testStart)).length, 1, 'a thread reply sent another card')
  console.log('PASS a thread reply within the denial limit opens no request and sends no card')

  assert.ok(!['unmentioned', 'mention', 'thread'].some(seen), 'a message from a ship without access reached the model')
  assert.equal(prompts.length, 0, 'the model was called')
  assert.ok(!(await answered()), 'the peer was answered in the channel')
  console.log('PASS nothing the peer sends starts a model turn, and nothing is posted in the channel')

  await client.pokeAgent('channels', 'channel-action-2', { channel: { nest: room, action: { leave: null } } })
  await until('the bot left the channel', async () => !(await joined()))
  await sleep(3000)
  assert.deepEqual(requests(await status()), [request], 'leaving the channel closed its request')
  console.log('PASS leaving the channel leaves its request open')
} finally {
  try {
    // Giving the peer access closes its request, which would otherwise hold one of its
    // slots on this kept ship for 48 hours.
    if (policy) {
      await client.call('harness/tlon/configure', { ...(await status()).policy, allowed: [peer] })
      await until('the peer\'s request closed', async () => requests(await status()).length === 0)
    }
    if (defaults) await client.call('harness/defaults/configure', { config: { ...defaults, key: '' } })
    if (policy) await client.call('harness/tlon/configure', { ...policy, enabled: false })
    if (created) {
      if ((await groups())[group]) await client.pokeAgent('groups', 'group-leave', group)
      if ((await groups(true))[group]) await poke('groups', 'group-action-4', { group: { flag: group, 'a-group': { delete: null } } })
      await until('fixture group deleted', async () => !(await groups(true))[group] && !(await groups())[group])
    }
  } finally {
    try { if (policy) await client.call('harness/tlon/configure', policy) }
    finally { await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
  }
}
