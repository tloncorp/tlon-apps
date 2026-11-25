import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import {
  addressOf, capacity, daValue, idOf, lastRun, nextRun, offsetOf, options, parentOf, parseCron, parseExport, plan, resolve, run, stopOf, targetOf, tasksOf, timeOf,
} from './import-openclaw-schedules.mjs'

const script = fileURLToPath(new URL('./import-openclaw-schedules.mjs', import.meta.url))
const owner = '~sampel-palnet', other = '~wes', host = '~marzod'
const winter = new Date('2026-01-15T12:00:00Z'), summer = new Date('2026-07-15T12:00:00Z')
const nest = `chat/${host}/garden-club`

// Shaped like a job in `openclaw cron list --json --all`, with invented text.
function job({ payload, schedule, delivery, ...rest } = {}) {
  return {
    id: 'a1b2c3d4-0000-4000-8000-000000000001', agentId: 'main', name: 'weekday-digest', displayName: 'Weekday digest',
    enabled: true, createdAtMs: 1767225600000, updatedAtMs: 1767225600000, configRevision: 'r1', effectiveAgentId: 'main',
    schedule: { kind: 'cron', expr: '0 9 * * 1-5', tz: 'America/New_York', ...schedule },
    sessionTarget: 'isolated', wakeMode: 'now',
    payload: { kind: 'agentTurn', message: 'List the garden tasks due this week, shortest first.', timeoutSeconds: 600, ...payload },
    delivery: delivery === null ? undefined : { mode: 'announce', channel: 'tlon', to: `tlon:${owner}`, accountId: 'default', ...delivery },
    state: { nextRunAtMs: 1767268800000, lastRunStatus: 'ok', consecutiveErrors: 0 }, status: 'ok',
    ...rest,
  }
}
const planned = (overrides, options = {}) => plan(job(overrides), { owner, now: winter, ...options })

test('the export\'s jobs are read, without OpenClaw\'s three built-in kinds', () => {
  const jobs = [
    job({ declarationKey: 'heartbeat:main' }), job({ declarationKey: 'skill-collection-review:main' }),
    job({ declarationKey: 'memory-core:memory-dreaming-promotion' }), job({ declarationKey: 'heartbeat-task:water-plants' }),
    job({ declarationKey: 'garden-digest-v1' }), job(),
  ]
  assert.deepEqual(tasksOf({ jobs, total: 6, hasMore: false }), jobs.slice(3))
  assert.throws(() => tasksOf(jobs), /no jobs list/)
})

test('a task\'s id is a canonical @uv that every run derives alike, and differs between tasks', () => {
  const id = idOf(job())
  assert.match(id, /^0v[1-9a-v][0-9a-v]{0,4}(\.[0-9a-v]{5})*$/)
  assert.equal(idOf(job({ name: 'renamed', schedule: { expr: '0 10 * * *' } })), id, 'only the OpenClaw id decides it')
  assert.notEqual(idOf(job({ id: 'a1b2c3d4-0000-4000-8000-000000000002' })), id)
})

test('offsets on a fixed winter and summer day, whatever the machine\'s zone', () => {
  const zones = {
    'America/New_York': ['-05:00', '-04:00'], 'America/Los_Angeles': ['-08:00', '-07:00'], 'America/Chicago': ['-06:00', '-05:00'],
    'Asia/Kolkata': ['+05:30', '+05:30'], UTC: ['UTC', 'UTC'],
  }
  for (const [zone, [january, july]] of Object.entries(zones)) {
    assert.equal(offsetOf(zone, winter), january, `${zone} in winter`)
    assert.equal(offsetOf(zone, summer), july, `${zone} in summer`)
  }
  assert.equal(offsetOf('Europe/London', winter), 'UTC', 'a zone at UTC+0 is sent as UTC')
  assert.equal(offsetOf('Europe/London', summer), '+01:00')
  assert.equal(offsetOf('Africa/Abidjan', summer), 'UTC')
  assert.equal(offsetOf('Pacific/Kiritimati', winter), '+14:00')
  assert.throws(() => offsetOf('Mars/Olympus', winter), RangeError)
})

test('a cron task becomes a recurring prompt at the zone\'s offset on the day of the import, with no run count', () => {
  const result = planned()
  assert.deepEqual(result.import, {
    id: idOf(job()), kind: 'prompt', destination: { address: `dm/${owner}`, parent: null },
    args: { schedule: '0 9 * * 1-5', timezone: '-05:00', prompt: 'List the garden tasks due this week, shortest first.' },
  })
  assert.equal(result.stop, 'runs until cancelled')
  assert.ok(result.notes.some((note) => note === 'America/New_York sent as the fixed offset -05:00, which does not follow daylight saving'))
  assert.equal(planned({}, { now: summer }).import.args.timezone, '-04:00')
  const kolkata = planned({ schedule: { tz: 'Asia/Kolkata' } })
  assert.equal(kolkata.import.args.timezone, '+05:30')
  assert.ok(kolkata.notes.includes('Asia/Kolkata sent as the fixed offset +05:30'), 'no daylight-saving warning for a zone without it')
  const utc = planned({ schedule: { tz: 'UTC' } })
  assert.equal(utc.import.args.timezone, 'UTC')
  assert.ok(!utc.notes.some((note) => note.includes('fixed offset')))
})

