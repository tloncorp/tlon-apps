// One-time import of an OpenClaw bot's scheduled tasks into Harness schedules.
// It reads the file `openclaw cron list --json --all` prints, which the
// operator saves while OpenClaw still runs; it never contacts OpenClaw. Each
// task becomes a schedule of the Tlon conversation it delivered to,
// made as the owner, or is refused with the reason.
//
//   cd packages/harness
//   SHIP_URL=https://moon.example SHIP_COOKIE=/path/to/cookie.txt \
//     node acp/import-openclaw-schedules.mjs --from export.json --owner '~sampel-palnet' [--dry-run]
//
// A recurring task runs until it is cancelled, as it did in OpenClaw;
// --runs N limits each one to N runs.
import { setTimeout as sleep } from 'node:timers/promises'
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { canonicalShip } from './people.mjs'

// The head's largest run count.
export const maxRuns = 1_000_000
export const capacity = 64
const maxPromptBytes = 8192
const day = 86_400_000
const horizon = 3653 * day
const soon = 30 * day
const century = 36525 * day
// The @da of the Unix epoch.
const epoch = 170141184475152167957503069145530368000n
const flags = { '--dry-run': 'dryRun', '--widen-tools': 'widenTools', '--none-to-owner-dm': 'noneToOwnerDm', '--threads-to-parent': 'threadsToParent' }
const usage = `Usage: SHIP_URL=https://moon.example SHIP_COOKIE=/path/to/cookie.txt node acp/import-openclaw-schedules.mjs --from export.json --owner '~sampel-palnet' [${Object.keys(flags).join('] [')}] [--runs N]\n`
// What a head from before optional run counts answers a recurring create
// without one: its general validation refusal.
const countRequired = 'Require an authorized actor and prompt 1..4096 bytes with either a future RFC3339 at timestamp (explicit offset or Z) or a five-field schedule with timezone UTC or a fixed +HH:MM/-HH:MM offset and runs 1..100. Literal reminders require at and text, and a destination only if it names this conversation.'

const bytes = (text) => Buffer.byteLength(text, 'utf8')
const minute = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'

// OpenClaw's own maintenance jobs, which Harness does itself or not at all.
// `heartbeat-task:` jobs are the owner's and are kept.
const builtIn = (key = '') =>
  key.startsWith('heartbeat:') || key.startsWith('skill-collection-review:') || key === 'memory-core:memory-dreaming-promotion'

export function tasksOf(exported) {
  if (!Array.isArray(exported?.jobs)) throw new Error('The file is not what `openclaw cron list --json --all` prints: it has no jobs list.')
  return exported.jobs.filter((job) => !builtIn(job.declarationKey))
}

export const labelOf = (job) => job.displayName ?? job.name

export const uv = (value) => `0v${value.toString(32).replace(/\B(?=(.{5})+$)/g, '.')}`

// The same OpenClaw job gives the same id on every run, so a rerun repeats a
// create the head answers with the existing schedule.
export function idOf(job) {
  return uv(BigInt(`0x${createHash('sha256').update(`openclaw-cron:${job.id}`).digest('hex').slice(0, 32)}`))
}

// The zone's offset at that instant, as Harness spells a fixed offset; null
// when it is not whole minutes.
export function offsetOf(zone, at) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
    .formatToParts(at).find(({ type }) => type === 'timeZoneName').value
  const match = name.match(/^GMT(?:([+-])(\d{2}):(\d{2}))?$/)
  if (!match || Number(match[2]) > 14 || (match[2] === '14' && match[3] !== '00')) return null
  // A zone at UTC+0 is sent as UTC, never as -00:00.
  return !match[1] || match[2] + match[3] === '0000' ? 'UTC' : `${match[1]}${match[2]}:${match[3]}`
}

const offsetMinutes = (offset) =>
  offset === 'UTC' ? 0 : (offset[0] === '-' ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4)))

