// Two-ship test of a Messenger scheduled task in a channel nobody has spoken
// in: the owner (the peer) trusts the bot through Steward and creates tasks
// with the HTTP edit Messenger sends. The bot opens the channel's
// conversation, a one-time task posts there, and a recurring task there keeps
// running after the owner's first message in the channel. Controlled
// inference; restores policy and defaults and deletes its tasks.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base, readCookie } from './lib/ship-client.mjs'
import { authorShip, assertBotAuthor } from './lib/author.mjs'

const peerUrl = process.env.PEER_URL
assert.ok(peerUrl && process.env.PEER_COOKIE, 'Set PEER_URL and PEER_COOKIE')
assert.ok(process.env.TEST_NEST, 'Set TEST_NEST, the channel whose group this test adds a channel to')
const peerCookie = await readCookie(process.env.PEER_COOKIE)
const name = (auth) => auth.split('=')[0].slice('urbauth-'.length)
const ship = name(cookie), peer = name(peerCookie)
const [, host, testChannel] = process.env.TEST_NEST.split('/')
assert.equal(host, peer, 'TEST_NEST is hosted by the peer')
const group = `${peer}/${testChannel.replace(/-chat$/, '')}`
// A channel of its own, so the bot has no conversation there after a reset.
const slug = 'harness-automation', nest = `chat/${peer}/${slug}`
const marker = `automation-${randomUUID()}`, client = new Client()
let event = 0, defaults, policy
const created = []
const requests = []
const server = createServer(async (req, res) => {
  const body = JSON.parse(await readText(req))
  requests.push(body)
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: `${marker}-reply-${requests.length}` } }] }))
})

async function until(label, check, ms = 60_000) {
  const end = Date.now() + ms
  while (Date.now() < end) {
    const value = await check()
    if (value) { console.log(`PASS ${label}`); return value }
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
async function request(url, auth, path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers: { cookie: auth, 'content-type': 'application/json' }, signal: AbortSignal.timeout(60_000) })
  assert.ok(response.ok, `${path}: HTTP ${response.status} ${await response.clone().text()}`)
  return response
}
const scry = async (url, auth, path) => (await request(url, auth, `/~/scry/${path}.json`)).json()
const poke = (url, auth, who, app, mark, json) => request(url, auth, `/~/channel/${marker}-${++event}`, {
  method: 'PUT', body: JSON.stringify([{ id: event, action: 'poke', ship: who.slice(1), app, mark, json }]),
})
const status = () => scry(base, cookie, 'harness-tlon/status')
const prompted = (text) => requests.filter((body) => JSON.stringify(body.messages ?? body).includes(text)).length

