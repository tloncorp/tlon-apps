// The OpenClaw schedule import against fake ships. `~lux`, the bot's owner here,
// has sent no messages. An export shaped like `openclaw cron list --json --all` is imported,
// rerun and dry-run. Its schedules fall in a month away from today, so none fires
// during the run. It cancels the schedules it made and restores the Tlon policy;
// the conversations stay, on a ship the runner resets before each script.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Client, cookie } from './lib/ship-client.mjs'
import { conversationsOf, idOf, nextRun, offsetOf, parseCron, run, timeOf } from '../acp/import-openclaw-schedules.mjs'

const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE, 'Set PEER_URL, PEER_COOKIE and TEST_NEST')
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const owner = row[5].slice('urbauth-'.length)
const script = fileURLToPath(new URL('../acp/import-openclaw-schedules.mjs', import.meta.url))
const execute = promisify(execFile)
const client = new Client()
const marker = `schedules-${Date.now()}`
let adds = 0, policy, directory
// Counts the creates the import sends, repeats included.
const counted = { call: (method, params) => {
  if (method === 'harness/cron/add') adds++
  return client.call(method, params)
} }

const now = new Date()
// A month that is never this one, so no schedule fires during the run.
const month = ((now.getUTCMonth() + 6) % 12) + 1
const once = new Date(now.getTime() + 20 * 86_400_000).toISOString()
let serial = 0
function job({ name, schedule, delivery, payload, ...rest }) {
  return {
    id: `${marker}-${++serial}`, agentId: 'main', name, displayName: `Fixture ${name}`, enabled: true,
    createdAtMs: now.getTime(), updatedAtMs: now.getTime(), configRevision: 'r1', effectiveAgentId: 'main',
    schedule, sessionTarget: 'isolated', wakeMode: 'now',
    payload: { kind: 'agentTurn', message: `Fixture task ${name}: summarize the week's garden chores in three lines.`, ...payload },
    delivery: delivery === null ? undefined : { mode: 'announce', channel: 'tlon', accountId: 'default', ...delivery },
    state: { nextRunAtMs: now.getTime() + 3_600_000 }, status: 'ok', ...rest,
  }
}
const cron = (minute, tz) => ({ kind: 'cron', expr: `${minute} 9 1 ${month} *`, tz })
const jobs = {
  dm: job({ name: 'dm', payload: { message: 'é'.repeat(4096) }, schedule: cron(0, 'America/New_York'), delivery: { to: `tlon:${owner}` } }),
  dmBare: job({ name: 'dm-bare', schedule: cron(5, 'Asia/Kolkata'), delivery: { to: owner } }),
  channel: job({ name: 'channel', schedule: cron(10, 'UTC'), delivery: { to: `tlon:${nest}` } }),
  channelBare: job({ name: 'channel-bare', schedule: cron(15, 'America/Los_Angeles'), delivery: { to: nest } }),
  once: job({ name: 'once', payload: { message: 'x'.repeat(8192) }, schedule: { kind: 'at', at: once }, delivery: { to: `dm/${owner}` } }),
  missing: job({ name: 'missing', schedule: cron(20, 'America/Chicago'), delivery: { to: `tlon:chat/${owner}/no-such-channel` } }),
  tools: job({ name: 'tools', schedule: cron(25, 'America/Chicago'), delivery: { to: `tlon:${nest}` }, payload: { toolsAllow: ['web_search', 'web_fetch'] } }),
  silent: job({ name: 'silent', schedule: cron(30, 'UTC'), delivery: { mode: 'none' } }),
  off: job({ name: 'off', enabled: false, schedule: cron(35, 'UTC'), delivery: { to: owner } }),
  interval: job({ name: 'interval', schedule: { kind: 'every', everyMs: 3_600_000, anchorMs: now.getTime() }, delivery: { to: owner } }),
  event: job({ name: 'event', schedule: cron(40, 'UTC'), payload: { kind: 'systemEvent', message: undefined, text: 'Fixture event text.' }, delivery: null }),
  heartbeat: job({ name: 'heartbeat', schedule: { kind: 'every', everyMs: 1_800_000 }, payload: { kind: 'heartbeat' }, delivery: null, declarationKey: 'heartbeat:main' }),
}
// Imported separately, with --runs.
jobs.limited = job({ name: 'limited', schedule: cron(45, 'UTC'), delivery: { to: owner } })
const limitedExport = { jobs: [jobs.limited], snapshotRevision: 's2', total: 1, offset: 0, limit: 200, hasMore: false, nextOffset: null, deliveryPreviews: {} }
const exported = { jobs: Object.values(jobs).filter((entry) => entry !== jobs.limited), snapshotRevision: 's1', total: 12, offset: 0, limit: 200, hasMore: false, nextOffset: null, deliveryPreviews: {} }
const imported = ['dm', 'dmBare', 'channel', 'channelBare', 'once']
const expected = (name) => ({ dm: `dm/${owner}`, dmBare: `dm/${owner}`, once: `dm/${owner}`, silent: `dm/${owner}` })[name] ?? nest

