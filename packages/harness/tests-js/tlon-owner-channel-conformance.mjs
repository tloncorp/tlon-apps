// ~zod is the bot, the peer (~lux) its owner and the host of TEST_NEST, and the
// guest (~nec) an allowed ship. The owner is heard without a mention in a
// channel it hosts while the channel has no rule of its own; a guest is not.
// A local provider records each turn's input and instructions, can hold turns,
// answers NO_REPLY to the steps it is told to and rejects the requests for
// others. Restores defaults and policy; test messages remain.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, readCookie, base, cookie } from './lib/ship-client.mjs'
import { authorShip } from './lib/author.mjs'

const nest = process.env.TEST_NEST, peerUrl = process.env.PEER_URL, guestUrl = process.env.GUEST_URL
assert.ok(nest && peerUrl && guestUrl && process.env.PEER_COOKIE && process.env.GUEST_COOKIE,
  'Set TEST_NEST, PEER_URL, PEER_COOKIE, GUEST_URL and GUEST_COOKIE')
const name = (auth) => auth.split('=')[0].slice('urbauth-'.length)
const owner = { url: peerUrl, cookie: await readCookie(process.env.PEER_COOKIE) }
const guest = { url: guestUrl, cookie: await readCookie(process.env.GUEST_COOKIE) }
owner.ship = name(owner.cookie); guest.ship = name(guest.cookie)
const client = new Client(), ship = `~${client.ship}`, marker = `heard-${randomUUID().slice(0, 8)}`
assert.equal(new Set([ship, owner.ship, guest.ship]).size, 3, 'The bot, owner and guest are three ships')
assert.equal(nest.split('/')[1], owner.ship, 'The owner hosts TEST_NEST')
const failures = [], inputs = [], systems = [], held = [], silent = new Set(), rejected = new Set()
let event = 0, holding = () => false, defaults, policy

// Each turn answers every step its new input names. A held turn waits until
// release() opens it.
const words = (content) => typeof content === 'string' ? content : JSON.stringify(content ?? '')
const stepsIn = (text) => [...text.matchAll(new RegExp(`${marker}-(\\w+)`, 'g'))].map((m) => m[1])
const server = createServer(async (req, res) => {
  try {
    const body = JSON.parse(await readText(req))
    const last = body.messages.findLastIndex((m) => m.role === 'assistant')
    const input = body.messages.slice(last + 1).filter((m) => m.role === 'user').map((m) => words(m.content)).join('\n')
    const steps = stepsIn(input)
    inputs.push(input)
    systems.push(words(body.messages.find((m) => m.role === 'system')?.content))
    if (steps.some((step) => holding(step))) await new Promise((resolve) => held.push(resolve))
    // The quoted /stop carries no step; its answer is named for it.
    if (input.includes(`${owner.ship}: /stop`)) steps.push('quoted')
    if (steps.some((step) => rejected.has(step))) {
      res.writeHead(400, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ error: { message: 'fixture rejected the request' } }))
    }
    const content = steps.some((step) => silent.has(step)) ? 'NO_REPLY'
      : steps.length ? steps.map((step) => `${marker}-${step}-ok`).join(' ') : 'NO_STEP'
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content } }], usage: { prompt_tokens: 20, completion_tokens: 10 } }))
  } catch (error) { failures.push(error); res.writeHead(500); res.end('fixture error') }
})
function release() {
  holding = () => false
  for (const resolve of held.splice(0)) resolve()
}
const requested = (step) => inputs.some((input) => stepsIn(input).includes(step))
// The instructions of the model request for .step's turn.
const instructions = (step) => systems[inputs.findIndex((input) => stepsIn(input).includes(step))]

