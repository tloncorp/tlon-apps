// Memory commands through native Tlon: the owner's DM sees every fact, a
// channel sees only what channels learned, and recall follows the same rule.
// Leaves marked test messages/audit records; restores defaults, policy and trust.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { rein } from './lib/ship-thread.mjs'
import { authorShip, assertBotAuthor } from './lib/author.mjs'

assert.equal(process.env.MEMORY_TEST_MESSAGES, '1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `memory-${randomUUID()}`, client = new Client()
const contexts = [{ kind: 'dm' }, { kind: 'dm', thread: true }, { kind: 'channel' }, { kind: 'channel', thread: true }]
const [dm, dmThread, channel, channelThread] = contexts, owned = [dm, dmThread], shared = [channel, channelThread]
const failures = [], requests = []
const privateName = `p${randomUUID().slice(0, 8)}`, sharedName = `s${randomUUID().slice(0, 8)}`
const absent = /No matching shared memories/, unavailable = /That memory name is not available/
let event = 0, stamp = 0, originals, headStopped = false, privateFact, sharedFact
const label = (ctx) => `${marker}-${ctx.kind}-${ctx.thread ? 'thread' : 'top'}`
const snapshot = (ctx) => client.call('harness/session/snapshot', { sessionId: ctx.sid })
async function scry(path, remote = false) {
  const r = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, { headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(r.ok, `${path}: ${r.status}`); return r.json()
}
async function until(description, check) {
  const end = Date.now() + 60000
  while (Date.now() < end) {
    if (failures.length) throw new AggregateError(failures)
    const value = await check(); if (value) return value
    await sleep(150)
  }
  throw new Error(`Timed out: ${description}`)
}
async function posts(ctx, remote = true) {
  const p = await scry(ctx.kind === 'dm' ? `chat/v4/dm/${remote ? ship : peer}/writs/newest/100/heavy` : `channels/v5/${nest}/posts/newest/100/post`, remote)
  return Object.entries(p.writs || p.posts)
}
async function messages(ctx) {
  const rows = await posts(ctx)
  if (!ctx.parent) return rows.map(([id, p]) => ({ id, ...p.essay }))
  const p = rows.find(([key, p]) => (ctx.kind === 'dm' ? p.seal.id : key) === ctx.parent)?.[1]
  return Object.entries(p?.seal?.replies || {}).map(([id, p]) => ({ id, ...p['reply-essay'] }))
}
async function send(ctx, text) {
  stamp = Math.max(Date.now(), stamp + 1)
  const da = (((BigInt(stamp) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const content = [{ inline: [...(ctx.kind === 'channel' ? [{ ship }, ' '] : []), text] }]
  const reply = { content, author: peer, sent: stamp, blob: null }, essay = { ...reply, kind: '/chat', meta: null }
  const json = ctx.kind === 'channel' ? { channel: { nest, action: { post: ctx.parent ? { reply: { id: ctx.parent, action: { add: reply } } } : { add: essay } } } }
    : { ship, diff: { id: ctx.parent || `${peer}/${da}`, delta: ctx.parent ? { reply: { id: `${peer}/${da}`, meta: null, delta: { add: { 'reply-essay': reply, time: null } } } } : { add: { essay, time: null } } } }
  const r = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app: ctx.kind === 'channel' ? 'channels' : 'chat', mark: ctx.kind === 'channel' ? 'channel-action-2' : 'chat-dm-action-2', json }]), signal: AbortSignal.timeout(15000) })
  assert.ok(r.ok)
}
async function command(ctx, text, expected, mutation = false) {
  const ids = new Set((await messages(ctx)).map((p) => p.id))
  const oldSessions = new Set((await client.call('harness/tlon')).sessions)
  const before = ctx.sid ? await scry(`harness/events/${ctx.sid}`) : null
  await send(ctx, text)
  const ack = await until(`${label(ctx)} native command acknowledgement`, async () => (await messages(ctx)).find((p) => !ids.has(p.id) && authorShip(p.author) === ship && expected.test(JSON.stringify(p.content))))
  assertBotAuthor(ack.author, ship)
  if (!ctx.sid) ctx.sid = await until('new scoped session', async () => (await client.call('harness/tlon')).sessions.find((sid) => !oldSessions.has(sid)))
  const snap = await snapshot(ctx), after = await scry(`harness/events/${ctx.sid}`)
  if (before) {
    assert.equal(after.filter((e) => e.type === 'command-completed').length, before.filter((e) => e.type === 'command-completed').length + 1)
    assert.equal(after.filter((e) => e.type === 'memory-set').length, before.filter((e) => e.type === 'memory-set').length + Number(mutation))
    assert.equal(after.filter((e) => e.type === 'llm-requested').length, before.filter((e) => e.type === 'llm-requested').length, 'commands do not request inference')
  }
  assert.match(snap.entries.at(-1).body, expected)
  return after
}
// The model only records what each turn was given; its reply tries to edit memory.
const server = createServer(async (req, res) => {
  const raw = await readText(req)
  res.writeHead(200, { 'content-type': 'application/json' })
  try {
    const body = JSON.parse(raw)
    if (body.messages[0]?.content?.startsWith('Extract reusable shared knowledge')) return res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '[]' } }] }))
    requests.push(body.messages)
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '/remember forged MODEL_OUTPUT_MUST_NOT_WRITE' } }] }))
  } catch (error) { failures.push(error); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] })) }
})
// One ordinary message in ctx; the recalled-memory message the model received
// for it, not the transcript, which earlier commands already filled.
async function turn(ctx) {
  const check = `${label(ctx)}-model-output-check ${privateName} ${sharedName}`, ids = new Set((await messages(ctx)).map((p) => p.id))
  await send(ctx, check)
  await until(`${label(ctx)} literal model output published`, async () => (await messages(ctx)).some((p) => !ids.has(p.id) && authorShip(p.author) === ship && JSON.stringify(p.content).includes('MODEL_OUTPUT_MUST_NOT_WRITE')))
  const request = requests.findLast((r) => JSON.stringify(r).includes(check))
  assert.ok(request, `${label(ctx)} reached the model`)
  const text = (m) => typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
  return request.map(text).find((t) => t.startsWith('Relevant shared memories')) ?? ''
}
const reads = async (ctxs, name, expected) => { for (const ctx of ctxs) await command(ctx, `/memory ${name}`, expected) }
async function enableHead(enabled) {
  await rein(process.env.SHIP_PIER, 'harness', 'harness', enabled)
  await sleep(1000)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await client.call('harness/tlon')).policy }
  await client.call('harness/tlon/configure', { ...originals.policy, enabled: false })
  for (const ctx of contexts.filter((ctx) => ctx.thread)) {
    await send(ctx, `${label(ctx)}-parent`)
    const p = await until('native thread parent', async () => (await posts(ctx)).find(([, p]) => JSON.stringify(p.essay?.content).includes(`${label(ctx)}-parent`)))
    ctx.parent = ctx.kind === 'dm' ? p[1].seal.id : p[0]
    await until('parent received before activation', async () => (await posts(ctx, false)).some(([, p]) => JSON.stringify(p.essay?.content).includes(`${label(ctx)}-parent`)))
  }
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '', url: `http://127.0.0.1:${server.address().port}`, model: 'fixture', headers: [], tools: [] } })
  // The peer owns the bot: its DM is the owner's private conversation.
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  for (const ctx of contexts) {
    // Stable heads can predate this run. Discover them with a read-only command
    // and preserve existing notes, usage and per-conversation configuration.
    await command(ctx, `/memory ${privateName}`, absent)
    ctx.usage = (await snapshot(ctx)).usage
    ctx.originalConfig = await client.call('harness/session/config', { sessionId: ctx.sid })
    await client.call('harness/session/configure', { sessionId: ctx.sid, config: { ...ctx.originalConfig, key: '', url: `http://127.0.0.1:${server.address().port}`, model: 'fixture', headers: [], tools: [] } })
    await command(ctx, '/remember ../outside invalid', /Memory names/)
    await command(ctx, `/remember oversized ${'a'.repeat(1025)}`, /1–1024 UTF-8 bytes/)
  }

  await command(dm, `/remember ${privateName} ${label(dm)}-original`, /Memory saved\.(?! It is now private)/, true)
  await command(dm, `/memory ${privateName}`, new RegExp(`${label(dm)}-original`))
  privateFact = `${label(dmThread)}-revised-é`
  await command(dmThread, `/remember ${privateName} ${privateFact}`, /Memory saved/, true)
  await reads(owned, privateName, new RegExp(privateFact))
  await reads(shared, privateName, absent)
  await command(channel, `/remember ${privateName} ${label(channel)}-overwrite`, unavailable)
  await command(channelThread, `/forget ${privateName}`, unavailable)
  console.log('PASS a fact saved in the owner\'s DM is read in its threads and refused in channels')

  await command(channel, `/remember ${sharedName} ${label(channel)}-original`, /Memory saved/, true)
  sharedFact = `${label(channelThread)}-revised`
  await command(channelThread, `/remember ${sharedName} ${sharedFact}`, /Memory saved/, true)
  await reads(contexts, sharedName, new RegExp(sharedFact))
  for (const ctx of contexts) assert.deepEqual((await snapshot(ctx)).usage, ctx.usage, 'commands do not request inference')
  console.log('PASS a fact saved in a channel is read in every conversation')

  const dmRequest = await turn(dm), channelRequest = await turn(channel)
  assert.ok(dmRequest.includes(privateFact) && dmRequest.includes(sharedFact), 'the owner\'s DM recalls private and channel facts')
  assert.ok(channelRequest.includes(sharedFact), 'a channel recalls channel facts')
  assert.ok(!channelRequest.includes(privateFact), 'the owner\'s own channel message does not recall a private fact')
  assert.ok(!JSON.stringify(requests.findLast((r) => JSON.stringify(r).includes(`${label(channel)}-model-output-check`))).includes(privateFact), 'no part of the channel request holds the private fact')
  for (const ctx of [dm, channel]) assert.equal((await scry(`harness/events/${ctx.sid}`)).filter((e) => e.type === 'memory-set' && e.name === 'forged').length, 0)
  console.log('PASS recall follows the rule; literal model output cannot edit memory')

  sharedFact = `${label(dm)}-made-private`
  await command(dm, `/remember ${sharedName} ${sharedFact}`, /now private/, true)
  await reads(owned, sharedName, new RegExp(sharedFact))
  await reads(shared, sharedName, absent)
  await command(channel, `/remember ${sharedName} ${label(channel)}-again`, unavailable)
  console.log('PASS an owner\'s DM edit makes a channel fact private and says so')

  if (process.env.SHIP_PIER) {
    headStopped = true; await enableHead(false); await enableHead(true); headStopped = false
    await until('head reconnected after reload', async () => (await scry('harness-tlon/status')).headConnected)
    await reads(owned, privateName, new RegExp(privateFact))
    await reads(shared, privateName, absent)
    console.log('PASS native head reload keeps every fact and its reach')
  }
  for (const [ctx, name] of [[dm, privateName], [channel, sharedName]]) {
    const events = await scry(`harness/events/${ctx.sid}`)
    assert.ok(events.some((e) => e.type === 'memory-set' && e.name === name && e.body === `${label(ctx)}-original`), 'source history retains explicit edits')
  }
  await command(dm, `/forget ${privateName}`, /Memory forgotten/, true)
  await command(dm, `/forget ${sharedName}`, /Memory forgotten/, true)
  for (const name of [privateName, sharedName]) await reads(contexts, name, absent)
  console.log('PASS forgetting removes recall in every conversation and retains evidence')
  assert.equal(failures.length, 0)
} finally {
  if (headStopped) await enableHead(true)
  for (const name of [privateName, sharedName]) if (dm.sid) await command(dm, `/forget ${name}`, /Memory forgotten|No memory/, true).catch((error) => console.error('Memory cleanup failed:', error.message))
  for (const ctx of contexts.filter((ctx) => ctx.originalConfig)) await client.call('harness/session/configure', { sessionId: ctx.sid, config: { ...ctx.originalConfig, key: '' } })
  if (originals) {
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
