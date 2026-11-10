// Real DM/channel threads and native permission edits, with a local provider.
// Keeps marked test evidence; restores Harness policy/defaults.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'

assert.equal(process.env.CONTINUITY_TEST_MESSAGES, '1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST, pane = process.env.TEST_PANE
assert.ok(peerUrl && nest && process.env.PEER_COOKIE && pane)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), extra = '~bud'
const marker = `continuity-${randomUUID()}`, client = new Client(), run = promisify(execFile)
const contexts = [{ kind: 'dm' }, { kind: 'channel' }], held = [], failures = [], children = []
const responses = new Map(), requests = [], note = `c${randomUUID().slice(0, 8)}`
let event = 0, stamp = 0, originals, policy, url, stopped = false, headStopped = false, cron
const tag = (ctx) => `${marker}-${ctx.kind}`
const status = () => client.call('harness/tlon')
const snapshot = (ctx) => client.call('harness/session/snapshot', { sessionId: typeof ctx === 'string' ? ctx : ctx.sid })
const config = async (ctx) => {
  const view = await client.call('harness/session/config', { sessionId: ctx.sid })
  return Object.fromEntries(['url', 'model', 'system', 'tools', 'headers', 'max-context'].map((key) => [key, view[key]]))
}
const configure = async (next) => { policy = next; return client.call('harness/tlon/configure', next) }
const effect = (id) => client.call('harness/hand', { effect: { hand: 'tlon', effect: id } })
const bindingStatus = (binding) => client.call('harness/hand', { status: { binding } })
async function scry(path, remote = false) {
  const r = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, { headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(r.ok, `${path}: ${r.status}`); return r.json()
}
async function until(label, check) {
  const end = Date.now() + 60000
  while (Date.now() < end) {
    if (failures.length) throw new AggregateError(failures)
    const value = await check(); if (value) return value
    await sleep(150)
  }
  throw new Error(`Timed out: ${label}`)
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
async function input(ctx) {
  return (await scry(`harness/events/${ctx.sid}`)).findLast((e) => e.type === 'input' && e.source?.kind === 'hand')
}
async function command(ctx, text, expected) {
  const ids = new Set((await messages(ctx)).map((p) => p.id)), before = new Set((await status()).sessions)
  await send(ctx, text)
  await until('native command acknowledgement', async () => (await messages(ctx)).some((p) => !ids.has(p.id) && p.author === ship && expected.test(JSON.stringify(p.content))))
  if (!ctx.sid) ctx.sid = await until('new exact-thread conversation', async () => (await status()).sessions.find((sid) => !before.has(sid)))
  assert.ok((await status()).sessions.includes(ctx.sid), 'same head remains the current conversation')
  ctx.binding = (await input(ctx)).source.binding
  return snapshot(ctx)
}
async function finished(ctx, label) {
  await until('native final reply', async () => (await messages(ctx)).some((p) => p.author === ship && JSON.stringify(p.content).includes(`done:${label}`)))
}
function release(entry, text) {
  entry.result = entry.kind === 'child' ? JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: text } }] }) : text
  for (const res of entry.sockets) res.end(entry.result)
}
function hold(kind, key, res, body) {
  let entry = held.find((h) => h.key === key)
  if (!entry) { entry = { kind, key, sockets: [], body }; held.push(entry) }
  if (entry.result !== undefined) res.end(entry.result); else entry.sockets.push(res)
}
const server = createServer(async (req, res) => {
  if (req.url.startsWith('/slow?')) return hold('http', req.url, res)
  const raw = await readText(req)
  res.writeHead(200, { 'content-type': 'application/json' })
  if (responses.has(raw)) return res.end(responses.get(raw))
  try {
    const body = JSON.parse(raw)
    if (body.messages.some((m) => m.role === 'system' && m.content.includes('You are a subagent'))) return hold('child', raw, res, body)
    requests.push(body)
    const at = body.messages.findLastIndex((m) => m.role === 'user'), label = body.messages[at].content
    assert.ok(label.includes(marker), 'slash commands must not request inference')
    const done = body.messages.slice(at + 1).filter((m) => m.role === 'tool')
    let tool
    if (!done.length && label.includes(':hold:')) tool = ['reused-call', 'http_fetch', { url: `${url}/slow?label=${encodeURIComponent(label)}` }]
    if (!done.length && label.includes(':child:')) tool = ['reused-child', 'run_subagent', { prompt: label }]
    if (!done.length && label.includes(':cron:')) tool = ['schedule', 'cron_add', { schedule: '0 12 * * *', timezone: 'UTC', prompt: `${marker}:scheduled`, runs: '1' }]
    if (done.length && label.includes(':cron:')) cron = JSON.parse(done.at(-1).content)
    const message = tool ? { role: 'assistant', content: '', tool_calls: [{ id: tool[0], type: 'function', function: { name: tool[1], arguments: JSON.stringify(tool[2]) } }] }
      : { role: 'assistant', content: `done:${label}` }
    const result = JSON.stringify({ choices: [{ finish_reason: tool ? 'tool_calls' : 'stop', message }] })
    responses.set(raw, result); res.end(result)
  } catch (error) { failures.push(error); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] })) }
})
async function timer(sid) {
  await client.pokeAgent('harness', 'harness-action', { 'timer-set': { sid, name: 'continuity-fixture', in: 3600, every: null, prompt: marker } })
  await until('native timer stored', async () => (await scry('harness/timers')).some((t) => t.sid === sid))
}
async function reload() {
  stopped = true
  await run('tmux', ['send-keys', '-t', pane, '-l', '--', '|rein %harness [%.n %harness-tlon]'])
  await run('tmux', ['send-keys', '-t', pane, 'Enter']); await sleep(800)
  await run('tmux', ['send-keys', '-t', pane, '-l', '--', '|rein %harness [%.y %harness-tlon]'])
  await run('tmux', ['send-keys', '-t', pane, 'Enter']); await sleep(800)
  await until('adapter reconnects', async () => (await status()).headConnected)
  stopped = false
}
async function head(enabled) {
  headStopped = !enabled
  await run('tmux', ['send-keys', '-t', pane, '-l', '--', `|rein %harness [%.${enabled ? 'y' : 'n'} %harness]`])
  await run('tmux', ['send-keys', '-t', pane, 'Enter']); await sleep(1000)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); url = `http://127.0.0.1:${server.address().port}`
  await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await status()).policy }
  await configure({ ...originals.policy, enabled: false })
  for (const ctx of contexts) {
    await send(ctx, `${tag(ctx)}-parent`)
    const p = await until('thread parent', async () => (await posts(ctx)).find(([, p]) => JSON.stringify(p.essay?.content).includes(`${tag(ctx)}-parent`)))
    ctx.parent = ctx.kind === 'dm' ? p[1].seal.id : p[0]
    await until('parent arrived before activation', async () => (await posts(ctx, false)).some(([, p]) => JSON.stringify(p.essay?.content).includes(`${tag(ctx)}-parent`)))
  }
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '', url, model: 'continuity-fixture', headers: [], tools: ['web', 'subagents'] } })
  await configure({ enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  for (const ctx of contexts) {
    // Memory is shared, so each conversation keeps its own fact under its own name.
    ctx.saved = await command(ctx, `/remember ${note}-${ctx.kind} ${tag(ctx)}-note`, /Memory saved/)
    ctx.cfg = { ...await config(ctx), key: '', model: `${ctx.kind}-chosen-model`, system: `${tag(ctx)} chosen system` }
    await client.call('harness/session/configure', { sessionId: ctx.sid, config: ctx.cfg })
    ctx.cfg = await config(ctx)
    await timer(ctx.sid)
  }
  const [dm, channel] = contexts, dmBinding = dm.binding, channelBinding = channel.binding
  const scheduled = `${tag(dm)}:cron:one`; await send(dm, scheduled); await finished(dm, scheduled)
  assert.equal(cron.state, 'active')
  const first = `${tag(dm)}:hold:unrelated`; await send(dm, first)
  const h1 = await until('HTTP tool held', () => held.find((h) => h.kind === 'http' && h.key.includes('unrelated')))
  const waiting = await snapshot(dm), untouched = await snapshot(channel)
  await configure({ ...policy, trusted: [{ ship: extra, tools: [] }] })
  assert.deepEqual(await snapshot(dm), waiting, 'unrelated permission edit does not cancel work')
  assert.deepEqual(await snapshot(channel), untouched, 'unrelated edit does not rewrite an idle head')
  assert.equal((await bindingStatus(dmBinding)).enabled, true)
  assert.equal((await bindingStatus(channelBinding)).enabled, true)
  assert.equal((await client.call('harness/cron')).find((j) => j.id === cron.id).state, 'active')
  release(h1, 'UNRELATED_WORK_FINISHED'); await finished(dm, first)
  console.log('PASS unrelated actor edit preserves in-flight work, bindings, notes, settings and schedule')

  await configure({ ...policy, response: 'all' })
  await until('channel timer retired', async () => !(await scry('harness/timers')).some((t) => t.sid === channel.sid))
  assert.ok((await scry('harness/timers')).some((t) => t.sid === dm.sid))
  assert.equal((await bindingStatus(channelBinding)).enabled, false)
  assert.equal((await bindingStatus(dmBinding)).enabled, true)
  assert.deepEqual((await command(channel, '/memory', new RegExp(tag(channel)))).memory, channel.saved.memory)
  assert.notEqual(channel.binding, channelBinding)
  assert.deepEqual(await config(channel), channel.cfg)
  assert.equal((await client.call('harness/cron')).find((j) => j.id === cron.id).state, 'active')
  console.log('PASS mention-policy change fences only the channel; same head, note and chosen config resume with a fresh binding')

  await configure({ ...policy, owner: ship, trusted: [{ ship: peer, tools: ['web', 'subagents'] }, { ship: extra, tools: [] }] })
  await until('source schedule paused', async () => (await client.call('harness/cron')).find((j) => j.id === cron.id).state === 'paused')
  await command(dm, '/memory', new RegExp(tag(dm)))
  assert.deepEqual((await snapshot(dm)).memory, dm.saved.memory)
  assert.equal((await config(dm)).model, dm.cfg.model)
  const old = `${tag(dm)}:hold:old`; await send(dm, old)
  const h2 = await until('old request held', () => held.find((h) => h.kind === 'http' && h.key.endsWith('old')))
  const oldInput = await input(dm)
  await configure({ ...policy, trusted: [{ ship: peer, tools: ['web'] }, { ship: extra, tools: [] }] })
  await until('affected request cancelled', async () => (await snapshot(dm)).phase === 'idle')
  assert.equal((await bindingStatus(oldInput.source.binding)).enabled, false)
  await command(dm, '/memory', new RegExp(tag(dm)))
  assert.notEqual(dm.binding, oldInput.source.binding)
  const fresh = `${tag(dm)}:hold:fresh`; await send(dm, fresh)
  const h3 = await until('fresh request reuses call ID', () => held.find((h) => h.kind === 'http' && h.key.endsWith('fresh')))
  const freshWaiting = await snapshot(dm)
  release(h2, 'OLD_GENERATION_MUST_NOT_APPEAR'); await sleep(500)
  assert.deepEqual(await snapshot(dm), freshWaiting)
  release(h3, 'CURRENT_GENERATION_RESULT'); await finished(dm, fresh)
  assert.equal((await effect(oldInput.id)).status, 'pending', 'old cancellation publication was not replayed')
  await client.call('harness/hand', { enable: { id: oldInput.source.binding, enabled: true } })
  await sleep(500)
  assert.equal((await effect(oldInput.id)).status, 'pending', 'even operator re-enabling an old binding cannot make it current')
  await client.call('harness/hand', { enable: { id: oldInput.source.binding, enabled: false } })
  assert.ok(!JSON.stringify(await snapshot(dm)).includes('OLD_GENERATION_MUST_NOT_APPEAR'))
  console.log('PASS affected tools cancel; regrant preserves identity and notes but fences old callbacks and publications')

  await configure({ ...policy, trusted: [{ ship: peer, tools: ['web', 'subagents'] }, { ship: extra, tools: [] }] })
  await command(dm, '/memory', new RegExp(tag(dm)))
  const delegated = `${tag(dm)}:child:old`; await send(dm, delegated)
  const oldChild = await until('child inference held', () => held.find((h) => h.kind === 'child' && h.key.includes(delegated)))
  const child = await until('child session exists', async () => (await client.call('session/list')).sessions.find((s) => s.sessionId.startsWith(`${dm.sid}--`))?.sessionId)
  children.push(child); await timer(child)
  await configure({ ...policy, trusted: [{ ship: peer, tools: [] }, { ship: extra, tools: [] }] })
  await until('child is cancelled', async () => (await snapshot(child)).phase === 'idle')
  assert.ok(!(await scry('harness/timers')).some((t) => t.sid === child))
  assert.deepEqual((await client.call('harness/session/config', { sessionId: child })).tools, [])
  const childStopped = await snapshot(child), parentStopped = await snapshot(dm)
  release(oldChild, 'OLD_CHILD_MUST_NOT_RETURN'); await sleep(500)
  assert.deepEqual(await snapshot(child), childStopped)
  assert.deepEqual(await snapshot(dm), parentStopped)
  console.log('PASS revocation cancels delegated inference and child timers; late child receipt cannot revive parent')

  await configure({ ...policy, trusted: [{ ship: peer, tools: ['web', 'subagents'] }, { ship: extra, tools: [] }] })
  await command(dm, '/memory', new RegExp(tag(dm)))
  const again = `${tag(dm)}:child:new`; await send(dm, again)
  const newChild = await until('new child inference held', () => held.find((h) => h.kind === 'child' && h.key.includes(again)))
  const newId = await until('fresh child identity', async () => (await client.call('session/list')).sessions.find((s) => s.sessionId.startsWith(`${dm.sid}--`) && s.sessionId !== child)?.sessionId)
  children.push(newId); assert.notEqual(newId, child)
  release(newChild, 'NEW_CHILD_FINISHED'); await finished(dm, again)
  await configure({ ...policy, trusted: [{ ship: extra, tools: [] }] })
  const denied = `${tag(dm)}:denied:must-not-enter`, requestCount = requests.length
  await send(dm, denied)
  await until('denied message reaches native history', async () => (await messages(dm)).some((p) => p.author === peer && JSON.stringify(p.content).includes(denied)))
  await sleep(500)
  assert.equal(requests.length, requestCount)
  await configure({ ...policy, trusted: [{ ship: peer, tools: ['web', 'subagents'] }, { ship: extra, tools: [] }] })
  await command(dm, '/memory', new RegExp(tag(dm)))
  assert.ok(!JSON.stringify(await snapshot(dm)).includes(denied), 'regrant must not backfill denied native input')
  await command(channel, '/memory', new RegExp(tag(channel)))
  await reload()
  for (const ctx of contexts) {
    const binding = ctx.binding
    assert.deepEqual((await command(ctx, '/memory', new RegExp(tag(ctx)))).memory, ctx.saved.memory)
    assert.equal(ctx.binding, binding, 'reload preserves ready bindings')
  }
  await configure({ ...policy, response: policy.response === 'mentions' ? 'all' : 'mentions' })
  const beforeRecovery = new Set((await messages(channel)).map((p) => p.id))
  await head(false)
  await send(channel, '/memory')
  // Adapter status includes the head ledger, so it is deliberately not our
  // availability probe while the head is stopped. Native Messenger stays up.
  await until('native input arrives while head is unavailable', async () => (await messages(channel)).some((p) => !beforeRecovery.has(p.id) && p.author === peer && JSON.stringify(p.content).includes('/memory')))
  await sleep(500)
  assert.ok(!(await messages(channel)).some((p) => !beforeRecovery.has(p.id) && p.author === ship))
  await head(true); await reload()
  await until('pending admission recovers after head reconnects', async () => (await messages(channel)).some((p) => !beforeRecovery.has(p.id) && p.author === ship && JSON.stringify(p.content).includes(tag(channel))))
  assert.equal((await messages(channel)).filter((p) => !beforeRecovery.has(p.id) && p.author === ship).length, 1)
  assert.deepEqual((await snapshot(channel)).memory, channel.saved.memory)
  channel.binding = (await input(channel)).source.binding
  console.log('PASS interrupted authorization setup retains admission and recovers exactly once after head reconnect')
  await configure({ ...policy, enabled: false })
  await configure({ ...policy, enabled: true })
  for (const ctx of contexts) {
    const binding = ctx.binding
    assert.deepEqual((await command(ctx, '/memory', new RegExp(tag(ctx)))).memory, ctx.saved.memory)
    assert.notEqual(ctx.binding, binding)
    await command(ctx, `/forget ${note}-${ctx.kind}`, /Memory forgotten/)
  }
  assert.equal((await client.call('harness/cron')).find((j) => j.id === cron.id).state, 'paused')
  console.log('PASS same-call child gets fresh identity; reload and disable/re-enable retain conversation notes without restarting schedules')
} finally {
  if (headStopped) await head(true)
  if (stopped) {
    await run('tmux', ['send-keys', '-t', pane, '-l', '--', '|rein %harness [%.y %harness-tlon]'])
    await run('tmux', ['send-keys', '-t', pane, 'Enter']); await sleep(1000)
  }
  for (const ctx of contexts.filter((ctx) => ctx.sid)) {
    await client.call('session/cancel', { sessionId: ctx.sid })
    await client.pokeAgent('harness', 'harness-action', { 'timer-cancel': { sid: ctx.sid, name: 'continuity-fixture' } })
  }
  for (const sid of children) await client.call('session/cancel', { sessionId: sid })
  if (cron?.id) await client.call('harness/cron/cancel', { id: cron.id })
  if (originals) {
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