test('--runs limits each recurring task to that many runs, and leaves a one-time task alone', () => {
  assert.equal(planned({}, { runs: 250 }).import.args.runs, '250')
  assert.ok(!('runs' in planned({ schedule: { kind: 'at', at: '2026-02-01T15:30:00.000Z' } }, { runs: 250 }).import.args))
})

test('a cron task with no zone is refused, never taken as UTC', () => {
  assert.deepEqual(planned({ schedule: { tz: undefined } }).refuse, 'no timezone in the export; recreate it by hand')
  assert.match(planned({ schedule: { tz: 'Mars/Olympus' } }).refuse, /unknown timezone Mars\/Olympus/)
})

test('a one-time task becomes a prompt at its time in UTC, if that is in the future and within ten years', () => {
  const at = '2026-02-01T15:30:00.000Z'
  assert.deepEqual(planned({ schedule: { kind: 'at', at, expr: undefined, tz: undefined } }).import.args, { at, prompt: job().payload.message })
  assert.equal(planned({ schedule: { kind: 'at', at: '2026-02-01T10:30:00-05:00', expr: undefined, tz: undefined } }).import.args.at, at)
  assert.match(planned({ schedule: { kind: 'at', at: '2026-01-15T11:59:00.000Z' } }).refuse, /its time, 2026-01-15 11:59 UTC, has passed/)
  assert.match(planned({ schedule: { kind: 'at', at: '2036-02-01T00:00:00.000Z' } }).refuse, /more than ten years away/)
  assert.match(planned({ schedule: { kind: 'at', at: 'tomorrow' } }).refuse, /unreadable time tomorrow/)
})

test('only enabled agent turns on a plain cron or one-time schedule are imported', () => {
  assert.deepEqual(planned({ enabled: false }).disabled, true)
  assert.equal(planned({ schedule: { kind: 'every', everyMs: 3_600_000, anchorMs: 0 } }).refuse, 'Harness has no interval schedules')
  assert.equal(planned({ schedule: { kind: 'on-exit' } }).refuse, 'Harness has no on-exit schedules')
  assert.equal(planned({ schedule: { kind: 'stream' } }).refuse, 'Harness has no stream schedules')
  assert.equal(planned({ payload: { kind: 'systemEvent', message: undefined, text: 'Check the greenhouse.' } }).refuse, 'a systemEvent task, not an agent turn')
  for (const kind of ['command', 'script', 'heartbeat']) assert.equal(planned({ payload: { kind } }).refuse, `a ${kind} task, not an agent turn`)
  assert.match(planned({ trigger: { script: 'exit 0' } }).refuse, /trigger script/)
})

test('a prompt must be 1 to 8,192 bytes', () => {
  assert.equal(planned({ payload: { message: '  ' } }).refuse, 'empty prompt')
  assert.equal(planned({ payload: { message: undefined } }).refuse, 'empty prompt')
  assert.ok(planned({ payload: { message: 'é'.repeat(4096) } }).import)
  assert.match(planned({ payload: { message: `${'é'.repeat(4096)}x` } }).refuse, /prompt of 8193 bytes; Harness takes at most 8192/)
})

test('tool lists: none or every tool imports, OpenClaw\'s default list imports with its size, and any other list needs --widen-tools', () => {
  assert.ok(planned().import, 'no list')
  assert.ok(planned({ payload: { toolsAllow: ['*'] } }).import, 'every tool')
  const defaults = planned({ payload: { toolsAllow: ['a', 'b'], toolsAllowIsDefault: true } })
  assert.ok(defaults.import)
  assert.ok(defaults.notes.includes('had OpenClaw\'s default list of 2 tools'))
  const limited = { payload: { toolsAllow: ['web_search', 'web_fetch', 'tlon'] } }
  assert.match(planned(limited).refuse, /^limited to 3 tools; .*--widen-tools imports it$/)
  for (const payload of [{ toolsAllow: [] }, { toolsAllow: [], toolsAllowIsDefault: true }]) {
    assert.match(planned({ payload }).refuse, /^limited to 0 tools/, 'an empty list allowed no tools, whatever its marker')
  }
  const widened = planned(limited, { widenTools: true })
  assert.ok(widened.import)
  assert.ok(!('toolsAllow' in widened.import.args), 'the tool list never reaches the head')
  assert.ok(widened.notes.includes('WARNING: was limited to 3 tools and now runs with its conversation\'s tools'))
  assert.ok(planned({ payload: { toolsAllow: [], toolsAllowIsDefault: true } }, { widenTools: true }).notes.includes('WARNING: was limited to 0 tools and now runs with its conversation\'s tools'))
})

test('a task in a hook session, or with outside content, is refused', () => {
  for (const sessionTarget of ['session:hook:webhook:orders', 'session:hook:gmail:inbox', 'Session:Hook:custom']) {
    assert.equal(planned({ sessionTarget, payload: { toolsAllow: ['*'] } }).refuse, 'runs in a hook session, whose prompt OpenClaw treats as untrusted outside content', sessionTarget)
  }
  assert.equal(planned({ payload: { externalContentSource: 'email' } }).refuse, 'its prompt is outside content from email, which OpenClaw treats as untrusted')
  assert.match(planned({ payload: { allowUnsafeExternalContent: true } }).refuse, /^allows unsafe outside content/)
  assert.ok(planned({ payload: { allowUnsafeExternalContent: false } }).import)
  assert.ok(planned({ sessionTarget: 'session:agent:main:tlon:direct:~sampel-palnet' }).import)
})

