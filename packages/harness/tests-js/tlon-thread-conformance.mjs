// Native Harness settings and exact-thread history/reaction fixtures.
// Restores test-ship settings and original native trust memberships.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

assert.equal(process.env.THREAD_TEST_TRUST, '1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST, extra = '~bud'
assert.ok(peerUrl && nest && process.env.PEER_COOKIE)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `thread-${randomUUID()}`, client = new Client()
let mode = 'root', surface = 'dm', event = 0, originals, targetId, parentId, unrelatedId
const failures = []
async function until(label, check) {
  const end = Date.now() + 45000
  while (Date.now() < end) {
    if (failures.length) throw new AggregateError(failures)
    const value = await check(); if (value) { console.log(`PASS ${label}`); return value }
    await sleep(200)
  }
  throw new Error(`Timed out: ${label}`)
}
async function scry(path, remote = false) {
  const r = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, { headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(r.ok, `scry ${path}: ${r.status}`); return r.json()
}
const page = () => scry(surface === 'dm' ? `chat/v4/dm/${ship}/writs/newest/32/heavy` : `channels/v5/${nest}/posts/newest/32/post`, true)
const posts = async () => { const p = await page(); return Object.entries(p.writs || p.posts) }
const matches = (essay, suffix) => essay?.author === ship && JSON.stringify(essay.content).includes(`${marker}-${surface}-${suffix}`)
async function target() {
  const post = (await posts()).find(([key, p]) => surface === 'dm' ? p.seal.id === parentId : key === parentId)?.[1]
  return Object.values(post?.seal?.replies || {}).find((r) => r['reply-essay']?.author === peer && JSON.stringify(r['reply-essay'].content).includes(`${marker}-${surface}-thread`))
}
const server = createServer(async (req, res) => {
  function answer(content, name, args = {}) {
    const message = name ? { role: 'assistant', content: '', tool_calls: [{ id: `call-${randomUUID()}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }] } : { role: 'assistant', content }
    res.end(JSON.stringify({ choices: [{ finish_reason: name ? 'tool_calls' : 'stop', message }] }))
  }
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    const done = body.messages.slice(last + 1).filter((m) => m.role === 'tool')
    res.writeHead(200, { 'content-type': 'application/json' })
    if (mode !== 'thread') return answer(`${marker}-${surface}-${mode}`)
    if (!done.length) return answer('', 'tlon_read_history', { ship: '~zod', parent_id: unrelatedId })
    if (done.length === 1) {
      const history = JSON.parse(done[0].content)
      assert.ok(history.length >= 2 && history.length <= 20)
      assert.ok(history[0].text.includes(`${marker}-${surface}-root`))
      assert.ok(!history.some((r) => r.text.includes(`${marker}-${surface}-outside`)))
      const row = history.findLast((r) => r.author === peer && r.text.includes(`${marker}-${surface}-thread`))
      assert.ok(row, 'current reply is in the exact bound thread')
      targetId = row.message_id
      return answer('', 'tlon_react', { message_id: targetId, emoji: '👍' })
    }
    if (done.length === 2) {
      assert.match(done.at(-1).content, /^accepted:/)
      await until(`${surface} native reaction targets the reply`, async () => JSON.stringify((await target())?.seal?.reacts || {}).includes('👍'))
      return answer('', 'tlon_unreact', { message_id: targetId })
    }
    if (done.length === 3) {
      assert.match(done.at(-1).content, /^accepted:/)
      await until(`${surface} native reply reaction removed`, async () => !JSON.stringify((await target())?.seal?.reacts || {}).includes('👍'))
      return answer('', 'tlon_react', { message_id: unrelatedId, emoji: '👍' })
    }
    assert.match(done.at(-1).content, /^error:/)
    return answer(`${marker}-${surface}-thread-done`)
  } catch (error) { failures.push(error); answer('FIXTURE_ERROR') }
})
const da = () => (((BigInt(Date.now()) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
async function send(parent) {
  const content = [{ inline: [...(surface === 'channel' && !parent ? [{ ship }] : []), `${marker}-${surface}-${mode}`] }]
  const essay = { content, author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null }
  const reply = { content, author: peer, sent: Date.now(), blob: null }
  const json = surface === 'channel' ? { channel: { nest, action: { post: parent ? { reply: { id: parent, action: { add: reply } } } : { add: essay } } } }
    : { ship, diff: { id: parent || `${peer}/${da()}`, delta: parent ? { reply: { id: `${peer}/${da()}`, meta: null, delta: { add: { 'reply-essay': reply, time: null } } } } : { add: { essay, time: null } } } }
  const r = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app: surface === 'channel' ? 'channels' : 'chat', mark: surface === 'channel' ? 'channel-action-2' : 'chat-dm-action-2', json }]) })
  assert.ok(r.ok)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await client.call('harness/tlon')).policy }
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '', url: `http://127.0.0.1:${server.address().port}`, model: 'fixture', headers: [], tools: [] } })
  const policy = { enabled: true, owner: peer, trusted: [{ ship: extra, tools: [] }], response: 'mentions', allowed: [], channels: [] }
  await client.call('harness/tlon/configure', policy)
  for (surface of ['dm', 'channel']) {
    mode = 'root'; await send()
    const root = await until(`${surface} parent established`, async () => (await posts()).find(([, p]) => matches(p.essay, mode)))
    parentId = surface === 'dm' ? root[1].seal.id : root[0]
    mode = 'outside'; await send()
    const outside = await until(`${surface} unrelated message established`, async () => (await posts()).find(([, p]) => matches(p.essay, mode)))
    unrelatedId = surface === 'dm' ? outside[1].seal.id : outside[0]
    mode = 'thread'; await send(parentId)
    await until(`${surface} thread history and scoped reactions complete`, async () => (await posts()).some(([, p]) => Object.values(p.seal?.replies || {}).some((r) => matches(r['reply-essay'], 'thread-done'))))
    const saved = (await client.call('harness/tlon')).sessions
    await client.call('harness/tlon/configure', policy)
    assert.deepEqual((await client.call('harness/tlon')).sessions, saved)
  }
} finally {
  if (originals) {
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