// The grammar of desk/lib/harness-cron.hoon, which decides what runs; this
// copy only dates the runs, and throws where the head would refuse.
function number(text) {
  if (!/^\d{1,3}$/.test(text)) throw new Error('not a number')
  return Number(text)
}
function field(text, lower, upper) {
  const entries = text.split(',')
  if (entries.length > 60) throw new Error('too many entries')
  const values = new Set()
  for (const entry of entries) {
    const steps = entry.split('/')
    if (steps.length > 2) throw new Error('two steps')
    const step = steps.length === 2 ? number(steps[1]) : 1
    if (step < 1 || step > upper - lower + 1) throw new Error('step out of range')
    let first = lower, last = upper
    if (steps[0] !== '*') {
      const parts = steps[0].split('-')
      if (parts.length > 2) throw new Error('two ranges')
      first = number(parts[0])
      last = parts.length === 2 ? number(parts[1]) : steps.length === 2 ? upper : first
    }
    if (first < lower || last > upper || first > last) throw new Error('out of range')
    for (let at = first; at <= last; at += step) values.add(at)
  }
  return values
}
export function parseCron(expression) {
  if (bytes(expression) > 128) throw new Error('over 128 bytes')
  const fields = expression.split(' ').filter(Boolean)
  if (fields.length !== 5) throw new Error('not five fields')
  const [minutes, hours, days, months, weekdays] = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]].map(([lower, upper], index) => field(fields[index], lower, upper))
  const slots = []
  for (let at = 0; at < 1440; at++) if (hours.has(Math.floor(at / 60)) && minutes.has(at % 60)) slots.push(at)
  return { slots, days, months, weekdays, anyDay: fields[2] === '*', anyWeekday: fields[4] === '*' }
}
function dayMatches(pattern, date) {
  if (!pattern.months.has(date.getUTCMonth() + 1)) return false
  const monthDay = pattern.days.has(date.getUTCDate()), weekDay = pattern.weekdays.has(date.getUTCDay())
  // Restricted day-of-month and day-of-week are ORed, as in traditional cron.
  if (pattern.anyDay) return weekDay
  if (pattern.anyWeekday) return monthDay
  return monthDay || weekDay
}
// The first run after `after` (ms), on the calendar at that offset, searched
// over four years as the head does; null if there is none.
export function nextRun(pattern, offset, after) {
  const shift = offsetMinutes(offset) * 60_000, local = after + shift
  let start = local - (local % day)
  for (let searched = 0; searched < 1461; searched++, start += day) {
    if (!dayMatches(pattern, new Date(start))) continue
    for (const slot of pattern.slots) if (start + slot * 60_000 > local) return start + slot * 60_000 - shift
  }
  return null
}
// When a schedule of `limit` runs stops: the time of its last run, or of the
// last the search finds if it ends first. A count can reach a million, so the
// walk stops a century on, and `beyond` says the schedule outlasts it.
export function lastRun(pattern, offset, now, limit, first) {
  let at = first ?? now.getTime(), count = first === undefined ? 0 : 1
  for (; count < limit; count++) {
    if (at - now.getTime() > century) return { count, at, beyond: true }
    const next = nextRun(pattern, offset, at)
    if (next === null) break
    at = next
  }
  return { count, at }
}

// The note saying when a schedule stops, from its last run and how many runs
// it has, or would have, left.
function stopText({ count, at, beyond }, now, fresh) {
  if (!count) return 'never runs within four years, so Harness will refuse it'
  if (beyond) return 'runs for more than a hundred years'
  const warning = at - now.getTime() <= soon ? 'ENDS WITHIN 30 DAYS: tell its owner. ' : ''
  return `${warning}${fresh ? 'ends after' : 'last of its'} ${count} runs${fresh ? ',' : ''} on ${minute(at)}`
}

// When a schedule Harness already holds stops: its next run and the runs it
// has left, as the returned row says. remaining is null for a schedule with no
// count, which runs until it is cancelled.
export function stopOf(row, now) {
  if (row.remaining === null) return row.state === 'active' ? 'runs until cancelled' : row.state
  if (row.state !== 'active') return `${row.state}, with ${row.remaining} runs left`
  const first = timeOf(row.next)
  let pattern
  try {
    pattern = parseCron(row.schedule)
  } catch {
    // A one-time schedule's row holds its time, and it runs once.
    return Number.isNaN(Date.parse(row.schedule)) ? 'last run unknown' : stopText({ count: 1, at: first }, now, false)
  }
  return stopText(lastRun(pattern, row.timezone, now, row.remaining, first), now, false)
}