test('a task that posts nothing is refused unless --none-to-owner-dm, which posts it to the owner\'s DM', () => {
  assert.match(planned({ delivery: { mode: 'none', to: undefined, channel: undefined } }).refuse, /^delivery is off \(mode none\); .*--none-to-owner-dm/)
  assert.match(planned({ delivery: null }).refuse, /^no destination in the export/)
  assert.match(planned({ delivery: { to: undefined } }).refuse, /^no destination in the export/)
  for (const delivery of [{ mode: 'none', to: `tlon:${nest}`, threadId: `${owner}/170.141.184.507.774.836.402.186.419.052.111.462.400` }, null]) {
    const result = planned({ delivery }, { noneToOwnerDm: true })
    assert.deepEqual(result.import.destination, { address: `dm/${owner}`, parent: null })
    assert.ok(result.notes.some((note) => note.endsWith('posts to the owner\'s DM')))
  }
})

test('destinations: the owner\'s DM or a channel, in every spelling the plugin writes or accepts', () => {
  const dm = { kind: 'dm', ship: owner }, channel = { kind: 'channel', nest }
  for (const to of [owner, 'sampel-palnet', `tlon:${owner}`, `dm/${owner}`, `dm:${owner}`, `tlon:dm/${owner}`, ' ~Sampel-Palnet ']) assert.deepEqual(targetOf(to), dm, to)
  for (const to of [nest, `tlon:${nest}`, `group:${nest}`, `room:${nest}`, `room:${host}/garden-club`, `group:${host.slice(1)}/garden-club`, `CHAT/~MARZOD/garden-club`]) assert.deepEqual(targetOf(to), channel, to)
  assert.deepEqual(targetOf(`tlon:heap/${host}/photos`), { kind: 'channel', nest: `heap/${host}/photos` })
  assert.deepEqual(targetOf(`diary/${host}/notes-2026`), { kind: 'channel', nest: `diary/${host}/notes-2026` })
  assert.deepEqual(targetOf(`notes/${host}/book`), { kind: 'notebook', nest: `notes/${host}/book` })
  assert.equal(targetOf('https://example.com/hook'), null)
  assert.deepEqual(planned({ delivery: { to: `tlon:${nest}` } }).import.destination, { address: nest, parent: null })
  assert.deepEqual(planned({ delivery: { to: owner } }).import.destination, { address: `dm/${owner}`, parent: null })
})

test('another ship\'s DM, a notebook, another transport and an unknown target are refused', () => {
  assert.equal(planned({ delivery: { to: `tlon:${other}` } }).refuse, `a DM with ${other}, not the owner`)
  assert.equal(planned({ delivery: { to: `notes/${host}/book` } }).refuse, `notes/${host}/book is a notebook; Harness has no conversation there`)
  assert.equal(planned({ delivery: { channel: 'telegram', to: '12345' } }).refuse, 'delivers through telegram, not Tlon')
  assert.equal(planned({ delivery: { mode: 'webhook', to: 'https://example.com/hook' } }).refuse, 'delivery mode webhook has no Harness equivalent')
  assert.equal(planned({ delivery: { to: 'chat/not-a-ship!/x' } }).refuse, 'unrecognized destination chat/not-a-ship!/x')
})

test('what Harness does not carry is reported without refusing', () => {
  const result = planned({
    schedule: { staggerMs: 30000 }, payload: { model: 'fixture/model-a' }, sessionTarget: 'session:agent:main:tlon:direct:~sampel-palnet',
    deleteAfterRun: true, wakeMode: 'next-heartbeat', pacing: { minIntervalMs: 1 }, failureAlert: { after: 2, mode: 'announce' },
    delivery: { accountId: 'second', failureDestination: { mode: 'announce', to: owner } },
  })
  assert.ok(result.import)
  for (const expected of [/stagger of 30000 ms/, /model fixture\/model-a/, /ran in a named session; a Harness run gets no transcript/, /deleted after its run/,
    /wake mode next-heartbeat/, /pacing/, /failure alert/, /failure destination/, /account second/]) {
    assert.ok(result.notes.some((note) => expected.test(note)), String(expected))
  }
  assert.ok(!planned({ failureAlert: false }).notes.some((note) => /failure alert/.test(note)))
})