async function poke(who, app, mark, json) {
  const res = await fetch(`${who.url}/~/channel/${marker}-${who.ship.slice(1)}`, { method: 'PUT', headers: { cookie: who.cookie, 'content-type': 'application/json' },
    body: JSON.stringify([{ id: ++event, action: 'poke', ship: who.ship.slice(1), app, mark, json }]), signal: AbortSignal.timeout(15000) })
  assert.ok(res.ok, `poke as ${who.ship}: ${res.status}`)
}
async function scry(who, path) {
  const res = await fetch(`${who.url}/~/scry/${path}.json`, { headers: { cookie: who.cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(res.ok, `scry ${path}: ${res.status}`); return res.json()
}
const post = (who, inline, blob = null) => poke(who, 'channels', 'channel-action-1', { channel: { nest, action: { post: { add: {
  content: [{ inline }], author: who.ship, sent: Date.now(), kind: '/chat', meta: null, blob,
} } } } })
const da = () => (((BigInt(Date.now()) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const dm = (who, text) => poke(who, 'chat', 'chat-dm-action-2', { ship, diff: { id: `${who.ship}/${da()}`, delta: { add: { time: null, essay: {
  content: [{ inline: [text] }], author: who.ship, sent: Date.now(), kind: '/chat', meta: null, blob: null,
} } } } })
const bot = { url: base, cookie }
const botPosts = async () => Object.entries((await scry(owner, `channels/v5/${nest}/posts/newest/64/post`)).posts)
  .filter(([, p]) => authorShip(p?.essay?.author) === ship).map(([id, p]) => [id, JSON.stringify(p.essay.content)])
// The bot's own %channels copy holds the post, so its Activity row exists.
const onBot = async (step) => Object.values((await scry(bot, `channels/v5/${nest}/posts/newest/64/post`)).posts)
  .some((p) => JSON.stringify(p?.essay?.content).includes(`${marker}-${step} `))
const answered = async (step) => Object.values((await scry(owner, `channels/v5/${nest}/posts/newest/64/post`)).posts)
  .some((p) => authorShip(p?.essay?.author) === ship && JSON.stringify(p.essay.content).includes(`${marker}-${step}-ok`))
const dmAnswered = async (step) => Object.values((await scry(guest, `chat/v4/dm/${ship}/writs/newest/32/light`)).writs || {})
  .some((p) => authorShip(p?.essay?.author) === ship && JSON.stringify(p.essay.content).includes(`${marker}-${step}-ok`))
// The bot's admitted input for .step, from the events of its conversations.
async function admitted(step) {
  for (const sid of (await client.call('harness/tlon')).sessions) {
    const res = await fetch(`${base}/~/scry/harness/events/${sid}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
    if (!res.ok) continue
    const found = (await res.json()).findLast((e) => e.type === 'input' && e.source?.kind === 'hand' && JSON.stringify(e.item).includes(`${marker}-${step}`))
    if (found) return { ...found, sid }
  }
}
async function until(label, check, timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (failures.length) throw new AggregateError(failures)
    if (await check()) { console.log(`PASS ${label}`); return }
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
// The cursor reads Activity in order. Once .steps are in the bot's own copy of
// the channel, a later mention gets a later Activity row, so when it is
// answered, with nothing pending, every earlier post has been read and every
// turn admitted before it has reached the model.
async function settle(sentinel, steps = []) {
  for (const step of steps) await until(`${step} reached the bot`, () => onBot(step))
  await post(owner, [{ ship }, ` ${marker}-${sentinel}`])
  await until(`${sentinel}: a later mention is answered`, () => answered(sentinel), 120000)
  await until(`${sentinel}: the queue has drained`, async () => {
    const status = await client.call('harness/tlon')
    return !status.catchingUp && status.pending === 0
  })
  await sleep(2000)
}
// A post that was not heard has had no model turn and no answer.
async function unheard(label, steps) {
  for (const step of steps) {
    assert.ok(!requested(step), `${label}: ${step} reached the model`)
    assert.ok(!await answered(step), `${label}: ${step} was answered`)
  }
  console.log(`PASS ${label}`)
}

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  defaults = await client.call('harness/defaults'); policy = (await client.call('harness/tlon')).policy
  await client.call('harness/defaults/configure', { config: { ...defaults, url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture', key: '', headers: [], tools: [] } })
  const elsewhere = { channel: `chat/${owner.ship}/elsewhere`, response: 'all', everyone: false }
  await client.call('harness/tlon/configure', { enabled: true, owner: owner.ship, response: 'mentions', allowed: [guest.ship], channels: [elsewhere], trusted: [] })

  await post(owner, [`${marker}-owner1 plain owner post`])
  await until('the owner is answered without a mention in a channel it hosts', () => answered('owner1'))
  assert.ok(inputs.some((input) => input.includes(`${owner.ship}: ${marker}-owner1`)), 'the owner\'s post reaches the model with its speaker')

  // The app's setup request: the receipt rides in the post's blob, and the
  // model gets the setup prompt with its client context.
  const receipt = [{ type: 'tlon-agent-intro-request', version: 1, groupId: `${owner.ship}/harness-tests`, clientLocale: `${marker}-setup1` }]
  await post(owner, ['Let\'s get set up.'], JSON.stringify(receipt))
  await until('a setup request in the channel is answered', () => answered('setup1'))
  assert.ok(inputs.some((input) => input.includes('The owner opens Tlonbot setup') && stepsIn(input).includes('setup1')), 'the setup request reaches the model as setup, from its receipt')
  await post(owner, [{ ship }, ` ${marker}-after1`])
  await until('the next mention after setup is answered', () => answered('after1'))

  await post(guest, [`${marker}-guest1 plain guest post`])
  await settle('settle1', ['guest1'])
  await unheard('an allowed guest without a mention is not heard', ['guest1'])

  // A quoted /stop is the owner's words, not a command: the running turn ends
  // with its answer, and the quote reaches the model attributed.
  holding = (step) => step === 'held1'
  await post(owner, [`${marker}-held1 a long question`])
  await until('held1 reached the model', () => requested('held1'))
  await post(owner, [{ blockquote: ['/stop'] }])
  await sleep(3000)
  release()
  await until('a quoted /stop does not stop the running turn', () => answered('held1'))
  await until('a quoted /stop reaches the model as attributed text', () => inputs.some((input) => input.includes(`${owner.ship}: /stop`)))
  await until('the quoted /stop is answered', () => answered('quoted'))

  // A burst of unmentioned owner lines never holds the cursor: a DM from the
  // guest is answered while the channel's turn is still held, and lines that
  // found no room are dropped, never answered later.
  const burst = Array.from({ length: 12 }, (_, i) => `b${i + 1}`)
  holding = (step) => burst.includes(step)
  const baseline = new Set((await botPosts()).map(([id]) => id))
  for (const step of burst) await post(owner, [`${marker}-${step} burst line`])
  await until('the burst reached the model', () => burst.some(requested))
  await dm(guest, `${marker}-dm1 a direct message`)
  await until('the guest\'s DM is answered while the channel is held', () => dmAnswered('dm1'), 90000)
  assert.ok(held.length > 0, 'the channel still had a held turn when the DM was answered')
  release()
  await settle('settle2', burst)
  const dropped = burst.filter((step) => !requested(step))
  assert.ok(dropped.length > 0, `some burst lines found no room: all of ${burst} reached the model`)
  await unheard(`burst lines that found no room are never answered (${dropped.join(', ')})`, dropped)
  const accepted = burst.filter(requested)
  for (const step of accepted) await until(`${step} is answered`, () => answered(step))
  // Every bot post since the burst answers accepted lines or the sentinel and
  // nothing else: no refusal notice or other reply to a dropped line.
  const expected = new Set([...accepted, 'settle2'])
  for (const [id, text] of (await botPosts()).filter(([id]) => !baseline.has(id))) {
    const steps = [...text.matchAll(new RegExp(`${marker}-(\\w+)-ok`, 'g'))].map((m) => m[1])
    assert.ok(steps.length > 0 && steps.every((step) => expected.has(step)), `unexpected bot post ${id} after the burst: ${text}`)
  }
  console.log('PASS the burst left no bot post but answers to accepted lines and the sentinel')

  // The owner's unmentioned remark is answered NO_REPLY: its run completes,
  // its publication is abandoned and nothing is posted, and the next message
  // is answered. The same answer to a mention is posted. Only the
  // unmentioned turn's request tells the model it may stay quiet.
  const instruction = 'The latest message in this channel does not mention you. If it is not meant for you and needs nothing from you, reply with exactly NO_REPLY and nothing else.'
  silent.add('quiet1'); silent.add('quiet2')
  const quietBaseline = new Set((await botPosts()).map(([id]) => id))
  await post(owner, [`${marker}-quiet1 a remark for someone else`])
  let quiet
  await until('quiet1 was admitted as heard without a mention', async () => (quiet = await admitted('quiet1')))
  assert.ok(quiet.source.event.startsWith('unaddressed/'), `quiet1 event id: ${quiet.source.event}`)
  await until('quiet1: its run completed', async () => (await client.call('harness/hand', { status: { binding: quiet.source.binding } }))
    .observations.some((o) => o.inputId === quiet.id && o.phase === 'completed'))
  await until('quiet1: its publication was abandoned', async () => (await client.call('harness/hand', { effect: { hand: 'tlon', effect: quiet.id } })).status === 'abandoned')
  const abandoned = await client.call('harness/hand', { effect: { hand: 'tlon', effect: quiet.id } })
  assert.equal(abandoned.text, 'NO_REPLY')
  assert.equal(abandoned.resolutions.at(-1).reason, 'The bot chose not to reply.')
  assert.deepEqual((await botPosts()).filter(([id]) => !quietBaseline.has(id)), [], 'a bot post appeared for quiet1')
  console.log('PASS an unmentioned remark answered NO_REPLY is abandoned and nothing is posted')
  await post(owner, [`${marker}-owner3 plain owner post`])
  await until('the next message after a quiet turn is answered', () => answered('owner3'))
  await post(owner, [{ ship }, ` ${marker}-quiet2`])
  await until('NO_REPLY to a mention is posted', async () => (await botPosts())
    .some(([id, text]) => !quietBaseline.has(id) && text.includes('NO_REPLY')))
  assert.ok(instructions('quiet1').includes(instruction), 'the unmentioned turn is told it may stay quiet')
  assert.ok(!instructions('quiet2').includes(instruction), 'the mentioned turn is not told it may stay quiet')
  console.log('PASS only the unmentioned turn is told it may stay quiet')

  // A provider error on the owner's unmentioned remark is not posted: the
  // failure notice is abandoned and the run report keeps the error. The same
  // error on a mention is posted.
  const rejection = 'The model provider rejected the request format or options.'
  rejected.add('broken1'); rejected.add('broken2')
  const brokenBaseline = new Set((await botPosts()).map(([id]) => id))
  await post(owner, [`${marker}-broken1 a remark for someone else`])
  let broken
  await until('broken1 was admitted as heard without a mention', async () => (broken = await admitted('broken1')))
  assert.ok(broken.source.event.startsWith('unaddressed/'), `broken1 event id: ${broken.source.event}`)
  await until('broken1: its failure notice was abandoned', async () => (await client.call('harness/hand', { effect: { hand: 'tlon', effect: broken.id } })).status === 'abandoned')
  const notice = await client.call('harness/hand', { effect: { hand: 'tlon', effect: broken.id } })
  assert.ok(notice.text.startsWith(rejection), `broken1 notice: ${notice.text}`)
  assert.equal(notice.resolutions.at(-1).reason, 'The run failed on a message that did not mention the bot.')
  assert.deepEqual((await botPosts()).filter(([id]) => !brokenBaseline.has(id)), [], 'a bot post appeared for broken1')
  const report = await client.call('harness/session/runs', { sessionId: broken.sid, lensId: broken.id })
  assert.equal(report.status, 'error')
  assert.ok(report.error.startsWith(rejection), `broken1 run error: ${report.error}`)
  assert.equal(report.delivery.status, 'abandoned')
  console.log('PASS a provider error on an unmentioned remark is abandoned, reported and not posted')
  await post(owner, [{ ship }, ` ${marker}-broken2`])
  await until('a provider error on a mention is posted', async () => (await botPosts())
    .some(([id, text]) => !brokenBaseline.has(id) && text.includes(rejection)))
  // Later turns carry the failed lines in their input; answer them.
  rejected.clear()

  // The one-channel call sets this channel's own rule and nothing else; the
  // owner then needs a mention there, and the guest keeps its access.
  const before = await client.call('harness/tlon')
  await assert.rejects(client.call('harness/tlon/channel/configure', {
    channel: nest, rule: { response: 'mentions', everyone: false }, expectedRevision: 'stale',
  }), /changed/i)
  await client.call('harness/tlon/channel/configure', {
    channel: nest, rule: { response: 'mentions', everyone: false }, expectedRevision: before.revision,
  })
  const after = (await client.call('harness/tlon')).policy
  const rule = { channel: nest, response: 'mentions', everyone: false }
  assert.deepEqual({ ...after, channels: [] }, { ...before.policy, channels: [] }, 'only channels changed')
  const rules = (list) => new Set(list.map((r) => `${r.channel} ${r.response} ${r.everyone}`))
  assert.deepEqual(rules(after.channels), rules([elsewhere, rule]), 'one channel gained its own rule')
  await post(owner, [`${marker}-owner2 plain owner post`])
  await settle('settle3', ['owner2'])
  await unheard('with its own mentions rule the owner needs a mention', ['owner2'])
  await post(guest, [{ ship }, ` ${marker}-guest2`])
  await until('the guest is still answered when it mentions the bot', () => answered('guest2'))
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ ok: true, dropped }))
} finally {
  release()
  if (defaults) await client.call('harness/defaults/configure', { config: { ...defaults, key: '' } })
  if (policy) await client.call('harness/tlon/configure', policy)
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
