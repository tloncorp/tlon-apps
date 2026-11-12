// Admission-time public reference, memory opt-out and shared-library ceiling.
// Uses uniquely marked native threads; restores Harness settings.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'

assert.equal(process.env.CONTEXT_TEST_MESSAGES, '1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `context-${randomUUID()}`
const client = new Client(), contexts = [{ kind: 'dm' }, { kind: 'channel' }], failures = []
const note = `c${randomUUID().slice(0, 8)}`, secret = `${marker}-private-note`, skillName = `${marker}-forbidden`
const run = promisify(execFile), reminders = new Map(), reminderSpecs = new Map()
let event = 0, stamp = 0, originals, requests = 0, completed = false, adapterStopped = false
async function scry(path, remote = false) {
  const response = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, { headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(response.ok, `${path}: ${response.status}`); return response.json()
}
async function until(label, check) {
  // Peer propagation is distinct from the channel host's durable receipt.
  const end = Date.now() + 120000
  while (Date.now() < end) {
    if (failures.length) throw new AggregateError(failures)
    const value = await check(); if (value) return value
    await sleep(150)
  }
  throw new Error(`Timed out: ${label}`)
}
async function posts(ctx, remote = true) {
  const data = await scry(ctx.kind === 'dm' ? `chat/v4/dm/${remote ? ship : peer}/writs/newest/100/heavy` : `channels/v5/${nest}/posts/newest/100/post`, remote)
  return Object.entries(data.writs || data.posts)
}
async function replies(ctx) {
  const post = (await posts(ctx)).find(([key, p]) => (ctx.kind === 'dm' ? p.seal.id : key) === ctx.parent)?.[1]
  return Object.entries(post?.seal?.replies || {}).map(([id, p]) => ({ id, ...p['reply-essay'] }))
}
async function send(ctx, text, addressed = true) {
  stamp = Math.max(Date.now(), stamp + 1)
  const da = (((BigInt(stamp) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const content = [{ inline: [...(ctx.kind === 'channel' && addressed ? [{ ship }, ' '] : []), text] }]
  const reply = { content, author: peer, sent: stamp, blob: null }, essay = { ...reply, kind: '/chat', meta: null }
  const json = ctx.kind === 'channel' ? { channel: { nest, action: { post: ctx.parent ? { reply: { id: ctx.parent, action: { add: reply } } } : { add: essay } } } }
    : { ship, diff: { id: ctx.parent || `${peer}/${da}`, delta: ctx.parent ? { reply: { id: `${peer}/${da}`, meta: null, delta: { add: { 'reply-essay': reply, time: null } } } } : { add: { essay, time: null } } } }
  const response = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app: ctx.kind === 'channel' ? 'channels' : 'chat', mark: ctx.kind === 'channel' ? 'channel-action-2' : 'chat-dm-action-2', json }]), signal: AbortSignal.timeout(15000) })
  assert.ok(response.ok)
}
async function command(ctx, text, expected) {
  const ids = new Set((await replies(ctx)).map((p) => p.id)), before = new Set((await client.call('harness/tlon')).sessions)
  await send(ctx, text)
  await until('native command receipt', async () => (await replies(ctx)).some((p) => !ids.has(p.id) && p.author === ship && expected.test(JSON.stringify(p.content))))
  if (!ctx.sid) ctx.sid = await until('thread head', async () => (await client.call('harness/tlon')).sessions.find((sid) => !before.has(sid)))
}
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw); requests++
    res.writeHead(200, { 'content-type': 'application/json' })
    assert.ok(!raw.includes(secret), 'memory opt-out excludes shared facts from the request')
    assert.ok(!raw.includes(`${marker}-outside`), 'unrelated public top-level messages are excluded')
    const reference = body.messages.find((m) => m.role === 'user' && m.content.startsWith('Public thread reference captured at admission.'))
    assert.ok(reference, 'public native context is supplied without asking for a history tool')
    const snapshot = JSON.parse(reference.content.slice(reference.content.indexOf('\n') + 1))
    assert.ok(snapshot.destination.includes(nest))
    assert.ok(snapshot.messages.length >= 2 && snapshot.messages.length <= 9)
    assert.ok(snapshot.messages.some((m) => m.text.includes(`${marker}-channel-parent`)))
    assert.ok(snapshot.messages.some((m) => m.text.includes(`${marker}-public-source`) && m.author === peer))
    assert.ok(snapshot.messages.every((m) => m.message_id && m.sent && m.author))
    const names = body.tools.map((t) => t.function.name)
    for (const name of ['write_skill', 'propose_skill', 'commit_skill', 'delete_skill']) assert.ok(!names.includes(name), `${name} is absent from social discovery`)
    const last = body.messages.findLastIndex((m) => m.role === 'user'), done = body.messages.slice(last + 1).filter((m) => m.role === 'tool')
    const scenario = body.messages[last].content.split(`${marker}-reminder:`)[1]
    if (scenario) {
      const spec = reminderSpecs.get(scenario)
      assert.ok(spec)
      let call
      if (!done.length) call = ['reminder_add', { at: spec.at, destination: spec.destination || snapshot.destination, text: spec.text }]
      if (done.length) {
        if (scenario.startsWith('invalid')) assert.match(done[0].content, /^error:/)
        else {
          const job = JSON.parse(done[0].content)
          assert.equal(job.kind, 'reminder'); assert.equal(job.remaining, 1)
          assert.equal(job.destination, snapshot.destination)
          assert.equal(job.timezone, 'UTC+05:30')
          reminders.set(scenario, job)
          if (scenario === 'cancel' && done.length === 1) call = ['cron_remove', { id: job.id }]
          if (scenario === 'cancel' && done.length === 2) assert.equal(JSON.parse(done[1].content).state, 'cancelled')
        }
      }
      const message = call ? { role: 'assistant', content: '', tool_calls: [{ id: `reminder-${scenario}-${done.length}`, type: 'function', function: { name: call[0], arguments: JSON.stringify(call[1]) } }] }
        : { role: 'assistant', content: `${marker}-armed:${scenario}` }
      return res.end(JSON.stringify({ choices: [{ finish_reason: call ? 'tool_calls' : 'stop', message }] }))
    }
    for (const tool of done) assert.match(tool.content, /^(?:error|rejected):.*(?:grant|allow|denied)/i)
    const calls = ['write_skill', 'propose_skill', 'commit_skill']
    const name = calls[done.length]
    const message = name ? { role: 'assistant', content: '', tool_calls: [{ id: `forbidden-${done.length}`, type: 'function', function: { name, arguments: JSON.stringify({ name: skillName, description: 'not shared', body: 'private conversation material' }) } }] }
      : { role: 'assistant', content: `${marker}-done` }
    res.end(JSON.stringify({ choices: [{ finish_reason: name ? 'tool_calls' : 'stop', message }] }))
  } catch (error) {
    failures.push(error)
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] }))
  }
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await client.call('harness/tlon')).policy, skills: await scry('harness/skills'), staged: await scry('harness/staged') }
  await client.call('harness/tlon/configure', { ...originals.policy, enabled: false })
  for (const ctx of contexts) {
    await send(ctx, `${marker}-${ctx.kind}-parent`)
    const p = await until('native parent', async () => (await posts(ctx)).find(([, p]) => JSON.stringify(p.essay?.content).includes(`${marker}-${ctx.kind}-parent`)))
    ctx.parent = ctx.kind === 'dm' ? p[1].seal.id : p[0]
    await until('parent arrived', async () => (await posts(ctx, false)).some(([, p]) => JSON.stringify(p.essay?.content).includes(`${marker}-${ctx.kind}-parent`)))
  }
  const [dm, channel] = contexts
  await send({ kind: 'channel' }, `${marker}-outside`, false)
  await send(channel, `${marker}-public-source /remember quoted inert`, false)
  await until('public source arrived', async () => (await replies(channel)).some((p) => JSON.stringify(p.content).includes(`${marker}-public-source`)))
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '', url: `http://127.0.0.1:${server.address().port}`, model: 'context-fixture', headers: [], tools: ['skills', 'skill-write', 'author'] } })
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  await command(dm, `/remember ${note} ${secret}`, /Memory saved/)
  await command(channel, '/memory off', /Shared memory is off/)
  assert.equal(requests, 0, 'commands do not infer')
  assert.ok(!(await scry(`harness/events/${channel.sid}`)).some((e) => e.type === 'context-received'), 'commands do not capture public reference')
  await send(channel, `${marker}-probe`)
  await until('published result', async () => (await replies(channel)).some((p) => p.author === ship && JSON.stringify(p.content).includes(`${marker}-done`)))
  const events = await scry(`harness/events/${channel.sid}`), reference = events.find((e) => e.type === 'context-received')
  assert.ok(reference && events.some((e) => e.type === 'input' && e.id === reference.inputId), 'reference is durably linked to original input')
  assert.deepEqual(await scry('harness/skills'), originals.skills)
  assert.deepEqual(await scry('harness/staged'), originals.staged)
  assert.deepEqual((await client.call('harness/session/snapshot', { sessionId: channel.sid })).memory, [])
  await command(dm, `/forget ${note}`, /forgotten|removed|unpinned/i)
  console.log('PASS native public-thread attribution, memory opt-out, inert quoted commands, durable reference and shared-skill write denial')
  if (process.env.TEST_PANE) {
    async function restartAdapter(enabled) {
      adapterStopped = !enabled
      await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, '-l', '--', `|rein %harness [%.${enabled ? 'y' : 'n'} %harness-tlon]`])
      await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, 'Enter'])
      await sleep(800)
    }
    await command(channel, '/memory on', /Shared memory is on/)
    const catchupNote = `c${randomUUID().slice(0, 8)}`, beforeRequests = requests
    const commands = Array.from({ length: 20 }, (_, i) => `/remember ${catchupNote} ${marker}-catchup-${i}`)
    await restartAdapter(false)
    for (const text of commands) await send(channel, text)
    await until('offline messages arrived on the receiving ship', async () => {
      const post = (await posts(channel, false)).find(([id]) => id === channel.parent)?.[1]
      return Object.values(post?.seal?.replies || {}).filter((p) => JSON.stringify(p).includes(`${marker}-catchup-`)).length === 20
    })
    await restartAdapter(true)
    await until('all offline commands admitted', async () => {
      const events = await scry(`harness/events/${channel.sid}`)
      return events.filter((e) => e.type === 'input' && commands.includes(e.item?.body)).length === 20
    })
    const ordered = (await scry(`harness/events/${channel.sid}`)).filter((e) => e.type === 'input' && commands.includes(e.item?.body)).map((e) => e.item.body)
    assert.deepEqual(ordered, commands, 'catch-up is chronological across bounded pages and queue backpressure')
    await command(channel, `/memory ${catchupNote}`, new RegExp(`${marker}-catchup-19`))
    const checkpoint = (await client.call('harness/tlon')).activityThrough
    await restartAdapter(false); await restartAdapter(true)
    await until('cursor recovery settled', async () => !(await client.call('harness/tlon')).catchingUp)
    assert.ok((await client.call('harness/tlon')).activityThrough >= checkpoint)
    assert.equal((await scry(`harness/events/${channel.sid}`)).filter((e) => e.type === 'input' && commands.includes(e.item?.body)).length, 20, 'restart does not duplicate input')
    assert.equal(requests, beforeRequests, 'catch-up commands do not infer')
    await command(channel, `/forget ${catchupNote}`, /forgotten/i)
    await command(channel, '/memory off', /Shared memory is off/)
    console.log('PASS durable Activity catch-up: 20 offline messages, chronological bounded pages, queue backpressure and restart deduplication')
  }
  async function schedule(scenario, patch = {}) {
    const due = Date.now() + 12000
    const at = new Date(due + 330 * 60000).toISOString().replace(/\.\d{3}Z$/, '+05:30')
    reminderSpecs.set(scenario, { at, due, text: `/remember inert ${marker}-literal:${scenario}`, ...patch })
    await send(channel, `${marker}-reminder:${scenario}`)
    await until('schedule acknowledgement', async () => (await replies(channel)).some((p) => p.author === ship && JSON.stringify(p.content).includes(`${marker}-armed:${scenario}`)))
    return reminders.get(scenario)
  }
  const beforeSchedules = (await client.call('harness/cron')).length
  await schedule('invalid-destination', { destination: 'dm/~zod' })
  await schedule('invalid-timezone', { at: new Date(Date.now() + 60000).toISOString().slice(0, 19) })
  assert.equal((await client.call('harness/cron')).length, beforeSchedules)
  const delivered = await schedule('deliver')
  const afterArmed = requests
  if (process.env.TEST_PANE) {
    assert.ok(Date.now() < reminderSpecs.get('deliver').due, 'adapter must stop before the reminder is due')
    adapterStopped = true
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, '-l', '--', '|rein %harness [%.n %harness-tlon]'])
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, 'Enter'])
    await sleep(Math.max(1000, reminderSpecs.get('deliver').due - Date.now() + 1000))
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, '-l', '--', '|rein %harness [%.y %harness-tlon]'])
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, 'Enter'])
    adapterStopped = false
  }
  await until('literal reminder delivery', async () => (await replies(channel)).some((p) => p.author === ship && JSON.stringify(p.content).includes(`${marker}-literal:deliver`)))
  const record = await until('actual reminder receipt', async () => (await client.call('harness/cron')).find((job) => job.id === delivered.id && job.delivery === 'delivered'))
  assert.equal(record.execution, 'completed'); assert.equal(record.remaining, 0)
  assert.equal(requests, afterArmed, 'delivery never requests a model')
  const scheduledEvents = await scry(`harness/events/${record.runSessionId}`)
  assert.ok(!scheduledEvents.some((e) => ['input', 'llm-requested', 'memory-set'].includes(e.type)))
  const publication = await client.call('harness/hand', { effect: { hand: 'tlon', effect: record.lastInput } })
  assert.equal(publication.text, reminderSpecs.get('deliver').text)
  assert.equal(publication.status, 'delivered')
  assert.deepEqual((await client.call('harness/session/snapshot', { sessionId: channel.sid })).memory, [])
  await schedule('cancel')
  const revoked = await schedule('revoked')
  await client.call('harness/tlon/configure', { enabled: false, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  assert.equal((await client.call('harness/cron')).find((job) => job.id === revoked.id).state, 'paused')
  await sleep(Math.max(1000, reminderSpecs.get('revoked').due - Date.now() + 1000))
  assert.ok(!(await replies(channel)).some((p) => p.author === ship && /literal:(?:cancel|revoked)/.test(JSON.stringify(p.content))))
  assert.equal((await replies(channel)).filter((p) => p.author === ship && JSON.stringify(p.content).includes(`${marker}-literal:deliver`)).length, 1)
  console.log('PASS explicit reminder destination/timezone, no-inference literal publication, downtime recovery, cancellation and revoked authority')
  completed = true
} finally {
  if (adapterStopped) {
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, '-l', '--', '|rein %harness [%.y %harness-tlon]'])
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, 'Enter']); await sleep(1000)
  }
  if (originals) {
    for (const job of reminders.values()) await client.call('harness/cron/cancel', { id: job.id }).catch(() => {})
    for (const ctx of contexts) if (ctx.sid) await client.call('session/cancel', { sessionId: ctx.sid }).catch(() => {})
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
assert.equal(completed, true)
