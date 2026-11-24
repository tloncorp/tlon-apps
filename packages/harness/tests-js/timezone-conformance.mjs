// Live end-to-end verification of owner timezone: hosted provisioning & settings,
// ACP read/set, scry, owner-only set_timezone tool, local current_time, turn
// prompt injection, and IANA / defaulted recurring schedules. Restores the
// ship's prior timezone and cancels fixture schedules on exit.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const marker = `timezone-${randomUUID()}`
const client = new Client()
const hand = new HandClient(client, { hand: `fixture-tz-${marker}`, worker: marker })
const errors = []
const schedules = new Set()
const bindings = []
const calls = []
let savedBefore = null
let restored = false

const answer = (res, text, tools = []) => res.end(JSON.stringify({
  choices: [{
    finish_reason: tools.length ? 'tool_calls' : 'stop',
    message: { role: 'assistant', content: text, ...(tools.length ? { tool_calls: tools } : {}) },
  }],
  usage: { prompt_tokens: 1, completion_tokens: 1 },
}))
const tool = (name, args) => ({
  id: `${marker}-${name}-${randomUUID()}`,
  type: 'function',
  function: { name, arguments: JSON.stringify(args) },
})

async function hosted(endpoint, body, expected = 200) {
  const response = await fetch(`${base}/spider/harness/json/hosted-${endpoint}/json.json`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  })
  assert.equal(response.status, 200, `${endpoint}: HTTP status`)
  const result = await response.json()
  assert.equal(result.status, expected, `${endpoint}: hosted status (got ${JSON.stringify(result)})`)
  return result.body
}

async function scry(path) {
  const response = await fetch(`${base}/~/scry/${path}.json`, {
    headers: { cookie },
    signal: AbortSignal.timeout(15_000),
  })
  assert.ok(response.ok, `${path}: HTTP ${response.status}`)
  return response.json()
}

async function until(label, read, timeout = 60_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (errors.length) throw new AggregateError(errors)
    const value = await read()
    if (value) return value
    await sleep(200)
  }
  throw new Error(`Timed out: ${label}`)
}

let clockResult = null
let handClockResult = null
let sharedClockResult = null
let defaultJob = null
let explicitJob = null
let sharedOmitReceipt = null
let sharedUtcJob = null
let sawSystemNote = false
let sharedSawSystemNote = false
let handHidSetTimezone = false

