// Per-place grants on two real ships: the bot (~zod, its own owner) and a peer
// (~lux) that is on no ship-wide list. The peer hosts a fresh group with two
// channels. A local stand-in provider answers every turn. Restores policy and
// defaults and deletes the group; the DM and its messages remain.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { text as readText } from 'node:stream/consumers'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'
import { authorShip } from './lib/author.mjs'

assert.ok(process.env.PEER_COOKIE && process.env.PEER_URL, 'Set PEER_COOKIE and PEER_URL for a local fake peer')
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((line) => /\turbauth-~/.test(line)).split('\t')
const peer = row[5].slice('urbauth-'.length), peerCookie = `${row[5]}=${row[6]}`
const ship = cookie.split('=')[0].slice('urbauth-'.length), client = new Client()
assert.ok(['~lux', '~nec', '~bud', '~zod'].includes(ship) && ['~lux', '~nec', '~bud', '~zod'].includes(peer) && ship !== peer)
const marker = `place-${randomUUID().slice(0, 8)}`, slug = marker, group = `${peer}/${slug}`
const roomA = `chat/${peer}/${slug}-a`, roomB = `chat/${peer}/${slug}-b`
const prompts = []
let event = 0, policy, defaults, created = false
const server = createServer(async (req, res) => {
  prompts.push(await readText(req))
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: `${marker}-answer` } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
})
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
const configure = (grants) => client.call('harness/tlon/configure', {
  enabled: true, owner: ship, response: 'mentions', allowed: [], channels: [], trusted: [],
  dmGrants: [], channelGrants: [], ...grants,
})
const groups = (remote = false) => scry('groups/v2/groups', remote)
const joined = async (nest) => Object.hasOwn(await scry('channels/v4/channels'), nest)
const dms = (path) => scry(`chat/${path}`)
const seen = (label) => prompts.some((prompt) => prompt.includes(`${marker}-${label}`))
// The peer mentions the bot in a channel.
async function mention(nest, label) {
  await poke('channels', 'channel-action-1', { channel: { nest, action: { post: { add: {
    content: [{ inline: [{ ship }, ` ${marker}-${label}`] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null,
  } } } } })
}
const answered = async (nest) => Object.values((await scry(`channels/v5/${nest}/posts/newest/32/post`))?.posts || {})
  .some((post) => authorShip(post?.essay?.author) === ship && JSON.stringify(post.essay.content).includes(`${marker}-answer`))
// The peer writes to the bot in their DM.
async function dm(label) {
  const da = (((BigInt(Date.now()) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  await poke('chat', 'chat-dm-action-2', {
    ship, diff: { id: `${peer}/${da}`, delta: { add: { time: null, essay: {
      content: [{ inline: [`${marker}-${label}`] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null,
    } } } },
  })
}
const dmAnswered = async (label) => Object.values((await scry(`chat/v4/dm/${ship}/writs/newest/64/light`, true))?.writs || {})
  .some((post) => authorShip(post.essay?.author) === ship && JSON.stringify(post.essay.content).includes(`${marker}-answer`))
  && seen(label)
// A message the bot ignores reaches it but never the model.
async function ignored(label, arrived) {
  await until(`${label} arrived at the bot`, arrived)
  await sleep(4000)
  assert.ok(!seen(label), `${label} reached the model`)
  console.log(`PASS ${label} ignored`)
}
const posted = (nest, label) => async () => JSON.stringify(await scry(`channels/v5/${nest}/posts/newest/32/post`)).includes(`${marker}-${label}`)
const grants = async () => (await client.call('harness/tlon')).policy
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  policy = (await client.call('harness/tlon')).policy
  defaults = await client.call('harness/defaults')
  await client.call('harness/defaults/configure', { config: { ...defaults, url: `http://127.0.0.1:${server.address().port}`, model: 'place-fixture', key: '', headers: [], tools: [] } })
  assert.ok(!(await groups(true))[group], 'Fixture group must not exist')
  created = true
  const response = await fetch(`${process.env.PEER_URL}/spider/groups/group-create-thread/group-create-1/group-ui-2.json`, {
    method: 'POST', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ groupId: group, meta: { title: slug }, guestList: [], channels: [] }), signal: AbortSignal.timeout(30000),
  })
  assert.ok(response.ok, `create group: HTTP ${response.status}`)
  await until('fixture group created', async () => (await groups(true))[group])
  for (const name of ['a', 'b']) {
    await poke('channels', 'channel-action-2', { create: {
      kind: 'chat', name: `${slug}-${name}`, group, title: name, description: '', meta: null, readers: [], writers: [],
    } })
  }
  await until('fixture channels created', async () => Object.keys((await groups(true))[group].channels).length === 2)
  await poke('groups', 'group-action-4', { group: { flag: group, 'a-group': { entry: { privacy: 'public' } } } })
  await until('fixture group made public', async () => (await groups(true))[group].admissions.privacy === 'public')
  // Leave any DM an earlier script accepted, so the peer's next message is a pending invitation.
  if ((await dms('dm')).includes(peer)) {
    await client.pokeAgent('chat', 'chat-dm-rsvp', { ship: peer, ok: false })
    await until('an earlier DM with the peer left', async () => !(await dms('dm')).includes(peer))
  }

  // A grant for one channel gives no right to add the bot to a group.
  await configure({ channelGrants: [{ channel: roomA, ships: [peer] }] })
  await poke('groups', 'group-action-4', { invite: { flag: group, ships: [ship], 'a-invite': { token: null, note: null } } })
  await until('the invitation reached the bot', async () => JSON.stringify(await scry('groups/v1/foreigns') ?? {}).includes(slug))
  await sleep(4000)
  assert.ok(!(await groups())[group], 'the bot joined a group on the invitation of a ship with a per-place grant')
  assert.ok(!(await client.call('harness/tlon')).events.some((notice) => notice.kind === 'group-invite' && notice.actor === peer))
  console.log('PASS a per-place grant does not make the bot accept a group invitation')

  // The owner adds the bot to the group.
  await client.pokeAgent('groups', 'group-join', { flag: group, 'join-all': true })
  await until('the bot joined both channels', async () => await joined(roomA) && await joined(roomB), 90000)

  // A ship granted one channel is answered there and ignored in another and in DMs.
  await mention(roomA, 'channel-a')
  await until('a ship granted channel A is answered there', async () => await answered(roomA) && seen('channel-a'))
  await mention(roomB, 'channel-b')
  await ignored('a mention in channel B from a ship granted channel A', posted(roomB, 'channel-b'))
  await dm('dm-before')
  await ignored('a DM from a ship granted channel A', async () => (await dms('dm/invited')).includes(peer))
  assert.ok((await dms('dm/invited')).includes(peer), 'a channel grant accepted the DM invitation')
  assert.ok(!(await dms('dm')).includes(peer))
  console.log('PASS a ship granted one channel is answered there and ignored in another channel and in DMs')

  // A DM grant accepts the pending invitation and is answered there, not in channels.
  await configure({ dmGrants: [peer] })
  await until('a DM grant accepts the pending invitation', async () => (await dms('dm')).includes(peer) && !(await dms('dm/invited')).includes(peer))
  await dm('dm-granted')
  await until('a ship granted its DM is answered there', () => dmAnswered('dm-granted'))
  assert.ok(!seen('dm-before'), 'a DM sent before the DM grant was answered')
  await mention(roomA, 'channel-a-dm-only')
  await ignored('a mention in channel A from a ship granted only its DM', posted(roomA, 'channel-a-dm-only'))
  console.log('PASS a ship granted its DM is answered there and ignored in channels')

  // Leaving a channel removes its grants; joining again finds none.
  await configure({ dmGrants: [peer], channelGrants: [{ channel: roomB, ships: [peer] }] })
  await client.pokeAgent('channels', 'channel-action-2', { channel: { nest: roomB, action: { leave: null } } })
  await until('the bot left channel B', async () => !(await joined(roomB)))
  await until('leaving channel B removes its grants', async () => (await grants()).channelGrants.length === 0)
  assert.deepEqual((await grants()).dmGrants, [peer], 'leaving a channel kept the DM grant')
  await client.pokeAgent('channels', 'channel-action-2', { channel: { nest: roomB, action: { join: group } } })
  await until('the bot joined channel B again', () => joined(roomB), 90000)
  assert.deepEqual((await grants()).channelGrants, [], 'joining again restored a grant')
  await mention(roomB, 'channel-b-rejoined')
  await ignored('a mention in channel B after the bot left and joined it again', posted(roomB, 'channel-b-rejoined'))
  console.log('PASS leaving a channel removes its grants, and joining it again finds none')
} finally {
  try {
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