// A delivery target, by the rules of the OpenClaw Tlon plugin's targets.ts.
function nestOf(text) {
  const match = text.match(/^([^/]+)\/([^/]+)\/([^/]+)$/)
  const kind = match?.[1].toLowerCase(), host = match && canonicalShip(match[2])
  if (!host || !['chat', 'heap', 'diary', 'notes'].includes(kind)) return null
  return { kind: kind === 'notes' ? 'notebook' : 'channel', nest: `${kind}/${host}/${match[3]}` }
}
export function targetOf(raw) {
  const text = String(raw ?? '').trim().replace(/^tlon:/i, '')
  const dm = text.match(/^dm[/:](.+)$/i)
  if (dm) return { kind: 'dm', ship: canonicalShip(dm[1]) }
  const group = text.match(/^(group|room)[/:](.+)$/i)
  if (group) {
    const rest = group[2].trim(), nest = nestOf(rest), parts = rest.split('/')
    if (nest) return nest
    // The legacy group:~host/channel names a chat.
    const host = parts.length === 2 && canonicalShip(parts[0])
    return host ? { kind: 'channel', nest: `chat/${host}/${parts[1]}` } : null
  }
  const nest = nestOf(text)
  if (nest) return nest
  return /^~?[a-z-]+$/i.test(text) ? { kind: 'dm', ship: canonicalShip(text) } : null
}

// A thread's parent, as the export's threadId (`~author/170.141…` or a bare
// number) or as the @da that ends a Harness thread address names it.
export function parentOf(threadId) {
  const text = String(threadId).trim()
  const match = text.match(/^(?:(~[a-z-]+)\/)?(\d[\d.]*)$/)
  if (!match) return null
  return { author: match[1] ? canonicalShip(match[1]) : null, id: BigInt(match[2].replaceAll('.', '')) }
}
export function daValue(text) {
  const match = text.match(/^~(\d+)\.(\d+)\.(\d+)(?:\.\.(\d+)\.(\d+)\.(\d+)(?:\.\.([0-9a-f]{4}(?:\.[0-9a-f]{4})*))?)?$/)
  if (!match) return null
  const [, year, month, date, hour = 0, minutes = 0, seconds = 0, fraction = ''] = match
  const unix = BigInt(Date.UTC(Number(year), Number(month) - 1, Number(date), Number(hour), Number(minutes), Number(seconds)) / 1000)
  const chunks = fraction ? fraction.split('.') : []
  return epoch + (unix << 64n) + chunks.reduce((sum, chunk, index) => sum + (BigInt(`0x${chunk}`) << BigInt(48 - 16 * index)), 0n)
}
export const timeOf = (da) => {
  const value = daValue(da) - epoch
  // Rounded, since the head floors a millisecond's fraction of a second.
  return Number(value >> 64n) * 1000 + Number(((value & ((1n << 64n) - 1n)) * 1000n + (1n << 63n)) >> 64n)
}
// A Harness Tlon address split into its conversation and thread parent.
export function addressOf(address) {
  const dm = address.match(/^(dm\/~[a-z-]+)(?:\/(~[a-z-]+)\/(~[^/]+))?$/)
  if (dm) return { conversation: dm[1], parent: dm[2] ? { author: dm[2], id: daValue(dm[3]) } : null }
  const channel = address.match(/^([a-z]+\/~[a-z-]+\/[^/]+)(?:\/(~[^/]+))?$/)
  if (channel) return { conversation: channel[1], parent: channel[2] ? { author: null, id: daValue(channel[2]) } : null }
  return null
}

// What OpenClaw did that a Harness schedule does not, reported without
// refusing.
function notesOf(job) {
  const notes = [], { payload = {}, schedule = {}, delivery = {} } = job
  if (job.pacing !== undefined) notes.push('pacing is not carried')
  if (schedule.staggerMs) notes.push(`a stagger of ${schedule.staggerMs} ms is not carried`)
  if (payload.model) notes.push(`model ${payload.model} is not carried; the conversation's model runs it`)
  if (job.failureAlert && typeof job.failureAlert === 'object') notes.push('failure alert is not carried')
  if (delivery.failureDestination) notes.push('failure destination is not carried')
  if (job.sessionTarget && job.sessionTarget !== 'isolated') notes.push(`ran in ${job.sessionTarget.startsWith('session:') ? 'a named session' : `the ${job.sessionTarget} session`}; a Harness run gets no transcript`)
  if (job.deleteAfterRun) notes.push('deleted after its run in OpenClaw; Harness keeps the finished record until cleared')
  if (job.wakeMode && job.wakeMode !== 'now') notes.push(`wake mode ${job.wakeMode}; Harness runs it at the time`)
  if (delivery.accountId && delivery.accountId !== 'default') notes.push(`sent from account ${delivery.accountId}; Harness sends as this ship`)
  return notes
}

