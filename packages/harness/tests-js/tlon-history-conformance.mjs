// Bounded native pagination/search on DMs, channels and their exact threads.
// Seeds only the designated test conversations; restores policy/defaults/trust.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

assert.equal(process.env.HISTORY_TEST_MESSAGES, '1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `history-${randomUUID()}`, client = new Client()
let surface = 'dm', parent, event = 0, stamp = 0, originals, firstCursor, firstIds, searchCursor, foreignCursor
const failures = []
const insertions = new Map()
const responses = new Map()
const label = () => `${marker}-${surface}-${parent ? 'thread' : 'top'}`
const needle = () => `${label()}-needle`
async function until(description, check) {
  const end = Date.now() + 120000
  while (Date.now() < end) {
    if (failures.length) throw new AggregateError(failures)
    const value = await check(); if (value) { console.log(`PASS ${description}`); return value }
    await sleep(200)
  }
  throw new Error(`Timed out: ${description}`)
}
async function posts() {
  const path = surface === 'dm' ? `chat/v4/dm/${ship}/writs/newest/100/heavy` : `channels/v5/${nest}/posts/newest/100/post`
  const r = await fetch(`${peerUrl}/~/scry/${path}.json`, { headers: { cookie: peerCookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(r.ok); const p = await r.json(); return Object.entries(p.writs || p.posts)
}
async function texts() {
  const rows = await posts()
  if (!parent) return rows.map(([, p]) => p.essay)
  const p = rows.find(([key, p]) => (surface === 'dm' ? p.seal.id : key) === parent)?.[1]
  return Object.values(p?.seal?.replies || {}).map((r) => r['reply-essay'])
}
function action(text, who, replyTo, mention = false) {
  stamp = Math.max(Date.now(), stamp + 1)
  const da = (((BigInt(stamp) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const content = [{ inline: [...(mention && surface === 'channel' ? [{ ship }] : []), text] }]
  const reply = { content, author: who, sent: stamp, blob: null }, essay = { ...reply, kind: '/chat', meta: null }
  return surface === 'channel' ? { channel: { nest, action: { post: replyTo ? { reply: { id: replyTo, action: { add: reply } } } : { add: essay } } } }
    : { ship: who === peer ? ship : peer, diff: { id: replyTo || `${who}/${da}`, delta: replyTo ? { reply: { id: `${who}/${da}`, meta: null, delta: { add: { 'reply-essay': reply, time: null } } } } : { add: { essay, time: null } } } }
}
async function send(text, { bot = false, replyTo = parent, mention = false } = {}) {
  const app = surface === 'channel' ? 'channels' : 'chat', mark = surface === 'channel' ? 'channel-action-2' : 'chat-dm-action-2'
  const json = action(text, bot ? ship : peer, replyTo, mention)
  if (bot) return client.pokeAgent(app, mark, json)
  const r = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app, mark, json }]), signal: AbortSignal.timeout(15000) })
  assert.ok(r.ok)
}
function checked(content) {
  const p = JSON.parse(content)
  assert.ok(p.messages.length <= 20)
  assert.equal(p.text_limit_bytes, 800)
  assert.equal(p.has_more, p.next_cursor !== null)
  if (parent) {
    assert.ok(p.parent.text.includes(`${marker}-${surface}-parent`))
    assert.ok(p.messages.every((r) => r.text.includes(label())), 'thread excludes unrelated posts/replies')
  } else assert.equal(p.parent, null)
  return p
}
const server = createServer(async (req, res) => {
  let complete, requestLabel
  const answer = (name, args = {}, content = `${requestLabel}-done`) => {
    const message = name ? { role: 'assistant', content: '', tool_calls: [{ id: `call-${randomUUID()}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } : { role: 'assistant', content }
    const result = JSON.stringify({ choices: [{ finish_reason: name ? 'tool_calls' : 'stop', message }] })
    complete?.(result); res.end(result)
  }
  try {
    const raw = await readText(req)
    res.writeHead(200, { 'content-type': 'application/json' })
    // Replayed provider requests must get the same call ID and must not rerun
    // assertions against the next fixture conversation's mutable context.
    if (responses.has(raw)) return res.end(await responses.get(raw))
    responses.set(raw, new Promise((resolve) => { complete = resolve }))
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    requestLabel = label()
    if (!JSON.stringify(body.messages[last]).includes(`${requestLabel}-trigger`)) return answer(null, {}, 'Fixture request superseded.')
    const done = body.messages.slice(last + 1).filter((m) => m.role === 'tool')
    switch (done.length) {
      case 0: return answer('tlon_history_page', { cursor: '', ship: '~zod', parent_id: 'unrelated' })
      case 1: {
        const p = checked(done.at(-1).content)
        assert.equal(p.messages.length, 20); assert.ok(p.has_more)
        firstCursor = p.next_cursor; firstIds = new Set(p.messages.map((r) => r.message_id))
        if (!insertions.has(label())) insertions.set(label(), (async () => {
          await send(`${label()}-inserted`, { bot: true })
          await until('new message arrives between pages', async () => (await texts()).some((p) => JSON.stringify(p?.content).includes(`${label()}-inserted`)))
        })())
        await insertions.get(label())
        return answer('tlon_history_page', { cursor: firstCursor })
      }
      case 2: {
        const p = checked(done.at(-1).content)
        assert.equal(p.messages.length, 20)
        assert.ok(p.messages.every((r) => !firstIds.has(r.message_id) && !r.text.includes('-inserted')))
        return answer('tlon_search_history', { query: needle().toUpperCase() })
      }
      case 3: {
        const p = checked(done.at(-1).content)
        assert.equal(p.scanned, 64); assert.equal(p.messages.length, 0); assert.ok(p.has_more)
        searchCursor = p.next_cursor
        return answer('tlon_search_history', { query: needle(), cursor: searchCursor })
      }
      case 4: {
        const p = checked(done.at(-1).content)
        assert.equal(p.messages.length, 1); assert.ok(p.messages[0].text.includes(needle()))
        return answer('tlon_react', { message_id: p.messages[0].message_id, emoji: '👍' })
      }
      case 5:
        assert.match(done.at(-1).content, /^error:/)
        // Do not trip the head's intentional four-consecutive-failures guard.
        return answer('tlon_read_history', {})
      case 6:
        assert.ok(Array.isArray(JSON.parse(done.at(-1).content)))
        return answer('tlon_search_history', { query: `${needle()}-different`, cursor: searchCursor })
      case 7:
        assert.match(done.at(-1).content, /^error:/)
        return answer('tlon_history_page', { cursor: searchCursor })
      case 8:
        assert.match(done.at(-1).content, /^error:/)
        return answer('tlon_history_page', { cursor: foreignCursor || 'invalid' })
      default:
        assert.match(done.at(-1).content, /^error:/)
        foreignCursor = firstCursor
        console.log(`PASS ${surface} ${parent ? 'thread' : 'top'} pagination, search continuation and cursor isolation`)
        return answer()
    }
  } catch (error) { failures.push(error); answer() }
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await client.call('harness/tlon')).policy }
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '', url: `http://127.0.0.1:${server.address().port}`, model: 'fixture', headers: [], tools: [] } })
  for (surface of ['dm', 'channel']) for (const thread of [false, true]) {
    await client.call('harness/tlon/configure', { ...originals.policy, enabled: false })
    parent = undefined
    if (thread) {
      await send(`${marker}-${surface}-parent`)
      const p = await until('thread parent seeded', async () => (await posts()).find(([, p]) => JSON.stringify(p.essay?.content).includes(`${marker}-${surface}-parent`)))
      parent = surface === 'dm' ? p[1].seal.id : p[0]
    }
    for (let i = 0; i < 70; i++) {
      await send(i === 0 ? needle() : `${label()}-seed-${i}`)
      await sleep(10)
    }
    await until('70 native history rows seeded', async () => (await texts()).filter((p) => JSON.stringify(p?.content).includes(label())).length === 70)
    // Policy activation after seeding keeps the 70 fixture posts out of inference.
    await sleep(500)
    await client.call('harness/tlon/configure', { enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
    await send(`${label()}-trigger`, { mention: true })
    await until('history conversation completed', async () => (await texts()).some((p) => p?.author === ship && JSON.stringify(p.content).includes(`${label()}-done`)))
    assert.equal(failures.length, 0)
  }
} finally {
  if (originals) {
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
