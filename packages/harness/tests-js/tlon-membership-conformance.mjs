// Two disposable fake ships. Owner invitation followed by a later reader role.
// No model calls; seeds one fixture post, restores policy and deletes its group.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

assert.ok(process.env.PEER_COOKIE && process.env.PEER_URL, 'Set PEER_COOKIE and PEER_URL')
const fields = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((line) => /\turbauth-~/.test(line)).split('\t')
const peer = fields[5].slice('urbauth-'.length), peerCookie = `${fields[5]}=${fields[6]}`
const ship = cookie.split('=')[0].slice('urbauth-'.length)
assert.ok(['~lux', '~nec', '~bud', '~zod'].includes(ship) && ['~lux', '~nec', '~bud', '~zod'].includes(peer) && ship !== peer)
const slug = `membership-${randomUUID().slice(0, 8)}`, group = `${peer}/${slug}`
const main = `chat/${peer}/${slug}-main`, lobby = `chat/${peer}/${slug}-lobby`, privateChat = `chat/${peer}/${slug}-private`
const client = new Client()
let policy, created = false, event = 0
async function scry(path, remote = false) {
  const response = await fetch(`${remote ? process.env.PEER_URL : base}/~/scry/${path}.json`, {
    headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000),
  })
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
const action = (value) => poke('groups', 'group-action-4', { group: { flag: group, 'a-group': value } })
const role = (who, name, add = true) => action({ seat: { ships: [who], 'a-seat': { [add ? 'add-roles' : 'del-roles']: [name] } } })
const groups = (remote = false) => scry('groups/v2/groups', remote)
const active = async (nest) => Object.hasOwn(await scry('channels/v4/channels'), nest)
async function until(label, check) {
  const end = Date.now() + 90000
  while (Date.now() < end) {
    if (await check()) { console.log(`PASS ${label}`); return }
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
try {
  await client.start()
  policy = (await client.call('harness/tlon')).policy
  await client.call('harness/tlon/configure', { ...policy, enabled: false })
  assert.ok(!(await groups(true))[group], 'Fixture group must not exist')
  created = true
  const response = await fetch(`${process.env.PEER_URL}/spider/groups/group-create-thread/group-create-1/group-ui-2.json`, {
    method: 'POST', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ groupId: group, meta: { title: slug }, guestList: [], channels: [] }),
    signal: AbortSignal.timeout(30000),
  })
  assert.ok(response.ok, `create group: HTTP ${response.status}`)
  await until('fixture group created', async () => (await groups(true))[group])
  for (const name of ['reader', 'private', 'unrelated']) {
    await action({ role: { roles: [name], 'a-role': { add: { title: name, description: '', image: '', cover: '' } } } })
  }
  await until('reader roles created', async () => (await groups(true))[group]?.roles.private)
  for (const [suffix, readers] of [['lobby', []], ['main', ['reader']], ['private', ['private']]]) {
    await poke('channels', 'channel-action-2', { create: {
      kind: 'chat', name: `${slug}-${suffix}`, group, title: suffix,
      description: '', meta: null, readers, writers: [],
    } })
  }
  await until('restricted channels created before invitation', async () => Object.keys((await groups(true))[group].channels).length === 3)
  // Set the native group reader restrictions explicitly; channel creation and
  // group listing registration are separate asynchronous native operations.
  for (const [nest, reader] of [[main, 'reader'], [privateChat, 'private']]) {
    await action({ channel: { nest, 'a-channel': { 'add-readers': [reader] } } })
  }
  await until('native group reader restrictions saved', async () => {
    const state = (await groups(true))[group]
    return state.channels[main].readers.includes('reader') && state.channels[privateChat].readers.includes('private')
  })
  await poke('channels', 'channel-action-2', { channel: { nest: main, action: { post: { add: {
    content: [{ inline: [`${slug}-checkpoint`] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null,
  } } } } })
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  await poke('groups', 'group-action-4', { invite: { flag: group, ships: [ship], 'a-invite': { token: null, note: null } } })
  await until('owner invitation joins the group and open channel', () => active(lobby))
  // Native group log replay can leave denied local channel stubs. Establish
  // the truly unjoined case here; pure tests cover incomplete stub detection.
  // Let the initial native join/checkpoint responses settle before leaving.
  await sleep(1000)
  for (const nest of [main, privateChat]) await client.pokeAgent('channels', 'channel-action-2', { channel: { nest, action: { leave: null } } })
  await until('restricted channels are unjoined before role grant', async () => !(await active(main)) && !(await active(privateChat)))
  assert.equal(await active(main), false)
  assert.equal(await active(privateChat), false)

  await role(peer, 'reader')
  await until('another member role update received', async () => (await groups())[group].seats[peer].roles.includes('reader'))
  assert.equal(await active(main), false, 'Another member role must not authorize our channel join')
  await role(ship, 'reader')
  await until('later reader grant automatically joins main chat', () => active(main))
  await until('native channel subscription receives host content', async () => JSON.stringify(await scry(`channels/v5/${main}/posts/newest/20/post`)).includes(`${slug}-checkpoint`))
  assert.equal(await active(privateChat), false, 'Other restricted channels remain unjoined')

  await client.call('harness/tlon/configure', { enabled: false, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  await role(ship, 'private')
  await until('role granted while hand disabled', async () => (await groups())[group].seats[ship].roles.includes('private'))
  assert.equal(await active(privateChat), false, 'Disabled hand must not join a newly accessible channel')
  await role(ship, 'private', false)
  await until('temporary reader role removed', async () => !(await groups())[group].seats[ship].roles.includes('private'))
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  await role(ship, 'unrelated')
  await until('subsequent self-role update processed', async () => (await groups())[group].seats[ship].roles.includes('unrelated'))
  assert.equal(await active(privateChat), false, 'Removed permissions stay denied on later notifications')
  assert.equal(await active(main), true)
  console.log('PASS owner invitation, delayed read access, native subscription, unrelated actors, disabled hand and revoked access')
} finally {
  try {
    if (policy) await client.call('harness/tlon/configure', { ...policy, enabled: false })
    if (created) {
      if ((await groups())[group]) await client.pokeAgent('groups', 'group-leave', group)
      if ((await groups(true))[group]) await action({ delete: null })
      await until('fixture group deleted', async () => !(await groups(true))[group] && !(await groups())[group])
    }
  } finally {
    try { if (policy) await client.call('harness/tlon/configure', policy) }
    finally { await client.close() }
  }
}