function destinationOf(job, owner, options) {
  const delivery = job.delivery
  const unrecorded = !delivery || (delivery.mode === 'announce' && !delivery.to)
  if (unrecorded || delivery.mode === 'none') {
    const why = unrecorded ? 'no destination in the export (OpenClaw chose its last conversation)' : 'delivery is off (mode none)'
    if (!options.noneToOwnerDm) return { refuse: `${why}; every Harness schedule posts its result, and --none-to-owner-dm sends it to the owner's DM` }
    return { address: `dm/${owner}`, parent: null, notes: [`${why}; posts to the owner's DM`] }
  }
  if (delivery.mode !== 'announce') return { refuse: `delivery mode ${delivery.mode} has no Harness equivalent` }
  if (delivery.channel !== undefined && delivery.channel !== 'tlon') return { refuse: `delivers through ${delivery.channel}, not Tlon` }
  const target = targetOf(delivery.to)
  if (!target || (target.kind === 'dm' && !target.ship)) return { refuse: `unrecognized destination ${delivery.to}` }
  if (target.kind === 'notebook') return { refuse: `${target.nest} is a notebook; Harness has no conversation there` }
  if (target.kind === 'dm' && target.ship !== owner) return { refuse: `a DM with ${target.ship}, not the owner` }
  const address = target.kind === 'dm' ? `dm/${target.ship}` : target.nest
  if (delivery.threadId === undefined || delivery.threadId === null || delivery.threadId === '') return { address, parent: null, notes: [] }
  const parent = parentOf(delivery.threadId)
  if (!parent) return { refuse: `unreadable thread id ${delivery.threadId}` }
  // A DM reply with no author names the partner's message, as the plugin sends it.
  if (target.kind === 'dm' && !parent.author) parent.author = target.ship
  return { address, parent, notes: [] }
}