const server = createServer(async (req, res) => {
  try {
    const body = JSON.parse(await readText(req))
    calls.push(body)
    res.writeHead(200, { 'content-type': 'application/json' })
    const system = body.messages.find((m) => m.role === 'system')?.content ?? ''
    if (system.includes("The owner's timezone is America/New_York.")) sawSystemNote = true
    const lastUser = body.messages.findLastIndex((m) => m.role === 'user')
    const prompt = body.messages[lastUser]?.content ?? ''
    const receipts = body.messages.slice(lastUser + 1).filter((m) => m.role === 'tool')
    if (prompt.includes('OWNER_TURN')) {
      if (receipts.length === 0) {
        assert.ok(body.tools.some((t) => t.function.name === 'set_timezone'), 'owner turn offers set_timezone')
        return answer(res, '', [tool('set_timezone', { timezone: 'America/Los_Angeles' })])
      }
      if (receipts.length === 1) {
        const setRes = JSON.parse(receipts[0].content)
        assert.equal(setRes.timezone, 'America/Los_Angeles')
        assert.match(setRes.local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/)
        return answer(res, '', [tool('current_time', {})])
      }
      clockResult = JSON.parse(receipts[1].content)
      return answer(res, `${marker}-owner-done`)
    }
    if (prompt.includes('HAND_TURN')) {
      handHidSetTimezone = !body.tools.some((t) => t.function.name === 'set_timezone')
      if (receipts.length === 0) {
        return answer(res, '', [tool('current_time', {})])
      }
      if (receipts.length === 1) {
        handClockResult = JSON.parse(receipts[0].content)
        return answer(res, '', [
          tool('cron_add', { schedule: '0 9 * * 1', prompt: `${marker}-default-tz`, runs: '2' }),
          tool('cron_add', { schedule: '0 9 * * 1', timezone: 'Europe/London', prompt: `${marker}-explicit-tz`, runs: '2' }),
        ])
      }
      defaultJob = JSON.parse(receipts[1].content)
      explicitJob = JSON.parse(receipts[2].content)
      schedules.add(defaultJob.id)
      schedules.add(explicitJob.id)
      return answer(res, `${marker}-hand-done`)
    }
    if (prompt.includes('SHARED_TURN')) {
      if (system.includes("owner's timezone") || system.includes('America/Los_Angeles')) {
        sharedSawSystemNote = true
      }
      if (receipts.length === 0) {
        return answer(res, '', [tool('current_time', {})])
      }
      if (receipts.length === 1) {
        sharedClockResult = JSON.parse(receipts[0].content)
        return answer(res, '', [
          tool('cron_add', { schedule: '0 9 * * 1', prompt: `${marker}-shared-omit`, runs: '2' }),
          tool('cron_add', { schedule: '0 9 * * 1', timezone: 'UTC', prompt: `${marker}-shared-utc`, runs: '2' }),
        ])
      }
      sharedOmitReceipt = receipts[1].content
      sharedUtcJob = JSON.parse(receipts[2].content)
      schedules.add(sharedUtcJob.id)
      return answer(res, `${marker}-shared-done`)
    }
    return answer(res, `${marker}-unexpected`)
  } catch (error) {
    errors.push(error)
    if (!res.headersSent) res.writeHead(500)
    res.end('Fixture failure')
  }
})

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()

  savedBefore = await client.call('harness/timezone')

  // 1. Hosted capabilities + hosted-timezone read/write/conflict/validation/clear
  const capabilities = await hosted('capabilities', {})
  assert.equal(capabilities.timezone, true)

  const initial = await hosted('timezone', {})
  const cleared = await hosted('timezone', { revision: initial.revision, timezone: null })
  assert.equal(cleared.timezone, null)
  assert.equal(cleared.utcOffset, null)

  await hosted('timezone', { revision: initial.revision, timezone: 'UTC' }, cleared.revision === initial.revision ? 200 : 409)
  const fresh = await hosted('timezone', {})
  if (fresh.timezone !== null) {
    await hosted('timezone', { revision: fresh.revision, timezone: null })
  }
  const empty = await hosted('timezone', {})
  assert.equal(empty.timezone, null)
  await hosted('timezone', { revision: empty.revision, timezone: 'PST' }, 400)
  await hosted('timezone', { revision: empty.revision, zone: 'UTC' }, 400)

  const setHosted = await hosted('timezone', { revision: empty.revision, timezone: 'Asia/Tokyo' })
  assert.equal(setHosted.timezone, 'Asia/Tokyo')
  assert.equal(setHosted.utcOffset, '+09:00')
  await hosted('timezone', { revision: empty.revision, timezone: 'UTC' }, 409)

  // Scry and ACP agree with hosted read.
  const acpRead = await client.call('harness/timezone')
  assert.equal(acpRead.timezone, 'Asia/Tokyo')
  assert.equal(acpRead.utcOffset, '+09:00')
  const scryRead = await scry('harness/timezone')
  assert.equal(scryRead.timezone, 'Asia/Tokyo')
  assert.equal(scryRead.utcOffset, '+09:00')

  // 2. ACP set / validation / clear
  await assert.rejects(client.call('harness/timezone/set', { timezone: 'EST' }), /Invalid IANA timezone/)
  const acpCleared = await client.call('harness/timezone/set', { timezone: null })
  assert.equal(acpCleared.timezone, null)

  // 3. Provisioning initializes timezone once, rejects invalid, never overwrites existing
  await hosted('provision', { providerKeys: {}, timezone: 'PST' }, 400)
  await hosted('provision', { providerKeys: {}, timezone: 'America/New_York' }, 200)
  assert.equal((await client.call('harness/timezone')).timezone, 'America/New_York')
  await hosted('provision', { providerKeys: {}, timezone: 'Asia/Tokyo' }, 200)
  assert.equal((await client.call('harness/timezone')).timezone, 'America/New_York')

  // 4. Direct owner turn: system prompt note, set_timezone, local current_time
  const { sessionId } = await client.call('session/new', { name: marker })
  const config = await client.call('harness/session/config', { sessionId })
  await client.call('harness/session/configure', {
    sessionId,
    config: {
      ...config,
      key: '',
      url: `http://127.0.0.1:${server.address().port}/completions`,
      model: 'timezone-fixture',
      system: 'Synthetic timezone test.',
      headers: [],
      tools: [],
    },
  })

  await client.call('session/prompt', {
    sessionId,
    prompt: [{ type: 'text', text: 'OWNER_TURN: Switch to LA and check the time.' }],
  })
  await until('owner turn finishes with set_timezone and current_time', () => clockResult)
  assert.equal(sawSystemNote, true, 'turn system prompt states configured owner timezone')
  assert.equal(clockResult.timezone, 'America/Los_Angeles')
  assert.match(clockResult.local, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-0[78]:00$/)
  assert.match(clockResult.date, /^\d{4}-\d{2}-\d{2}$/)
  assert.match(clockResult.time, /^\d{2}:\d{2}:\d{2}$/)
  assert.ok(['-07:00', '-08:00'].includes(clockResult.utcOffset))
  assert.ok(clockResult.weekday && clockResult.utcWeekday)
  assert.equal((await client.call('harness/timezone')).timezone, 'America/Los_Angeles')

  // 5. Private single-actor hand turn: hides owner-only set_timezone, sees local time,
  //    and defaults/accepts IANA cron zones
  const { sessionId: privateHandSid } = await client.call('session/new', { name: `${marker}-private-hand` })
  await client.call('harness/session/configure', {
    sessionId: privateHandSid,
    config: {
      ...config,
      key: '',
      url: `http://127.0.0.1:${server.address().port}/completions`,
      model: 'timezone-fixture',
      system: 'Synthetic timezone test.',
      headers: [],
      tools: [],
    },
  })
  await hand.bind(privateHandSid, { sessionId: privateHandSid, address: `room/${marker}`, actors: ['alice'] })
  bindings.push(privateHandSid)
  await hand.observe(privateHandSid, { event: `${marker}-hand`, actor: 'alice', text: 'HAND_TURN: Add two weekly schedules.' })
  await until('hand turn creates IANA and defaulted schedules', () => explicitJob)
  assert.equal(handHidSetTimezone, true, 'non-admin hand turn hides set_timezone')
  assert.equal(handClockResult.timezone, 'America/Los_Angeles')
  assert.equal(defaultJob.timezone, 'America/Los_Angeles', 'omitted cron_add timezone defaults to owner timezone')
  assert.equal(explicitJob.timezone, 'Europe/London', 'explicit IANA timezone is preserved')

  const handOut = await until('hand reply', async () => (await hand.outbox()).find((effect) => effect.sessionId === privateHandSid))
  await hand.deliver(handOut.effectId, async () => 'fixture-delivered')

  // 6. Shared multi-speaker hand conversation: withholds owner timezone from system prompt,
  //    current_time, and cron_add default even when the ship/owner speaks.
  const { sessionId: sharedSid } = await client.call('session/new', { name: `${marker}-shared` })
  await client.call('harness/session/configure', {
    sessionId: sharedSid,
    config: {
      ...config,
      key: '',
      url: `http://127.0.0.1:${server.address().port}/completions`,
      model: 'timezone-fixture',
      system: 'Synthetic shared timezone test.',
      headers: [],
      tools: [],
    },
  })
  await hand.bind(sharedSid, { sessionId: sharedSid, address: `shared/${marker}`, actors: ['*'] })
  bindings.push(sharedSid)
  await hand.observe(sharedSid, { event: `${marker}-shared`, actor: '~zod', text: 'SHARED_TURN: Check time and schedule.' })
  await until('shared turn completes', () => sharedUtcJob)
  assert.equal(sharedSawSystemNote, false, 'shared conversation omits owner timezone from system prompt')
  assert.equal(sharedClockResult.timezone, 'UTC', 'shared conversation current_time reports UTC timezone')
  assert.equal(sharedClockResult.local, undefined, 'shared conversation current_time omits local time')
  assert.match(sharedClockResult.utc, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/)
  assert.match(sharedOmitReceipt, /^error:/, 'shared conversation rejects cron_add without explicit timezone')
  assert.ok(!sharedOmitReceipt.includes('America/Los_Angeles'), 'shared conversation cron_add error does not echo owner timezone')
  assert.equal(sharedUtcJob.timezone, 'UTC', 'shared conversation accepts explicit UTC cron_add')

  const sharedOut = await until('shared hand reply', async () => (await hand.outbox()).find((effect) => effect.sessionId === sharedSid))
  await hand.deliver(sharedOut.effectId, async () => 'fixture-delivered')

  console.log('Owner timezone: hosted, provision, ACP, scry, set_timezone, local current_time, shared isolation, and IANA cron PASS')
} finally {
  for (const id of schedules) {
    try { await hand.cancelSchedule(id) } catch {}
    try { await hand.clearSchedule(id) } catch {}
  }
  for (const binding of bindings) {
    try { await hand.enable(binding, false) } catch {}
  }
  if (savedBefore !== null && !restored) {
    try {
      await client.call('harness/timezone/set', { timezone: savedBefore.timezone ?? null })
      restored = true
    } catch {}
  }
  server.close()
  await client.close()
}