async function importing(options = {}) {
  adds = 0
  const lines = []
  const code = await run({ client: counted, exported, owner, now, print: (line) => { console.log(line); lines.push(line) }, ...options })
  return { code, output: lines.join('\n') }
}
async function cli(...args) {
  let result
  try {
    result = { code: 0, ...(await execute(process.execPath, [script, '--from', join(directory, 'export.json'), '--owner', owner, ...args], { timeout: 120_000 })) }
  } catch (error) {
    if (typeof error.code !== 'number') throw error
    result = error
  }
  console.log(result.stdout + result.stderr)
  return { code: result.code, output: result.stdout + result.stderr }
}
const schedules = async () => new Map((await client.call('harness/cron')).map((row) => [row.id, row]))
const line = (output, name) => output.split('\n').find((text) => text.startsWith(`- Fixture ${name} |`))
function quiet(output) {
  assert.ok(!output.includes(cookie.split('=')[1]), 'the script never prints the cookie')
  for (const entry of Object.values(jobs)) if (entry.payload.message) assert.ok(!output.includes(entry.payload.message.slice(0, 20)), 'prompts are not printed')
}

await client.start()
try {
  directory = await mkdtemp(join(tmpdir(), 'harness-schedules-'))
  await writeFile(join(directory, 'export.json'), JSON.stringify(exported))
  policy = (await client.call('harness/tlon')).policy
  await client.call('harness/tlon/configure', { enabled: true, owner, response: 'mentions', allowed: [], channels: [], trusted: [] })
  const destinations = [`dm/${owner}`, nest]
  const work = await conversationsOf(client)
  assert.ok(destinations.every((address) => !work.some(({ destination }) => destination === address)))
  const conversations = {}
  async function inspect(address) {
    return client.call('harness/tlon/schedule-destination', { owner, address, open: false })
  }
  await assert.rejects(client.call('harness/tlon/schedule-destination', { owner, address: 'dm/~nec', open: true }), /must go to the owner/)
  await assert.rejects(client.call('harness/tlon/schedule-destination', { owner: '~nec', address: 'dm/~nec', open: true }), /owner changed/)
  for (const address of destinations) {
    const target = await inspect(address)
    assert.equal(target.ready, false, address)
    conversations[address] = target.binding
  }
  const before = await schedules()

  console.log('--- dry run')
  const dry = await cli('--dry-run')
  quiet(dry.output)
  assert.equal(dry.code, 0)
  for (const name of imported) assert.match(line(dry.output, jobs[name].name), /\| would import/, name)
  assert.deepEqual(await schedules(), before, '--dry-run creates nothing')

  for (const address of destinations) assert.equal((await inspect(address)).ready, false)

  console.log('--- first import')
  const first = await importing()
  quiet(first.output)
  assert.equal(first.code, 0)
  assert.equal(adds, imported.length)
  assert.match(line(first.output, 'missing'), /refused: .*no-such-channel/)
  assert.match(line(first.output, 'tools'), /refused: limited to 2 tools; .*--widen-tools/)
  assert.match(line(first.output, 'silent'), /refused: delivery is off \(mode none\); .*--none-to-owner-dm/)
  assert.match(line(first.output, 'off'), /disabled, not imported/)
  assert.match(line(first.output, 'interval'), /refused: Harness has no interval schedules/)
  assert.match(line(first.output, 'event'), /refused: a systemEvent task, not an agent turn/)
  assert.equal(line(first.output, 'heartbeat'), undefined, 'built-in jobs are left out')
  assert.match(first.output, /^imported 5, refused 5, disabled 1, of 11 tasks\.$/m)
  const held = await schedules()
  assert.equal(held.size, before.size + imported.length)
  for (const name of ['missing', 'tools', 'silent', 'off', 'interval', 'event']) assert.ok(!held.has(idOf(jobs[name])), name)
  for (const name of imported) {
    const { schedule, payload } = jobs[name], made = held.get(idOf(jobs[name]))
    assert.ok(made, name)
    const timezone = schedule.kind === 'cron' ? offsetOf(schedule.tz, now) : 'UTC'
    assert.deepEqual(
      { schedule: made.schedule, timezone: made.timezone, destination: made.destination, remaining: made.remaining, actor: made.actor, binding: made.sourceBinding, prompt: made.prompt, state: made.state, kind: made.kind },
      { schedule: schedule.kind === 'cron' ? schedule.expr : once, timezone, destination: expected(name), remaining: schedule.kind === 'cron' ? null : 1,
        actor: owner, binding: conversations[expected(name)], prompt: payload.message, state: 'active', kind: 'prompt' }, name)
    // The import's copy of the head's calendar dates the first run as the head does.
    const first = schedule.kind === 'cron' ? nextRun(parseCron(schedule.expr), timezone, now.getTime()) : Date.parse(once)
    assert.equal(timeOf(made.next), first, `${name} next run`)
  }
  assert.ok(['-05:00', '-04:00'].includes(held.get(idOf(jobs.dm)).timezone))
  assert.equal(held.get(idOf(jobs.dmBare)).timezone, '+05:30')
  assert.equal(held.get(idOf(jobs.channel)).timezone, 'UTC')
  // Worked out by hand: 09:05 at +05:30 on the 1st is 03:35 UTC that day, in
  // the first year whose `month` is still ahead.
  const year = now.getUTCFullYear() + (month < now.getUTCMonth() + 1 ? 1 : 0)
  assert.equal(timeOf(held.get(idOf(jobs.dmBare)).next), Date.UTC(year, month - 1, 1, 3, 35))
  assert.equal(timeOf(held.get(idOf(jobs.channel)).next), Date.UTC(year, month - 1, 1, 9, 10))

  console.log('--- second run of the same file')
  const second = await importing()
  assert.equal(second.code, 0)
  assert.equal(adds, imported.length, 'the repeats go to the head, which checks them')
  for (const name of imported) assert.match(line(second.output, jobs[name].name), /\| already there, next run /, name)
  assert.match(second.output, /^already there 5, refused 5, disabled 1, of 11 tasks\.$/m)
  assert.deepEqual(await schedules(), held, 'a second run creates nothing')
  const repeat = await cli('--dry-run')
  assert.equal(repeat.code, 0)
  for (const name of imported) assert.match(line(repeat.output, jobs[name].name), /\| already there/, name)

  console.log('--- with --widen-tools and --none-to-owner-dm')
  const widened = await cli('--widen-tools', '--none-to-owner-dm')
  quiet(widened.output)
  assert.equal(widened.code, 0)
  assert.match(line(widened.output, 'tools'), /\| imported, next run .*WARNING: was limited to 2 tools/)
  assert.match(line(widened.output, 'silent'), /\| imported, next run .*posts to the owner's DM/)
  assert.match(widened.output, /^imported 2, already there 5, refused 3, disabled 1, of 11 tasks\.$/m)
  const after = await schedules()
  assert.equal(after.size, held.size + 2)
  for (const name of ['tools', 'silent']) {
    const made = after.get(idOf(jobs[name]))
    assert.equal(made.destination, expected(name), name)
    assert.equal(made.sourceBinding, conversations[expected(name)], name)
    assert.equal(made.remaining, null, name)
  }

  console.log('--- after the owner edits an imported schedule')
  const original = after.get(idOf(jobs.dm))
  const changed = await client.call('harness/cron/edit', { id: original.id, revision: original.revision, args: { schedule: `0 17 1 ${month} *`, timezone: original.timezone, prompt: original.prompt } })
  assert.equal(changed.schedule, `0 17 1 ${month} *`)
  const edited = await schedules()
  const rerun = await importing()
  assert.equal(rerun.code, 1, 'a schedule that differs from its task fails the run')
  assert.match(line(rerun.output, 'dm'), /\| exists but differs \(edited since import\?\); left as it is/)
  assert.match(line(rerun.output, 'channel'), /\| already there/)
  assert.match(rerun.output, /^already there 4, exists but differs 1, refused 5, disabled 1, of 11 tasks\.$/m)
  assert.deepEqual(await schedules(), edited, 'the edited schedule is left as it is')
  assert.equal(edited.get(original.id).schedule, `0 17 1 ${month} *`)

  console.log('--- with --runs 100, on tasks not imported before')
  const limited = await importing({ exported: limitedExport, runs: 100 })
  assert.equal(limited.code, 0)
  assert.match(line(limited.output, 'limited'), /\| imported, next run .*ends after 100 runs, on /)
  const counted = (await schedules()).get(idOf(jobs.limited))
  assert.equal(counted.remaining, 100)
  assert.deepEqual([counted.schedule, counted.timezone, counted.destination], [jobs.limited.schedule.expr, 'UTC', `dm/${owner}`])
  const unlimited = await importing({ exported: limitedExport })
  assert.equal(unlimited.code, 0, 'a task imported earlier with a count is not a failure')
  assert.match(line(unlimited.output, 'limited'), /\| exists with a run limit \(imported earlier\); left as it is \| .*last of its 100 runs on /)
  assert.equal((await schedules()).get(idOf(jobs.limited)).remaining, 100)

  console.log('--- after the owner removes that count')
  const capped = (await schedules()).get(idOf(jobs.limited))
  const freed = await client.call('harness/cron/edit', { id: capped.id, revision: capped.revision, args: { schedule: capped.schedule, timezone: capped.timezone, prompt: capped.prompt } })
  assert.equal(freed.remaining, null)
  const recount = await importing({ exported: limitedExport, runs: 100 })
  assert.equal(recount.code, 1, 'a count removed in Harness differs from the task')
  assert.match(line(recount.output, 'limited'), /\| exists but differs \(edited since import\?\); left as it is/)
  assert.equal((await schedules()).get(idOf(jobs.limited)).remaining, null, 'the edit is left as it is')
  console.log('import-openclaw-schedules conformance passed')
} finally {
  for (const entry of Object.values(jobs)) {
    if ((await schedules()).has(idOf(entry))) await client.call('harness/cron/cancel', { id: idOf(entry) })
  }
  if (policy) await client.call('harness/tlon/configure', policy)
  if (directory) await rm(directory, { recursive: true })
  await client.close()
}