// Plans one task without the ship: { import: {id, destination, kind, args},
// notes, stop }, or { refuse, notes, stop }, or { disabled: true, notes }.
// stop says when a new schedule would stop. runs, when given, limits a
// recurring schedule to that many runs; without it the schedule has no count.
export function plan(job, { owner, now, widenTools = false, noneToOwnerDm = false, runs }) {
  const notes = notesOf(job)
  let stop
  const refuse = (reason) => ({ refuse: reason, notes, stop })
  if (!job.enabled) return { disabled: true, notes }
  const { payload = {}, schedule = {} } = job
  if (payload.kind !== 'agentTurn') return refuse(`a ${payload.kind} task, not an agent turn`)
  // OpenClaw wraps such a prompt as untrusted outside content; Harness would
  // run it as the owner's own instruction.
  if (/^session:hook:/i.test(job.sessionTarget ?? '')) return refuse('runs in a hook session, whose prompt OpenClaw treats as untrusted outside content')
  if (payload.externalContentSource) return refuse(`its prompt is outside content from ${payload.externalContentSource}, which OpenClaw treats as untrusted`)
  if (payload.allowUnsafeExternalContent === true) return refuse('allows unsafe outside content, which Harness cannot tell from the owner\'s instructions')
  if (job.trigger) return refuse('runs only when its trigger script says so; Harness would run it every time')
  if (schedule.kind === 'every') return refuse('Harness has no interval schedules')
  if (schedule.kind !== 'cron' && schedule.kind !== 'at') return refuse(`Harness has no ${schedule.kind} schedules`)
  const prompt = payload.message
  if (typeof prompt !== 'string' || !prompt.trim()) return refuse('empty prompt')
  if (bytes(prompt) > maxPromptBytes) return refuse(`prompt of ${bytes(prompt)} bytes; Harness takes at most ${maxPromptBytes}`)
  let args
  if (schedule.kind === 'cron') {
    if (!schedule.tz) return refuse('no timezone in the export; recreate it by hand')
    let timezone
    try {
      timezone = offsetOf(schedule.tz, now)
    } catch {
      return refuse(`unknown timezone ${schedule.tz}`)
    }
    if (!timezone) return refuse(`${schedule.tz} has no whole-minute offset`)
    args = { schedule: schedule.expr, timezone, prompt, ...(runs ? { runs: String(runs) } : {}) }
    if (timezone !== 'UTC' || schedule.tz !== 'UTC') {
      const shifts = offsetOf(schedule.tz, new Date(now.getTime() + 182 * day)) !== timezone
      notes.push(`${schedule.tz} sent as the fixed offset ${timezone}${shifts ? ', which does not follow daylight saving' : ''}`)
    }
    let pattern
    try {
      pattern = parseCron(schedule.expr)
    } catch {
      stop = 'the expression is outside Harness\'s cron grammar, so Harness will likely refuse it'
    }
    if (pattern) {
      const last = lastRun(pattern, timezone, now, runs ?? 1)
      stop = !last.count || runs ? stopText(last, now, true) : 'runs until cancelled'
    }
  } else {
    const at = Date.parse(schedule.at)
    if (Number.isNaN(at)) return refuse(`unreadable time ${schedule.at}`)
    if (at <= now.getTime()) return refuse(`its time, ${minute(at)}, has passed`)
    if (at > now.getTime() + horizon) return refuse('more than ten years away')
    args = { at: new Date(at).toISOString(), prompt }
  }
  // No list, or every tool, is what a Harness schedule has. OpenClaw's default
  // list is the agent's tools; any other list, an empty one included, held
  // the task to less than its conversation may give it.
  const tools = payload.toolsAllow
  if (tools == null || (tools.length === 1 && tools[0] === '*')) {
    // Imported as it is.
  } else if (payload.toolsAllowIsDefault === true && tools.length) {
    notes.push(`had OpenClaw's default list of ${tools.length} tools`)
  } else if (!widenTools) {
    return refuse(`limited to ${tools.length} tools; a Harness schedule runs with its conversation's tools, which can be more, and --widen-tools imports it`)
  } else notes.push(`WARNING: was limited to ${tools.length} tools and now runs with its conversation's tools`)
  const destination = destinationOf(job, owner, { noneToOwnerDm })
  if (destination.refuse) return refuse(destination.refuse)
  notes.push(...destination.notes)
  return { import: { id: idOf(job), destination: { address: destination.address, parent: destination.parent }, kind: 'prompt', args }, notes, stop }
}

const sameParent = (a, b) => a.id === b.id && (!a.author || !b.author || a.author === b.author)

// Match the exact thread first. A top-level address without a recorded
// input is resolved by the Tlon hand under the current delivery policy.
export function resolve(destination, conversations, { threadsToParent = false } = {}) {
  const find = (parent) => conversations.find(({ destination: address }) => {
    const parsed = addressOf(address)
    if (parsed?.conversation !== destination.address) return false
    return parent ? !!parsed.parent && sameParent(parent, parsed.parent) : !parsed.parent
  })
  if (destination.parent) {
    const thread = find(destination.parent)
    if (thread) return { binding: thread.binding, address: thread.destination, notes: [] }
    if (!threadsToParent) return { refuse: 'no conversation in that thread yet; --threads-to-parent posts to its DM or channel instead' }
  }
  const found = find(null)
  const notes = destination.parent ? ['posts to the conversation, not the thread'] : []
  return found ? { binding: found.binding, address: found.destination, notes } : { address: destination.address, notes }
}

// Opening a lane and binding it to the head completes asynchronously. Poll
// read-only after the first request so a slow setup is never restarted.
async function openDestination(client, owner, address, expected) {
  const params = { owner, address }
  const deadline = Date.now() + 30_000
  let result = await client.call('harness/tlon/schedule-destination', { ...params, open: true })
  for (;;) {
    if (result.refuse) throw new Error(result.refuse)
    if (result.binding !== expected) throw new Error('Destination changed during import; rerun the preview')
    if (result.ready) return
    if (Date.now() >= deadline) throw new Error('Timed out waiting for the conversation binding')
    await sleep(250)
    result = await client.call('harness/tlon/schedule-destination', { ...params, open: false })
  }
}

