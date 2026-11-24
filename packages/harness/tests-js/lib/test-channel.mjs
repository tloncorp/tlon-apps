#!/usr/bin/env node
// Make sure the peer hosts the group and channel that TEST_NEST fixtures post in, and
// that this ship has joined it, then print the nest. Safe to run again; these live in
// %groups and %channels, so resetting Harness leaves them in place.
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { cookie, base, readCookie } from './ship-client.mjs'

const peerUrl = process.env.PEER_URL
assert.ok(peerUrl && process.env.PEER_COOKIE, 'Set PEER_URL and PEER_COOKIE')
const peerCookie = await readCookie(process.env.PEER_COOKIE)
const name = (auth) => auth.split('=')[0].slice('urbauth-'.length)
const ship = name(cookie), peer = name(peerCookie)
const slug = 'harness-tests', group = `${peer}/${slug}`, nest = `chat/${peer}/${slug}-chat`

async function request(url, auth, path, init = {}) {
  const response = await fetch(`${url}${path}`, { ...init, headers: { cookie: auth, 'content-type': 'application/json' }, signal: AbortSignal.timeout(30_000) })
  assert.ok(response.ok, `${path}: HTTP ${response.status}`)
  return response
}
const scry = async (url, auth, path) => (await request(url, auth, `/~/scry/${path}.json`)).json()
const poke = (url, auth, who, app, mark, json) => request(url, auth, `/~/channel/test-channel-${Date.now()}`, {
  method: 'PUT', body: JSON.stringify([{ id: 1, action: 'poke', ship: who.slice(1), app, mark, json }]),
})
async function until(label, check) {
  const end = Date.now() + 90_000
  while (Date.now() < end) {
    if (await check()) return
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
const hosted = async () => (await scry(peerUrl, peerCookie, 'groups/v2/groups'))[group]
const joined = async () => Object.hasOwn(await scry(base, cookie, 'channels/v4/channels'), nest)

if (!await hosted()) {
  await request(peerUrl, peerCookie, '/spider/groups/group-create-thread/group-create-1/group-ui-2.json', {
    method: 'POST', body: JSON.stringify({ groupId: group, meta: { title: slug }, guestList: [], channels: [] }),
  })
  await until('group created', hosted)
}
if (!(await hosted()).channels?.[nest]) {
  await poke(peerUrl, peerCookie, peer, 'channels', 'channel-action-2', { create: {
    kind: 'chat', name: `${slug}-chat`, group, title: 'Harness tests', description: '', meta: null, readers: [], writers: [],
  } })
  await until('channel created', async () => (await hosted()).channels?.[nest])
}
if ((await hosted()).admissions.privacy !== 'public') {
  await poke(peerUrl, peerCookie, peer, 'groups', 'group-action-4', { group: { flag: group, 'a-group': { entry: { privacy: 'public' } } } })
  await until('group made public', async () => (await hosted()).admissions.privacy === 'public')
}
if (!await joined()) {
  await poke(base, cookie, ship, 'groups', 'group-join', { flag: group, 'join-all': true })
  await until('channel joined', joined)
}
console.log(nest)