test('the date a new task stops: never without a count, and its last run with --runs', () => {
  const limited = (overrides) => planned(overrides, { runs: 100 }).stop
  assert.equal(planned({ schedule: { expr: '0 9 * * *' } }).stop, 'runs until cancelled')
  assert.equal(limited({ schedule: { expr: '0 9 * * *' } }), 'ends after 100 runs, on 2026-04-24 14:00 UTC')
  assert.equal(limited({ schedule: { expr: '0 */3 * * *', tz: 'UTC' } }), 'ENDS WITHIN 30 DAYS: tell its owner. ends after 100 runs, on 2026-01-28 00:00 UTC')
  assert.equal(planned({ schedule: { expr: '0 0 30 2 *' } }).stop, 'never runs within four years, so Harness will refuse it')
  assert.equal(limited({ schedule: { expr: '0 0 30 2 *' } }), 'never runs within four years, so Harness will refuse it')
  const foreign = planned({ schedule: { expr: '0 9 * * MON' } })
  assert.ok(foreign.import, 'the head, not the import, decides an expression')
  assert.match(foreign.stop, /outside Harness's cron grammar/)
  const leap = lastRun(parseCron('0 12 29 2 *'), 'UTC', winter, 100)
  assert.deepEqual([leap.count, new Date(leap.at).toISOString()], [1, '2028-02-29T12:00:00.000Z'], 'the search ends four years on, as the head\'s does')
  assert.equal(limited({ schedule: { expr: '0 12 29 2 *', tz: 'UTC' } }), 'ends after 1 runs, on 2028-02-29 12:00 UTC')
  assert.equal(planned({ schedule: { expr: '0 0 1 1 *', tz: 'UTC' } }, { runs: 1_000_000 }).stop, 'runs for more than a hundred years')
})

test('the date an existing schedule stops comes from its next run and the runs it has left', () => {
  const row = { state: 'active', schedule: '0 9 * * *', timezone: '-05:00', next: '~2026.1.16..14.00.00', remaining: 31 }
  assert.equal(stopOf(row, winter), 'last of its 31 runs on 2026-02-15 14:00 UTC')
  assert.equal(stopOf({ ...row, remaining: 3 }, winter), 'ENDS WITHIN 30 DAYS: tell its owner. last of its 3 runs on 2026-01-18 14:00 UTC')
  assert.equal(stopOf({ ...row, state: 'complete', remaining: 0 }, winter), 'complete, with 0 runs left')
  assert.equal(stopOf({ state: 'active', schedule: '2026-03-01T15:00:00.000Z', timezone: 'UTC', next: '~2026.3.1..15.00.00', remaining: 1 }, winter), 'last of its 1 runs on 2026-03-01 15:00 UTC')
})

test('a schedule with no count runs until cancelled, and a stopped one has no run count', () => {
  const row = { state: 'active', schedule: '0 9 * * *', timezone: '-05:00', next: '~2026.1.16..14.00.00', remaining: null }
  assert.equal(stopOf(row, winter), 'runs until cancelled')
  assert.equal(stopOf({ ...row, state: 'cancelled' }, winter), 'cancelled')
  assert.equal(stopOf({ ...row, state: 'paused' }, winter), 'paused')
})

test('the cron copy matches the head: steps, ranges, lists, ORed days and weekdays 0 to 6', () => {
  const next = (expression, offset, after) => new Date(nextRun(parseCron(expression), offset, Date.parse(after))).toISOString()
  // 2026-01-15 is a Thursday.
  assert.equal(next('0 23 * * 5', '-06:00', '2026-01-15T12:00:00Z'), '2026-01-17T05:00:00.000Z')
  assert.equal(next('0 9 * * *', '-06:00', '2026-01-15T12:00:00Z'), '2026-01-15T15:00:00.000Z')
  assert.equal(next('30 0 * * *', '+05:30', '2026-01-15T12:00:00Z'), '2026-01-15T19:00:00.000Z')
  assert.equal(next('0 0 20 * 1', 'UTC', '2026-01-15T12:00:00Z'), '2026-01-19T00:00:00.000Z', 'day-of-month or weekday')
  assert.equal(next('5/20 * * * *', 'UTC', '2026-01-15T12:30:00Z'), '2026-01-15T12:45:00.000Z')
  assert.equal(next('0 8-10/2,15 * * *', 'UTC', '2026-01-15T10:00:00Z'), '2026-01-15T15:00:00.000Z')
  assert.equal(next('0 0 * * 0', 'UTC', '2026-01-15T12:00:00Z'), '2026-01-18T00:00:00.000Z')
  for (const bad of ['0 9 * * 7', '0 9 * *', '0 9 * * * *', '60 * * * *', '0 9 * JAN *', '*/0 * * * *', '0 9 L * *', `${'0,'.repeat(61)}0 * * * *`]) {
    assert.throws(() => parseCron(bad), Error, bad)
  }
})

test('thread ids and Harness addresses name the same parent', () => {
  const ud = '170.141.184.507.774.836.402.186.419.052.111.462.400'
  assert.deepEqual(parentOf(`${owner}/${ud}`), { author: owner, id: 170141184507774836402186419052111462400n })
  assert.deepEqual(parentOf(ud.replaceAll('.', '')), { author: null, id: 170141184507774836402186419052111462400n })
  assert.equal(daValue('~2026.1.15..12.00.00'), 170141184507774836402186419052111462400n)
  assert.equal(new Date(timeOf('~2026.1.15..12.00.00..8000')).toISOString(), '2026-01-15T12:00:00.500Z')
  assert.equal(new Date(timeOf('~2026.1.15')).toISOString(), '2026-01-15T00:00:00.000Z')
  assert.deepEqual(addressOf(`dm/${owner}/${owner}/~2026.1.15..12.00.00`), { conversation: `dm/${owner}`, parent: { author: owner, id: 170141184507774836402186419052111462400n } })
  assert.deepEqual(addressOf(`${nest}/~2026.1.15..12.00.00`), { conversation: nest, parent: { author: null, id: 170141184507774836402186419052111462400n } })
  assert.deepEqual(addressOf(nest), { conversation: nest, parent: null })
  // Every millisecond survives the head's @da fraction, floor(ms * 2^64 / 1000).
  for (let ms = 0; ms < 1000; ms++) {
    const da = (((BigInt(ms) << 64n) / 1000n).toString(16).padStart(16, '0').match(/.{4}/g)).join('.').replace(/(\.0000)+$/, '')
    assert.equal(timeOf(`~2026.1.15..12.00.00${ms ? `..${da}` : ''}`), Date.parse('2026-01-15T12:00:00Z') + ms, String(ms))
  }
  assert.ok(planned({ sessionTarget: 'main' }).notes.includes('ran in the main session; a Harness run gets no transcript'))
})

test('a thread task goes to the existing thread conversation, else is refused unless --threads-to-parent', () => {
  const ud = '170.141.184.507.774.836.402.186.419.052.111.462.400', da = '~2026.1.15..12.00.00'
  const conversations = [
    { binding: 'b-dm', destination: `dm/${owner}` }, { binding: 'b-channel', destination: nest },
    { binding: 'b-dm-thread', destination: `dm/${owner}/${owner}/${da}` }, { binding: 'b-channel-thread', destination: `${nest}/${da}` },
  ]
  const dmThread = planned({ delivery: { to: `tlon:${owner}`, threadId: ud } }).import.destination
  assert.deepEqual(dmThread.parent, { author: owner, id: 170141184507774836402186419052111462400n }, 'a DM thread with no author is the partner\'s message')
  assert.equal(resolve(dmThread, conversations).binding, 'b-dm-thread')
  const channelThread = planned({ delivery: { to: `tlon:${nest}`, threadId: `${other}/${ud}` } }).import.destination
  assert.equal(resolve(channelThread, conversations).binding, 'b-channel-thread')
  const missing = planned({ delivery: { to: `tlon:${nest}`, threadId: '170141184507774836402186419052111462401' } }).import.destination
  assert.equal(resolve(missing, conversations).refuse, 'no conversation in that thread yet; --threads-to-parent posts to its DM or channel instead')
  assert.deepEqual(resolve(missing, conversations, { threadsToParent: true }), { binding: 'b-channel', address: nest, notes: ['posts to the conversation, not the thread'] })
  assert.deepEqual(resolve(dmThread, conversations.slice(1, 2), { threadsToParent: true }), { address: `dm/${owner}`, notes: ['posts to the conversation, not the thread'] })
  assert.equal(planned({ delivery: { threadId: 'not-an-id' } }).refuse, 'unreadable thread id not-an-id')
})

// A ship with these conversations and schedules; calls records what was sent.
// A stand-in head: it keeps schedules, answers an identical repeat with the
// row it holds, refuses a different one, and lets a test edit a row as
// harness/cron/edit does, keeping the id. calls records what was sent.
function ship({ schedules = [], conversations = [{ binding: 'b-dm', destination: `dm/${owner}` }, { binding: 'b-channel', destination: nest }], policy = { enabled: true, owner }, headConnected = true, refuse = () => null } = {}) {
  const calls = [], held = new Map(schedules.map((row) => [row.id, { row }]))
  const pages = [conversations.slice(0, 1), conversations.slice(1)]
  const client = { call: async (method, params) => {
    calls.push({ method, params })
    if (method === 'harness/tlon') return { policy }
    if (method === 'harness/tlon/work') {
      const index = params.before === '' ? 0 : 1
      const records = pages[index].flatMap((row, n) => [
        { kind: 'input', current: false, binding: `stale-${n}`, destination: row.destination },
        { kind: 'input', current: true, ...row }, { kind: 'admission', destination: row.destination },
      ])
      return { records, next: index ? null : 'cursor', limit: 16, headConnected }
    }
    if (method === 'harness/tlon/schedule-destination') {
      if (params.address !== `dm/${owner}`) return { refuse: 'the bot cannot post there' }
      if (params.open) conversations.push({ binding: 'owner-dm', destination: params.address })
      return { binding: 'owner-dm', ready: conversations.some(({ binding }) => binding === 'owner-dm') }
    }
    if (method === 'harness/cron') return [...held.values()].map(({ row }) => ({ ...row }))
    if (method === 'harness/hand') return { binding: params.status.binding, hand: 'tlon', enabled: true }
    if (method === 'harness/cron/add') {
      const refusal = refuse(params), request = JSON.stringify(params)
      if (refusal) throw new Error(refusal)
      const prior = held.get(params.id)
      if (prior) {
        if (prior.request !== request) throw new Error('Schedule ID already belongs to a different request')
        return { ...prior.row }
      }
      if (held.size >= capacity) throw new Error('Schedule capacity reached; clear settled jobs in Settings')
      const { args } = params
      const row = {
        id: params.id, sourceBinding: params.binding, actor: params.actor, kind: params.kind, prompt: args.prompt,
        destination: conversations.find(({ binding }) => binding === params.binding).destination,
        schedule: args.schedule ?? args.at, timezone: args.timezone ?? 'UTC', next: '~2026.1.15..14.00.00', remaining: args.at ? 1 : args.runs ? Number(args.runs) : null, state: 'active',
      }
      held.set(params.id, { row, request })
      return { ...row }
    }
    throw new Error(`unexpected ${method}`)
  } }
  const edit = (id, change) => Object.assign(held.get(id).row, change)
  return { client, calls, edit, rows: () => [...held.values()].map(({ row }) => ({ ...row })) }
}
const exported = (jobs) => ({ jobs, total: jobs.length, offset: 0, limit: 200, hasMore: false, nextOffset: null, snapshotRevision: 's1', deliveryPreviews: {} })
async function importing(client, jobs, options = {}) {
  const lines = []
  const code = await run({ client, exported: exported(jobs), owner, now: winter, print: (line) => lines.push(line), ...options })
  return { code, output: lines.join('\n'), lines }
}

test('an import creates each planned task in its conversation as the owner, and names every refusal', async () => {
  const jobs = [job(), job({ id: 'j2', name: 'channel', delivery: { to: `tlon:${nest}` } }), job({ id: 'j3', name: 'gone', delivery: { to: `chat/${host}/no-such-channel` } }),
    job({ id: 'j4', name: 'off', enabled: false }), job({ id: 'j5', name: 'beat', declarationKey: 'heartbeat:main' })]
  const { client, calls } = ship()
  const { code, output, lines } = await importing(client, jobs)
  assert.equal(code, 0)
  const adds = calls.filter(({ method }) => method === 'harness/cron/add').map(({ params }) => params)
  assert.deepEqual(adds.map(({ id, binding, actor, kind }) => [id, binding, actor, kind]), [[idOf(jobs[0]), 'b-dm', owner, 'prompt'], [idOf(jobs[1]), 'b-channel', owner, 'prompt']])
  assert.ok(calls.some(({ method, params }) => method === 'harness/tlon/work' && params.before === 'cursor'), 'every page of conversations is read')
  assert.match(lines[0], /^4 tasks from the export, 1 built-in OpenClaw jobs left out, 2 Tlon conversations with recorded input$/)
  assert.match(output, /- Weekday digest \| cron "0 9 \* \* 1-5" America\/New_York \| dm\/~sampel-palnet \| imported, next run 2026-01-15 14:00 UTC \| /)
  assert.match(output, new RegExp(`- Weekday digest \\| .* \\| chat/${host}/no-such-channel \\| refused: the bot cannot post there`))
  assert.match(output, /disabled, not imported/)
  assert.match(lines.at(-1), /^imported 2, refused 1, disabled 1, of 4 tasks\.$/)
  assert.ok(!output.includes(job().payload.message), 'prompts are not printed')
})

test('an owner DM with no input is previewed, opened on apply and reused on retry', async () => {
  const head = ship({ conversations: [] })
  const jobs = [job()]
  const preview = await importing(head.client, jobs, { dryRun: true })
  assert.match(preview.output, /would import/)
  assert.ok(head.calls.every(({ params }) => !params?.open))
  assert.match((await importing(head.client, jobs)).output, /imported 1/)
  assert.match((await importing(head.client, jobs)).output, /already there 1/)
  assert.equal(head.calls.filter(({ params }) => params?.open).length, 1)
})

test('a dry run sends no create and says what is already there', async () => {
  const head = ship()
  await importing(head.client, [job()])
  const before = head.rows(), sent = head.calls.length
  const dry = await importing(head.client, [job(), job({ id: 'j2' })], { dryRun: true })
  assert.equal(dry.code, 0)
  assert.ok(!head.calls.slice(sent).some(({ method }) => method === 'harness/cron/add'))
  assert.deepEqual(head.rows(), before)
  assert.match(dry.output, /\| already there \| /)
  assert.match(dry.output, /\| would import/)
  assert.match(dry.lines.at(-1), /^Dry run: would import 1, already there 1, of 2 tasks\.$/)
})
test('a rerun repeats its creates, which make nothing, and reports them as already there', async () => {
  const head = ship(), jobs = [job(), job({ id: 'j2', delivery: { to: nest } })]
  assert.equal((await importing(head.client, jobs)).code, 0)
  const made = head.rows()
  assert.equal(made.length, 2)
  const { code, output, lines } = await importing(head.client, jobs)
  assert.equal(code, 0)
  assert.deepEqual(head.rows(), made, 'the rerun creates and changes nothing')
  assert.equal(head.calls.filter(({ method }) => method === 'harness/cron/add').length, 4, 'the head checks each repeat')
  assert.match(output, /already there, next run 2026-01-15 14:00 UTC \| .*runs until cancelled$/m)
  assert.match(lines.at(-1), /^already there 2, of 2 tasks\.$/)
})

test('a repeat that returns an edited schedule is reported as differing, left alone, and exits 1', async () => {
  const head = ship()
  await importing(head.client, [job()])
  const [row] = head.rows()
  for (const change of [{ schedule: '0 17 * * 1-5' }, { prompt: 'Edited by the owner.' }, { timezone: '-06:00' }, { destination: nest, sourceBinding: 'b-channel' }]) {
    head.edit(row.id, { ...row, ...change })
    const edited = head.rows()
    for (const dryRun of [false, true]) {
      const { code, output } = await importing(head.client, [job()], { dryRun })
      assert.equal(code, 1, JSON.stringify(change))
      assert.match(output, /\| exists but differs \(edited since import\?\); left as it is/)
      assert.doesNotMatch(output, /already there/)
      assert.match(output, /\bexists but differs 1, of 1 tasks\.$/m)
    }
    assert.deepEqual(head.rows(), edited, 'nothing is changed')
  }
})

test('an existing schedule\'s line gives its own stop date, not a fresh hundred runs', async () => {
  const head = ship()
  await importing(head.client, [job({ schedule: { expr: '0 9 * * *' } })], { runs: 100 })
  const [row] = head.rows()
  head.edit(row.id, { next: '~2026.1.16..14.00.00', remaining: 3 })
  for (const dryRun of [false, true]) {
    const { output } = await importing(head.client, [job({ schedule: { expr: '0 9 * * *' } })], { dryRun, runs: 100 })
    assert.match(output, /already there.*[|;] ENDS WITHIN 30 DAYS: tell its owner\. last of its 3 runs on 2026-01-18 14:00 UTC$/m)
    assert.doesNotMatch(output, /hundredth/)
  }
})
test('tasks past the 64-schedule limit are refused by name; a repeated id needs no room', async () => {
  const jobs = ['first', 'second', 'kept'].map((name) => job({ id: name, displayName: name }))
  const held = Array.from({ length: capacity - 2 }, (_, index) => ({ id: `0v${index + 1}` }))
  const head = ship({ schedules: held })
  await importing(head.client, [jobs[2]])
  const { output } = await importing(head.client, jobs)
  assert.equal(head.rows().length, capacity)
  assert.match(output, /^- first .*\| imported/m)
  assert.match(output, /^- second .*\| refused: would pass Harness's limit of 64 schedules/m)
  assert.match(output, /^- kept .*\| already there/m)
})

test('capacity counts only the creates that succeed', async () => {
  const jobs = ['broken', 'good'].map((name) => job({ id: name, displayName: name }))
  const head = ship({ schedules: Array.from({ length: capacity - 1 }, (_, index) => ({ id: `0v${index + 1}` })), refuse: ({ id }) => id === idOf(jobs[0]) ? 'Invalid schedule request' : null })
  const { code, output } = await importing(head.client, jobs)
  assert.equal(code, 1)
  assert.match(output, /^- broken .*\| failed: Invalid schedule request/m)
  assert.match(output, /^- good .*\| imported/m)
})
test('a create the head refuses is reported, the rest go on, and the exit code is 1', async () => {
  const jobs = [job({ id: 'j1' }), job({ id: 'j2' })]
  const { client } = ship({ refuse: ({ id }) => id === idOf(jobs[0]) ? 'Schedule ID already belongs to a different request' : null })
  const { code, output } = await importing(client, jobs)
  assert.equal(code, 1)
  assert.match(output, /failed: Schedule ID already belongs to a different request/)
  assert.match(output, /imported, next run/)
})

test('nothing is imported when the hand is not the owner\'s or the adapter is disconnected', async () => {
  for (const policy of [{ enabled: true, owner: other }, { enabled: false, owner }, { enabled: true, owner: null }]) {
    const { client, calls } = ship({ policy })
    const { code, output } = await importing(client, [job()])
    assert.equal(code, 1)
    assert.match(output, /^Refused: the Tlon hand is .*Nothing was imported\.$/)
    assert.ok(!calls.some(({ method }) => method === 'harness/cron/add'))
  }
  await assert.rejects(importing(ship({ headConnected: false }).client, [job()]), /not connected to the Harness head/)
})

test('a rerun without --runs over a task imported earlier with a count says so, sends nothing for it, and is not a failure', async () => {
  const head = ship(), jobs = [job(), job({ id: 'j2', delivery: { to: nest }, schedule: { kind: 'at', at: '2026-02-01T15:30:00.000Z' } })]
  await importing(head.client, jobs, { runs: 100 })
  const made = head.rows(), sent = head.calls.filter(({ method }) => method === 'harness/cron/add').length
  for (const dryRun of [false, true]) {
    const { code, output } = await importing(head.client, jobs, { dryRun })
    assert.equal(code, 0)
    assert.match(output, /^- Weekday digest .*\| exists with a run limit \(imported earlier\); left as it is \| .*last of its 100 runs on 2026-06-03 14:00 UTC$/m)
    assert.match(output, new RegExp(`chat/${host}/garden-club \\| already there`), 'a one-time task has no count to differ by')
  }
  assert.equal(head.calls.filter(({ method }) => method === 'harness/cron/add').length, sent + 1, 'only the one-time task is sent again')
  assert.deepEqual(head.rows(), made)
  head.edit(made[0].id, { prompt: 'Edited by the owner.' })
  const edited = await importing(head.client, jobs)
  assert.equal(edited.code, 1, 'an edited one is not the same task')
  assert.match(edited.output, /failed: Schedule ID already belongs to a different request/)
})

test('under --runs, a schedule edited to no count or to more runs differs, and one with runs used up is already there', async () => {
  const head = ship()
  await importing(head.client, [job()], { runs: 100 })
  const [row] = head.rows()
  for (const remaining of [null, 250]) {
    head.edit(row.id, { remaining })
    for (const dryRun of [false, true]) {
      const { code, output } = await importing(head.client, [job()], { dryRun, runs: 100 })
      assert.equal(code, 1, `remaining ${remaining}`)
      assert.match(output, /\| exists but differs \(edited since import\?\); left as it is/)
      assert.doesNotMatch(output, /already there/)
    }
    assert.equal(head.rows()[0].remaining, remaining, 'nothing is changed')
  }
  head.edit(row.id, { remaining: 40 })
  for (const dryRun of [false, true]) {
    const { code, output } = await importing(head.client, [job()], { dryRun, runs: 100 })
    assert.equal(code, 0)
    assert.match(output, /\| already there/)
  }
})

test('a desk that refuses a recurring create without a count gets a hint to rerun with --runs', async () => {
  const old = 'Require an authorized actor and prompt 1..4096 bytes with either a future RFC3339 at timestamp (explicit offset or Z) or a five-field schedule with timezone UTC or a fixed +HH:MM/-HH:MM offset and runs 1..100. Literal reminders require at and text, and a destination only if it names this conversation.'
  const refuse = ({ args }) => args.schedule && !args.runs ? old : null
  const { code, output } = await importing(ship({ refuse }).client, [job()])
  assert.equal(code, 1)
  assert.ok(output.includes(`failed: ${old}; if this desk predates optional run counts, rerun with --runs 100`))
  const fixed = await importing(ship({ refuse }).client, [job()], { runs: 100 })
  assert.equal(fixed.code, 0)
  assert.match(fixed.output, /\| imported, /)
  assert.doesNotMatch((await importing(ship({ refuse: () => 'Invalid schedule request' }).client, [job()])).output, /rerun with --runs/)
})

test('a malformed export names at most a position, never its text', () => {
  const text = '{"jobs":[{"payload":{"message":Invented secret prompt}}]}'
  assert.throws(() => parseExport(text), (error) => /^The export is not valid JSON( \(at position \d+\))?; nothing was imported\.$/.test(error.message) && !error.message.includes('Invented'))
  assert.deepEqual(parseExport('{"jobs":[]}'), { jobs: [] })
})

test('the command\'s options take a canonical owner and refuse anything else', () => {
  assert.deepEqual(options(['--from', 'export.json', '--owner', 'Sampel-Palnet', '--dry-run']), { from: 'export.json', owner, dryRun: true })
  assert.deepEqual(options(['--owner', owner, '--from', 'x', '--widen-tools', '--none-to-owner-dm', '--threads-to-parent']),
    { owner, from: 'x', widenTools: true, noneToOwnerDm: true, threadsToParent: true })
  assert.deepEqual(options(['--from', 'x', '--owner', owner, '--runs', '250']), { from: 'x', owner, runs: 250 })
  assert.equal(options(['--from', 'x', '--owner', owner, '--runs', '1000000']).runs, 1_000_000)
  for (const args of [[], ['--from', 'x'], ['--from', 'x', '--owner', 'not-a-ship'], ['--from', 'x', '--owner', owner, '--force'], ['--from=x', '--owner', owner],
    ...['0', '1000001', 'ten', '2.5', '-3', ''].map((runs) => ['--from', 'x', '--owner', owner, '--runs', runs]), ['--from', 'x', '--owner', owner, '--runs']]) {
    assert.equal(options(args), null, args.join(' '))
  }
})

test('the command refuses unknown options and runs through a symlink', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harness-schedules-unit-'))
  t.after(() => rm(directory, { recursive: true }))
  const link = join(directory, 'import-openclaw-schedules.mjs'), file = join(directory, 'export.json')
  await symlink(script, link)
  await writeFile(file, JSON.stringify(exported([job()])))
  const execute = (...args) => promisify(execFile)(process.execPath, [link, ...args], { timeout: 5000, env: { PATH: process.env.PATH } })
  for (const args of [[], ['--from', file], ['--from', file, '--owner', owner, '--force'], ['--from', file, '--owner', 'not a ship'], ['--from', file, '--owner']]) {
    await assert.rejects(execute(...args), (error) => error.code === 1 && error.stderr.startsWith('Usage: ') && error.stderr.includes("--owner '~sampel-palnet'"), args.join(' '))
  }
  await writeFile(join(directory, 'bad.json'), '{"jobs":[{"payload":{"message":Invented secret prompt}}]}')
  await assert.rejects(execute('--from', join(directory, 'bad.json'), '--owner', owner),
    (error) => error.code === 1 && /^The export is not valid JSON/.test(error.stderr) && !error.stderr.includes('Invented'))
  // Without a cookie the import fails once the options pass, which shows it ran.
  await assert.rejects(execute('--from', file, '--owner', owner, '--dry-run', '--widen-tools', '--none-to-owner-dm', '--threads-to-parent'),
    (error) => error.code === 1 && /Set SHIP_COOKIE/.test(error.stderr))
})