// The Tlon conversations that can take a schedule now, one per binding.
export async function conversationsOf(client) {
  const found = new Map()
  let before = ''
  do {
    const page = await client.call('harness/tlon/work', { before })
    if (!page.headConnected) throw new Error('The Tlon adapter is not connected to the Harness head, so its conversations cannot be read; nothing was imported.')
    for (const record of page.records) {
      if (record.kind === 'input' && record.current && !found.has(record.binding)) found.set(record.binding, { binding: record.binding, destination: record.destination })
    }
    before = page.next
  } while (before !== null)
  return [...found.values()]
}

const scheduleText = ({ schedule = {} }) =>
  schedule.kind === 'cron' ? `cron "${schedule.expr}" ${schedule.tz ?? '(no zone)'}` : schedule.kind === 'at' ? `at ${schedule.at}` : schedule.kind === 'every' ? `every ${schedule.everyMs} ms` : String(schedule.kind)

// Does the schedule Harness holds do what this import asks? An edit in
// Harness keeps the id, so a repeated create returns the edited row. Under a
// count, a row with no count or more runs left than it was given differs; fewer
// left are runs used up.
export const matches = (row, { binding, address, kind, args }, owner) =>
  row.sourceBinding === binding && row.destination === address && row.kind === kind && row.actor === owner && row.prompt === args.prompt &&
  (args.at ? row.schedule === args.at : row.schedule === args.schedule && row.timezone === args.timezone) &&
  (args.runs === undefined || (row.remaining !== null && row.remaining <= Number(args.runs)))

// Returns the exit code: 1 when a create failed, a schedule differs from its
// task or the ship is not set up for the owner, 0 otherwise, refusals included. client needs call(method, params).
export async function run({ client, exported, owner, now = new Date(), dryRun = false, widenTools = false, noneToOwnerDm = false, threadsToParent = false, runs, print = console.log }) {
  const jobs = exported?.jobs ?? [], tasks = tasksOf(exported)
  const { policy } = await client.call('harness/tlon')
  if (!policy.enabled || policy.owner !== owner) {
    print(`Refused: the Tlon hand is ${policy.enabled ? `owned by ${policy.owner ?? 'nobody'}` : 'disabled'}, and every schedule is made as ${owner}, its owner. Nothing was imported.`)
    return 1
  }
  const conversations = await conversationsOf(client)
  const existing = new Map((await client.call('harness/cron')).map((row) => [row.id, row]))
  const status = new Map()
  const rows = []
  for (const job of tasks) {
    const row = { job, label: labelOf(job), ...plan(job, { owner, now, widenTools, noneToOwnerDm, runs }) }
    rows.push(row)
    if (!row.import) continue
    const found = resolve(row.import.destination, conversations, { threadsToParent })
    if (found.refuse) { row.refuse = found.refuse; continue }
    row.notes.push(...found.notes)
    Object.assign(row.import, found)
    if (!found.binding) {
      const target = await client.call('harness/tlon/schedule-destination', { owner, address: found.address, open: false })
      if (target.refuse) row.refuse = target.refuse
      else {
        row.import.binding = target.binding
        row.import.needsOpen = !target.ready
        if (!target.ready) row.notes.push('opens the conversation for delivery')
      }
      continue
    }
    if (!status.has(found.binding)) status.set(found.binding, await client.call('harness/hand', { status: { binding: found.binding } }))
    const hand = status.get(found.binding)
    if (!hand?.enabled || hand.hand !== 'tlon') row.refuse = `the conversation in ${found.address} is not enabled`
  }
  print(`${tasks.length} tasks from the export, ${jobs.length - tasks.length} built-in OpenClaw jobs left out, ${conversations.length} Tlon conversations with recorded input${dryRun ? ' (dry run, nothing will be created)' : ''}`)
  const totals = Object.fromEntries(['imported', 'would import', 'already there', 'exists with a run limit', 'exists but differs', 'refused', 'disabled', 'failed'].map((kind) => [kind, 0]))
  // Capacity counts every kept record and each create that succeeds; a repeat
  // of an id Harness holds needs no room.
  let room = capacity - existing.size
  for (const row of rows) {
    // kind is the outcome's total; detail follows it on the line.
    let kind, detail = '', stop = row.stop
    const prior = row.import && existing.get(row.import.id)
    if (!row.refuse && row.import && !prior && room <= 0) row.refuse = `would pass Harness's limit of ${capacity} schedules`
    const planned = row.import && !row.refuse
    // A create without a count over a schedule an earlier import made with
    // one would be refused as a different request, so none is sent; the
    // schedule is the same task unless it was edited since.
    const limited = planned && prior && !runs && row.import.args.schedule && prior.remaining !== null
    if (row.disabled) [kind, detail] = ['disabled', ', not imported']
    else if (row.refuse) [kind, detail] = ['refused', `: ${row.refuse}`]
    else if (limited) {
      const same = matches(prior, row.import, owner)
      ;[kind, detail, stop] = [same ? 'exists with a run limit' : 'exists but differs', same ? ' (imported earlier); left as it is' : '', stopOf(prior, now)]
    }
    else if (dryRun) {
      if (!prior) [kind, room] = ['would import', room - 1]
      else [kind, detail, stop] = [matches(prior, row.import, owner) ? 'already there' : 'exists but differs', '', stopOf(prior, now)]
    } else {
      try {
        if (row.import.needsOpen) await openDestination(client, owner, row.import.address, row.import.binding)
        const made = await client.call('harness/cron/add', { id: row.import.id, binding: row.import.binding, actor: owner, kind: row.import.kind, args: row.import.args })
        detail = `, next run ${minute(timeOf(made.next))}`
        if (!prior) [kind, room] = ['imported', room - 1]
        else [kind, stop] = [matches(made, row.import, owner) ? 'already there' : 'exists but differs', stopOf(made, now)]
      } catch (error) {
        const hint = !runs && row.import.args.schedule && error.message === countRequired ? '; if this desk predates optional run counts, rerun with --runs 100' : ''
        ;[kind, detail] = ['failed', `: ${error.message}${hint}`]
      }
    }
    if (kind === 'exists but differs') detail = ` (edited since import?); left as it is${detail}`
    totals[kind]++
    const notes = [...(row.notes ?? []), ...(planned && stop ? [stop] : !planned && row.stop ? [row.stop] : [])]
    const where = planned ? row.import.address : row.job.delivery?.to ?? (row.job.delivery?.mode ? `(${row.job.delivery.mode})` : '(no delivery)')
    print(`- ${row.label} | ${scheduleText(row.job)} | ${where} | ${kind}${detail}${notes.length ? ` | ${notes.join('; ')}` : ''}`)
  }
  print(`${dryRun ? 'Dry run: ' : ''}${Object.entries(totals).filter(([, count]) => count).map(([kind, count]) => `${kind} ${count}`).join(', ') || 'nothing'}, of ${tasks.length} tasks.`)
  return totals.failed || totals['exists but differs'] ? 1 : 0
}

