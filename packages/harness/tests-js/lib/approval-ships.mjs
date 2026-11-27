// Three real ships for the approval command scripts: this ship is the bot, the peer
// (PEER_URL, PEER_COOKIE) and the guest (GUEST_URL, GUEST_COOKIE) the owner and the ship
// that asks, in either role. TEST_NEST is a channel on the peer that the bot and the
// guest have joined. A local provider answers every turn with `<marker>-answer` and
// keeps each request it was sent.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { text as readText } from 'node:stream/consumers'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base, readCookie } from './ship-client.mjs'
import { authorShip } from './author.mjs'

const name = (auth) => auth.split('=')[0].slice('urbauth-'.length)

export async function approvalShips(marker) {
  const nest = process.env.TEST_NEST
  assert.ok(nest && process.env.PEER_URL && process.env.PEER_COOKIE && process.env.GUEST_URL && process.env.GUEST_COOKIE,
    'Set TEST_NEST, PEER_URL, PEER_COOKIE, GUEST_URL and GUEST_COOKIE')
  const bot = { url: base, cookie, ship: name(cookie) }
  const peer = { url: process.env.PEER_URL, cookie: await readCookie(process.env.PEER_COOKIE) }
  const guest = { url: process.env.GUEST_URL, cookie: await readCookie(process.env.GUEST_COOKIE) }
  peer.ship = name(peer.cookie); guest.ship = name(guest.cookie)
  assert.equal(new Set([bot.ship, peer.ship, guest.ship]).size, 3, 'The bot, peer and guest are three ships')
  const client = new Client(), prompts = []
  const server = createServer(async (req, res) => {
    prompts.push(await readText(req))
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: `${marker}-answer` } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
  })
  let event = 0, defaults, policy
  const da = (ms) => ((BigInt(ms) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n
  const after = (id, start) => BigInt(id.split('/').at(-1).replaceAll('.', '')) > start
  async function scry(who, path) {
    const response = await fetch(`${who.url}/~/scry/${path}.json`, { headers: { cookie: who.cookie }, signal: AbortSignal.timeout(15000) })
    // A DM that has never had a message has no page yet.
    if (response.status === 404) return null
    assert.ok(response.ok, `${path}: HTTP ${response.status}`)
    return response.json()
  }
  async function poke(who, app, mark, json) {
    const response = await fetch(`${who.url}/~/channel/${marker}-${who.ship.slice(1)}`, {
      method: 'PUT', headers: { cookie: who.cookie, 'content-type': 'application/json' },
      body: JSON.stringify([{ id: ++event, action: 'poke', ship: who.ship.slice(1), app, mark, json }]),
      signal: AbortSignal.timeout(15000),
    })
    assert.ok(response.ok, `${app} poke as ${who.ship}: HTTP ${response.status}`)
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
  // A DM post from .who to .to, with an optional blob.
  async function dm(who, to, text, blob = null) {
    const id = da(Date.now()).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
    await poke(who, 'chat', 'chat-dm-action-2', { ship: to.ship, diff: { id: `${who.ship}/${id}`, delta: { add: { time: null, essay: {
      content: [{ inline: [text] }], author: who.ship, sent: Date.now(), kind: '/chat', meta: null, blob,
    } } } } })
  }
  // A post in TEST_NEST from .who that mentions the bot, or does not.
  async function post(who, text, mention = true) {
    await poke(who, 'channels', 'channel-action-1', { channel: { nest, action: { post: { add: {
      content: [{ inline: [...(mention ? [{ ship: bot.ship }, ' '] : []), text] }], author: who.ship, sent: Date.now(), kind: '/chat', meta: null, blob: null,
    } } } } })
  }
  // A post's text, with a ship it mentions written as the ship's name.
  const words = (post) => (post?.essay?.content ?? []).flatMap((verse) => verse.inline || [])
    .map((item) => typeof item === 'string' ? item : item.ship ?? JSON.stringify(item)).join('')
  // The bot's posts since .start in its DM with .partner, and in TEST_NEST.
  const dmFromBot = async (partner, start) => Object.values((await scry(bot, `chat/v4/dm/${partner.ship}/writs/newest/64/light`))?.writs || {})
    .filter((post) => authorShip(post.essay?.author) === bot.ship && after(post.seal.id, start))
  const channelFromBot = async (start) => Object.entries((await scry(bot, `channels/v5/${nest}/posts/newest/64/post`))?.posts || {})
    .filter(([id, post]) => authorShip(post?.essay?.author) === bot.ship && after(id, start)).map(([, post]) => post)
  const status = () => client.call('harness/tlon')
  const configure = (owner) => client.call('harness/tlon/configure', {
    enabled: true, owner: owner.ship, response: 'mentions', allowed: [], channels: [], trusted: [], dmGrants: [], channelGrants: [],
  })
  const seen = (text) => prompts.some((prompt) => prompt.includes(text))
  // The bot's DMs with the guest start over, so its first message is a fresh invitation.
  async function forget(who) {
    for (const path of ['dm', 'dm/invited']) {
      if ((await scry(bot, `chat/${path}`)).includes(who.ship)) {
        await client.pokeAgent('chat', 'chat-dm-rsvp', { ship: who.ship, ok: false })
        await until(`the bot's earlier ${path} with ${who.ship} cleared`, async () => !(await scry(bot, `chat/${path}`)).includes(who.ship))
      }
    }
  }
  async function start() {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    await client.start()
    policy = (await status()).policy
    defaults = await client.call('harness/defaults')
    await client.call('harness/defaults/configure', { config: { ...defaults, url: `http://127.0.0.1:${server.address().port}`, model: 'approval-fixture', key: '', headers: [], tools: [] } })
  }
  async function stop() {
    try {
      if (defaults) await client.call('harness/defaults/configure', { config: { ...defaults, key: '' } })
    } finally {
      try {
        if (policy) await client.call('harness/tlon/configure', policy)
      } finally {
        await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
      }
    }
  }
  return {
    nest, bot, peer, guest, client, prompts, da, scry, poke, until, dm, post, words, dmFromBot, channelFromBot,
    status, configure, seen, forget, start, stop,
  }
}