// Messenger's edit: POST to the owner's Steward, held open until the bot answers.
async function edit(action) {
  const response = await request(peerUrl, peerCookie, '/steward/~/v1/automation', { method: 'POST', body: JSON.stringify({ bot: ship, action }) })
  const envelope = await response.json()
  return envelope.body ?? envelope
}
const task = (schedule, message) => ({
  name: message, enabled: true, schedule, sessionTarget: 'isolated', wakeMode: 'now',
  payload: { kind: 'agentTurn', message }, delivery: { mode: 'announce', channel: 'tlon', to: nest },
})
async function create(schedule, message) {
  // Until the bot's Steward has its owner and the hand's edit feed, it answers harness-offline.
  const body = await until('the bot answers the create', async () => {
    const answer = await edit({ create: task(schedule, message) })
    return answer.errorType === 'harness-offline' ? null : answer
  })
  assert.equal(body.type, 'created', JSON.stringify(body))
  created.push(body.id)
  return body.id
}
async function mirrored(id) {
  const tasks = await (await request(peerUrl, peerCookie, '/steward/~/v1/automation/tasks')).json()
  return tasks[ship]?.[id]
}
async function posts() {
  const page = await scry(peerUrl, peerCookie, `channels/v4/${nest}/posts/newest/64/outline`)
  return Object.values(page.posts ?? {}).filter((p) => p?.essay)
}
const botPosts = async () => (await posts()).filter((p) => authorShip(p.essay.author) === ship && JSON.stringify(p.essay.content).includes(marker))

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  // The peer hosts a fresh channel in the test group, open to every member, and the bot joins it.
  const hosted = async () => (await scry(peerUrl, peerCookie, 'groups/v2/groups'))[group]
  assert.ok(await hosted(), `the peer hosts ${group}`)
  if (!(await hosted()).channels?.[nest]) {
    await poke(peerUrl, peerCookie, peer, 'channels', 'channel-action-2', { create: {
      kind: 'chat', name: slug, group, title: 'Harness automation', description: '', meta: null, readers: [], writers: [],
    } })
    await until('channel created', async () => (await hosted()).channels?.[nest])
  }
  if (!Object.hasOwn(await scry(base, cookie, 'channels/v4/channels'), nest)) {
    await poke(base, cookie, ship, 'channels', 'channel-action-1', { channel: { nest, action: { join: group } } })
    await until('bot joined the channel', async () => Object.hasOwn(await scry(base, cookie, 'channels/v4/channels'), nest))
  }

  defaults = await client.call('harness/defaults'); policy = (await client.call('harness/tlon')).policy
  await client.call('harness/defaults/configure', { config: { url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture', key: '', headers: [], system: 'Fixture', 'max-context': 80000, tools: [] } })
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, response: 'mentions', allowed: [], channels: [], trusted: [] })
  await poke(peerUrl, peerCookie, peer, 'steward', 'steward-action-1', { 'trust-bot': { ship } })
  // Steward may still list tasks an earlier Harness on this ship projected, so
  // the hand can be holding its first projection; it takes edits either way.
  await until('the hand is connected', async () => (await status()).headConnected)
  assert.equal((await status()).conversations, 0, 'the bot has no conversation after its reset')

  const once = `${marker}-once`
  await create({ kind: 'at', at: Date.now() + 20_000 }, once)
  console.log('PASS a create into a channel nobody has spoken in is created')
  await until('the one-time task runs', () => prompted(once) === 1, 90_000)
  const [post] = await until('its reply is posted in the channel', async () => {
    const found = await botPosts()
    return found.length > 0 && found
  }, 60_000)
  assertBotAuthor(post.essay.author, ship)

  const recurring = `${marker}-recurring`
  const id = await create({ kind: 'cron', expr: '* * * * *', tz: 'UTC' }, recurring)
  await until('the recurring task runs', () => prompted(recurring) >= 1, 90_000)
  const hello = `${marker} hello`
  const mention = { content: [{ inline: [{ ship }, ` ${hello}`] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null }
  await poke(peerUrl, peerCookie, peer, 'channels', 'channel-action-1', { channel: { nest, action: { post: { add: mention } } } })
  const asked = await until('the owner\'s mention reaches inference', () => requests.findIndex((body) => JSON.stringify(body).includes(hello)) + 1)
  await until('the owner\'s mention is answered', async () => (await botPosts()).some((p) => JSON.stringify(p.essay.content).includes(`${marker}-reply-${asked}"`)))
  const runs = prompted(recurring)
  await until('the recurring task runs again after the owner spoke', () => prompted(recurring) > runs, 90_000)
  const mirror = await mirrored(id)
  assert.equal(mirror?.enabled, true, `the recurring task is still active: ${JSON.stringify(mirror)}`)
  console.log('PASS a recurring task in an opened channel survives the owner\'s first message there')
} finally {
  // A delete is refused while a run is in flight, so it is tried again.
  for (const id of created) {
    let body
    for (let attempt = 0; attempt < 10 && body?.type !== 'deleted'; attempt++) {
      if (attempt) await sleep(3000)
      body = await edit({ delete: { id } }).catch((error) => ({ error: error.message }))
    }
    if (body?.type !== 'deleted') console.error(`could not delete task ${id}: ${JSON.stringify(body)}`)
  }
  if (policy) await client.call('harness/tlon/configure', policy)
  if (defaults) await client.call('harness/defaults/configure', { config: { ...defaults, key: '' } })
  await client.close()
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