// The export, or an error that names at most a position: the parser's own
// message quotes the text around it, which can be a prompt.
export function parseExport(text) {
  try {
    return JSON.parse(text)
  } catch (error) {
    const position = String(error.message).match(/position (\d+)/)
    throw new Error(`The export is not valid JSON${position ? ` (at position ${position[1]})` : ''}; nothing was imported.`)
  }
}

// The command's options, with the owner canonical, or null when they are wrong.
export function options(args) {
  const parsed = {}
  for (let index = 0; index < args.length; index++) {
    const arg = args[index]
    if (flags[arg]) parsed[flags[arg]] = true
    else if ((arg === '--from' || arg === '--owner' || arg === '--runs') && index + 1 < args.length) parsed[arg.slice(2)] = args[++index]
    else return null
  }
  if (parsed.runs !== undefined) {
    if (!/^\d+$/.test(parsed.runs) || Number(parsed.runs) < 1 || Number(parsed.runs) > maxRuns) return null
    parsed.runs = Number(parsed.runs)
  }
  const owner = parsed.owner && canonicalShip(parsed.owner)
  return parsed.from && owner ? { ...parsed, owner } : null
}

async function main() {
  const parsed = options(process.argv.slice(2))
  if (!parsed) {
    process.stderr.write(usage)
    process.exitCode = 1
    return
  }
  const exported = parseExport(readFileSync(parsed.from, 'utf8'))
  // The client reads SHIP_COOKIE as it loads, so it is loaded only here.
  const { Client } = await import('../tests-js/lib/ship-client.mjs')
  const client = new Client()
  await client.start()
  try {
    process.exitCode = await run({ client, exported, ...parsed })
  } finally {
    await client.close()
  }
}

// Real paths, so that running the script through a symlink still runs it.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
