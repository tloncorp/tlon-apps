// Admission-time public reference, memory opt-out and shared-library ceiling.
// Uses uniquely marked native threads; restores Harness settings.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { rein } from './lib/ship-thread.mjs'
import { authorShip, assertBotAuthor } from './lib/author.mjs'

assert.equal(process.env.CONTEXT_TEST_MESSAGES, '1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `context-${randomUUID()}`
const client = new Client(), contexts = [{ kind: 'dm' }, { kind: 'channel' }], failures = []
const note = `c${randomUUID().slice(0, 8)}`, secret = `${marker}-private-note`, skillName = `${marker}-forbidden`
const reminders = new Map(), reminderSpecs = new Map()
let event = 0, stamp = 0, originals, requests = 0, completed = false, adapterStopped = false, waiting, profile
const hold = Promise.withResolvers(), held = Promise.withResolvers()
// A ship busy with one long event answers late: a read that times out is
// asked again until the wait it serves, or two minutes, runs out.
async function scry(path, remote = false) {
  const asked = Date.now(), end = waiting?.end ?? asked + 120000
  for (let left = end - asked; left > 0; left = end - Date.now()) {
    try {
      const response = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, { headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(Math.min(15000, left)) })
      assert.ok(response.ok, `${path}: ${response.status}`)
      const data = await response.json()
      if (Date.now() < end) return data
    } catch (error) {
      if (error.name !== 'TimeoutError') throw error
    }
  }
  throw new Error(`${path}: the ship has not answered for ${((Date.now() - asked) / 1000).toFixed(1)} s, waiting for ${waiting?.label ?? 'a direct read'}`)
}
async function until(label, check) {
  // Peer propagation is distinct from the channel host's durable receipt.
  waiting = { label, end: Date.now() + 120000 }
  try {
    while (Date.now() < waiting.end) {
      if (failures.length) throw new AggregateError(failures)
      const value = await check(); if (value) return value
      await sleep(150)
    }
    throw new Error(`Timed out: ${label}`)
  } finally { waiting = undefined }
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
async function contact(actions, remote = false) {
  const response = await fetch(`${remote ? peerUrl : base}/~/channel/${marker}-contacts`, { method: 'PUT', headers: { cookie: remote ? peerCookie : cookie, 'content-type': 'application/json' }, body: JSON.stringify(actions.map((json) => ({ id: ++event, action: 'poke', ship: (remote ? peer : ship).slice(1), app: 'contacts', mark: 'contact-action-1', json }))), signal: AbortSignal.timeout(15000) })
  assert.ok(response.ok)
}
async function command(ctx, text, expected) {
  const ids = new Set((await replies(ctx)).map((p) => p.id)), before = new Set((await client.call('harness/tlon')).sessions)
  await send(ctx, text)
  const receipt = await until('native command receipt', async () => (await replies(ctx)).find((p) => !ids.has(p.id) && authorShip(p.author) === ship && expected.test(JSON.stringify(p.content))))
  assertBotAuthor(receipt.author, ship)
  if (!ctx.sid) ctx.sid = await until('thread head', async () => (await client.call('harness/tlon')).sessions.find((sid) => !before.has(sid)))
}
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw); requests++
    res.writeHead(200, { 'content-type': 'application/json' })
    assert.ok(!raw.includes(secret), 'memory opt-out excludes shared facts from the request')
    // The held turn answers only once the messages behind it are queued.
    if (body.messages.findLast((m) => m.role === 'user').content.includes(`${marker}-hold`)) { held.resolve(); await hold.promise }
    if (raw.includes(`${marker}-top`)) return res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: `${marker}-top-done` } }] }))
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
  await until('published result', async () => (await replies(channel)).some((p) => authorShip(p.author) === ship && JSON.stringify(p.content).includes(`${marker}-done`)))
  const events = await scry(`harness/events/${channel.sid}`), reference = events.find((e) => e.type === 'context-received')
  assert.ok(reference && events.some((e) => e.type === 'input' && e.id === reference.inputId), 'reference is durably linked to original input')
  // The peer publishes a name, and this ship keeps a private one for it. A
  // page that already exists refuses %page, so %edit follows it.
  profile = await scry('contacts/v1/self', true)
  await contact([{ self: { nickname: { type: 'text', value: `${marker}-name` } } }], true)
  await contact([{ wipe: [peer] }, { meet: [peer] }])
  await until('published name arrived', async () => (await scry(`contacts/v1/contact/${peer}`).catch(() => null))?.nickname?.value === `${marker}-name`)
  await contact([{ page: { kip: peer, contact: {} } }, { edit: { kip: peer, contact: { nickname: { type: 'text', value: `${marker}-pet` } } } }])
  await until('private name saved', async () => (await scry(`contacts/v1/contact/${peer}`))?.nickname?.value === `${marker}-pet`)
  const top = { kind: 'channel' }
  async function admitted(text) {
    return until(`reference of ${text}`, async () => {
      for (const sid of (await client.call('harness/tlon')).sessions) {
        const log = await scry(`harness/events/${sid}`), input = log.find((e) => e.type === 'input' && e.item?.body?.includes(text))
        const found = input && log.find((e) => e.type === 'context-received' && e.inputId === input.id)
        if (found) return { input: input.item.body, messages: JSON.parse(found.body.slice(found.body.indexOf('\n') + 1)).messages, body: found.body }
      }
    })
  }
  await send(top, `${marker}-top`)
  const recent = await admitted(`${marker}-top`), shown = `${peer} (${marker}-name)`
  assert.ok(recent.body.startsWith('Recent public channel activity captured at admission'), 'a top-level turn gets recent channel activity')
  assert.ok(recent.messages.length <= 20 && recent.messages.some((m) => m.text.includes(`${marker}-outside`) && m.author === shown), 'recent top-level posts are attributed, with published display names')
  assert.ok(!recent.messages.some((m) => m.text.includes(`${marker}-top`)), 'the message being admitted is not repeated as history')
  assert.ok(recent.input.startsWith(`${shown}: `), 'a channel message names its speaker, with the published display name')
  assert.ok(!recent.body.includes(`${marker}-pet`) && !recent.input.includes(`${marker}-pet`), 'a name this ship keeps privately for a contact stays out of a shared channel')
  // Two mentions that queue behind a running turn are inputs of their own.
  await until('top-level turn published', async () => (await posts(top)).some(([, p]) => JSON.stringify(p).includes(`${marker}-top-done`)))
  await send(top, `${marker}-hold`); await held.promise
  await send(top, `${marker}-first`); await send(top, `${marker}-second`)
  await until('queued messages arrived', async () => (await posts(top, false)).filter(([, p]) => [`${marker}-first`, `${marker}-second`].some((text) => JSON.stringify(p.essay?.content).includes(text))).length === 2)
  await sleep(3000); hold.resolve()
  for (const text of [`${marker}-first`, `${marker}-second`]) {
    const queued = await admitted(text)
    assert.ok(!queued.messages.some((m) => m.text.includes(`${marker}-first`) || m.text.includes(`${marker}-second`)), 'a message queued behind a running turn is not repeated as history')
  }
  await contact([{ wipe: [peer] }])
  await contact([{ self: { nickname: profile.nickname ?? null } }], true); profile = undefined
  assert.deepEqual(await scry('harness/skills'), originals.skills)
  assert.deepEqual(await scry('harness/staged'), originals.staged)
  assert.deepEqual((await client.call('harness/session/snapshot', { sessionId: channel.sid })).memory, [])
  await command(dm, `/forget ${note}`, /forgotten|removed|unpinned/i)
  console.log('PASS native public-thread attribution, memory opt-out, inert quoted commands, durable reference and shared-skill write denial')
  if (process.env.SHIP_PIER) {
    async function restartAdapter(enabled) {
      adapterStopped = !enabled
      await rein(process.env.SHIP_PIER, 'harness', 'harness-tlon', enabled)
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
    await until('schedule acknowledgement', async () => (await replies(channel)).some((p) => authorShip(p.author) === ship && JSON.stringify(p.content).includes(`${marker}-armed:${scenario}`)))
    return reminders.get(scenario)
  }
  const beforeSchedules = (await client.call('harness/cron')).length
  await schedule('invalid-destination', { destination: 'dm/~zod' })
  await schedule('invalid-timezone', { at: new Date(Date.now() + 60000).toISOString().slice(0, 19) })
  assert.equal((await client.call('harness/cron')).length, beforeSchedules)
  const delivered = await schedule('deliver')
  const afterArmed = requests
  if (process.env.SHIP_PIER) {
    adapterStopped = true
    await rein(process.env.SHIP_PIER, 'harness', 'harness-tlon', false)
    assert.ok(Date.now() < reminderSpecs.get('deliver').due, 'adapter must stop before the reminder is due')
    await sleep(Math.max(1000, reminderSpecs.get('deliver').due - Date.now() + 1000))
    await rein(process.env.SHIP_PIER, 'harness', 'harness-tlon', true)
    adapterStopped = false
  }
  const literal = await until('literal reminder delivery', async () => (await replies(channel)).find((p) => authorShip(p.author) === ship && JSON.stringify(p.content).includes(`${marker}-literal:deliver`)))
  assertBotAuthor(literal.author, ship)
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
  assert.ok(!(await replies(channel)).some((p) => authorShip(p.author) === ship && /literal:(?:cancel|revoked)/.test(JSON.stringify(p.content))))
  assert.equal((await replies(channel)).filter((p) => authorShip(p.author) === ship && JSON.stringify(p.content).includes(`${marker}-literal:deliver`)).length, 1)
  console.log('PASS explicit reminder destination/timezone, no-inference literal publication, downtime recovery, cancellation and revoked authority')
  completed = true
} finally {
  if (adapterStopped) {
    await rein(process.env.SHIP_PIER, 'harness', 'harness-tlon', true); await sleep(1000)
  }
  if (profile) await Promise.all([contact([{ wipe: [peer] }]), contact([{ self: { nickname: profile.nickname ?? null } }], true)]).catch(() => {})
  if (originals) {
    for (const job of reminders.values()) await client.call('harness/cron/cancel', { id: job.id }).catch(() => {})
    for (const ctx of contexts) if (ctx.sid) await client.call('session/cancel', { sessionId: ctx.sid }).catch(() => {})
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
assert.equal(completed, true)
