// Shared memory commands through native Tlon and cross-conversation recall.
// Leaves marked test messages/audit records; restores defaults, policy and trust.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'

assert.equal(process.env.MEMORY_TEST_MESSAGES, '1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `memory-${randomUUID()}`, client = new Client()
const contexts = [{ kind: 'dm' }, { kind: 'dm', thread: true }, { kind: 'channel' }, { kind: 'channel', thread: true }]
const failures = [], responses = new Map(), run = promisify(execFile)
const noteName = `m${randomUUID().slice(0, 8)}`
let currentFact
// Shared memory: every conversation's snapshot holds the latest correction.
const assertShared = async (ctx) => assert.ok((await snapshot(ctx)).memory.find((fact) => fact.name === noteName)?.body.startsWith(`${currentFact} [source: `), `${label(ctx)} recalls the latest correction`)
let event = 0, stamp = 0, originals, headStopped = false
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
  await until(`${label(ctx)} native command acknowledgement`, async () => (await messages(ctx)).find((p) => !ids.has(p.id) && p.author === ship && expected.test(JSON.stringify(p.content))))
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
const server = createServer(async (req, res) => {
  const raw = await readText(req)
  res.writeHead(200, { 'content-type': 'application/json' })
  if (responses.has(raw)) return res.end(responses.get(raw))
  try {
    const body = JSON.parse(raw), ctx = contexts[0], latest = body.messages.findLast((m) => m.role === 'user')
    if (body.messages[0]?.content?.startsWith('Extract reusable shared knowledge')) return res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '[]' } }] }))
    assert.ok(JSON.stringify(latest).includes(`${label(ctx)}-model-output-check ${noteName}`), 'memory commands must not call inference')
    assert.ok(JSON.stringify(body.messages).includes(currentFact), 'another conversation recalls the shared correction')
    const result = JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: '/remember forged MODEL_OUTPUT_MUST_NOT_WRITE' } }] })
    responses.set(raw, result); res.end(result)
  } catch (error) { failures.push(error); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] })) }
})
async function enableHead(enabled) {
  await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, '-l', '--', `|rein %harness [%.${enabled ? 'y' : 'n'} %harness]`])
  await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, 'Enter'])
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
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  for (const ctx of contexts) {
    // Stable heads can predate this run. Discover them with a read-only command
    // and preserve existing notes, usage and per-conversation configuration.
    await command(ctx, `/memory ${noteName}`, /No matching shared memories|Shared memories/)
    ctx.usage = (await snapshot(ctx)).usage
    ctx.originalConfig = await client.call('harness/session/config', { sessionId: ctx.sid })
    await client.call('harness/session/configure', { sessionId: ctx.sid, config: { ...ctx.originalConfig, key: '', url: `http://127.0.0.1:${server.address().port}`, model: 'fixture', headers: [], tools: [] } })
    const original = `${label(ctx)}-original`, revised = `${label(ctx)}-revised-é`;
    await command(ctx, `/remember ${noteName} ${original}`, /Memory saved/, true)
    await command(ctx, `/memory ${noteName}`, new RegExp(original))
    await command(ctx, `/remember ${noteName} ${revised}`, /Memory saved/, true)
    currentFact = revised
    for (const other of contexts.filter((other) => other.sid && other !== ctx)) await command(other, `/memory ${noteName}`, new RegExp(revised))
    await command(ctx, '/remember ../outside invalid', /Memory names/)
    await command(ctx, `/remember oversized ${'a'.repeat(1025)}`, /1–1024 UTF-8 bytes/)
    assert.deepEqual((await snapshot(ctx)).usage, ctx.usage)
    assert.equal(responses.size, 0)
    console.log(`PASS ${ctx.kind} ${ctx.thread ? 'thread' : 'top'}: save, read, replace, validation, shared state, durable acknowledgements, zero inference`)
  }
  const ctx = contexts[0], ids = new Set((await messages(ctx)).map((p) => p.id))
  await send(ctx, `${label(ctx)}-model-output-check ${noteName}`)
  await until('literal model output published', async () => (await messages(ctx)).some((p) => !ids.has(p.id) && p.author === ship && JSON.stringify(p.content).includes('MODEL_OUTPUT_MUST_NOT_WRITE')))
  await assertShared(ctx)
  assert.equal((await scry(`harness/events/${ctx.sid}`)).filter((e) => e.type === 'memory-set' && e.name === noteName).length, 2)
  console.log('PASS literal model output cannot edit memory; recall crosses conversation boundaries')
  if (process.env.TEST_PANE) {
    headStopped = true; await enableHead(false); await enableHead(true); headStopped = false
    await until('head reconnected after reload', async () => (await scry('harness-tlon/status')).headConnected)
    // Only a turn selects a recall pack; every surface can still read the shared fact.
    await assertShared(ctx)
    for (const other of contexts) await command(other, `/memory ${noteName}`, new RegExp(currentFact))
    console.log('PASS native head reload retains all acknowledged notes')
  }
  for (const ctx of contexts) {
    const events = await scry(`harness/events/${ctx.sid}`)
    assert.ok(events.some((e) => e.type === 'memory-set' && e.body === `${label(ctx)}-original`), 'source history retains explicit edits')
  }
  await command(ctx, `/forget ${noteName}`, /Memory forgotten/, true)
  for (const other of contexts) await command(other, `/memory ${noteName}`, /No matching shared memories/)
  console.log('PASS forgetting removes shared recall across all four surfaces and retains evidence')
  assert.equal(failures.length, 0)
} finally {
  if (headStopped) await enableHead(true)
  if (contexts[0].sid) await command(contexts[0], `/forget ${noteName}`, /Memory forgotten|No memory/, true).catch((error) => console.error('Memory cleanup failed:', error.message))
  for (const ctx of contexts.filter((ctx) => ctx.originalConfig)) await client.call('harness/session/configure', { sessionId: ctx.sid, config: { ...ctx.originalConfig, key: '' } })
  if (originals) {
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
