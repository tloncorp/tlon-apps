// One-time import of an OpenClaw bot's MEMORY.md, as Steward holds it, into
// Harness memory. It imports one snapshot of the file; it is not a sync, and it
// never changes or forgets a memory that already exists.
//
//   SHIP_URL=https://moon.example SHIP_COOKIE=/path/to/cookie.txt \
//     node acp/import-openclaw-memory.mjs [--dry-run]
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const maxFactBytes = 1024
export const maxPathBytes = 120
const opening = '<!-- idempotency-marker:'
const closing = '<!-- /idempotency-marker -->'
const forgottenRefusal = 'Memory changed; read its current revision before saving.'
const importedName = /^imported-([0-9a-f]{8})-\d{3,}$/
const usage = 'Usage: SHIP_URL=https://moon.example SHIP_COOKIE=/path/to/cookie.txt node acp/import-openclaw-memory.mjs [--dry-run]\n'

const bytes = (text) => Buffer.byteLength(text, 'utf8')

// The longest prefix within max bytes that ends on a whole character.
function prefix(text, max) {
  let size = 0, end = 0
  for (const character of text) {
    size += bytes(character)
    if (size > max) break
    end += character.length
  }
  return text.slice(0, end)
}

// Removes tlonbot's managed blocks. The bot is told to keep learned entries
// outside them, so what is inside is seeded runtime text, not memory. Text
// beside a marker on its line is outside the block, so it is kept, and a line
// can hold several blocks.
export function clean(text) {
  const kept = []
  const keep = (part) => { if (part.trim()) kept.push(part) }
  let open = false
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (!open && !line.includes(opening)) {
      kept.push(line)
      continue
    }
    let rest = line
    for (;;) {
      if (!open) {
        const start = rest.indexOf(opening)
        if (start < 0) break
        keep(rest.slice(0, start))
        rest = rest.slice(start)
        open = true
      }
      const end = rest.indexOf(closing)
      if (end < 0) break
      open = false
      rest = rest.slice(end + closing.length)
    }
    if (!open) keep(rest)
  }
  if (open) throw new Error('MEMORY.md has a managed block with no closing marker; nothing was imported.')
  return kept.join('\n')
}

export function snapshotId(cleaned) {
  return createHash('sha256').update(cleaned).digest('hex').slice(0, 8)
}

// An oversize unit is cut after the last whitespace that fits, which stays at
// the end of the first piece, or else after the last whole character that
// fits, so the pieces concatenate back to the unit.
function split(text, room) {
  const head = prefix(text, room)
  const space = Math.max(-1, ...[...head.matchAll(/\s/g)].map((match) => match.index).filter((index) => index > 0))
  return space < 0 ? head : head.slice(0, space + 1)
}

// A long path loses its outermost titles first, because the deepest title says
// most about the fact; only a deepest title too long by itself is cut.
function pathOf(titles) {
  while (titles.length > 1 && bytes(titles.join(' > ')) > maxPathBytes) titles = titles.slice(1)
  return prefix(titles.join(' > '), maxPathBytes)
}

function pack(path, units, facts) {
  const header = path ? `${path}\n` : ''
  const room = maxFactBytes - bytes(header)
  let body = null, continued = false
  const emit = (text, more) => facts.push({ path: header.slice(0, -1), body: text, continued: more })
  for (const lines of units) {
    let text = lines.join('\n')
    if (body !== null && bytes(body) + 1 + bytes(text) <= room) {
      body += `\n${text}`
      continue
    }
    if (body !== null) emit(body, continued)
    continued = false
    while (bytes(text) > room) {
      const head = split(text, room)
      emit(head, continued)
      text = text.slice(head.length)
      continued = true
    }
    body = text
  }
  if (body !== null) emit(body, continued)
}

// Cuts cleaned text into facts of { path, body, continued }, in file order.
// continued marks a fact whose body carries on the previous fact's cut unit.
export function cut(cleaned) {
  const facts = []
  let headings = [], units = [], unit = null, fence = null
  // level is the next heading's, 0 at the end. A heading with no text and no
  // deeper heading under it is a fact in itself, its title under its parents.
  const section = (level = 0) => {
    const titles = headings.map(({ title }) => title), last = headings.at(-1)
    if (!units.length && last && level <= last.level) pack(pathOf(titles.slice(0, -1)), [[last.title]], facts)
    else pack(pathOf(titles), units, facts)
    units = []; unit = null
  }
  for (const line of cleaned.split('\n')) {
    const heading = !fence && line.match(/^(#{1,6}) (.*\S.*)$/s)
    if (heading) {
      const level = heading[1].length
      section(level)
      headings = [...headings.filter((entry) => entry.level < level), { level, title: heading[2].trim() }]
      continue
    }
    if (fence) unit.push(line)
    else if (!line.trim()) unit = null
    else if (unit === null || /^([-*+] |\d+\. )/.test(line)) units.push(unit = [line])
    else unit.push(line)
    // A fence closes on a line of its opener's character, at least as long,
    // whatever its indent. A backtick opener with another backtick is inline code.
    const run = line.match(/^\s*(`{3,}|~{3,})(.*)$/s)
    if (fence) {
      if (run && run[1][0] === fence[0] && run[1].length >= fence.length && !run[2].trim()) fence = null
    } else if (run && !(run[1][0] === '`' && run[2].includes('`'))) fence = run[1]
  }
  section()
  return facts
}

// The named facts of one MEMORY.md, each with the text Harness stores.
export function factsOf(raw) {
  const cleaned = clean(raw)
  const snapshot = snapshotId(cleaned)
  const facts = cut(cleaned).map((fact, index) => ({
    name: `imported-${snapshot}-${String(index + 1).padStart(3, '0')}`,
    ...fact,
    text: fact.path ? `${fact.path}\n${fact.body}` : fact.body,
  }))
  return { snapshot, facts }
}

// Sorts the facts against every listed memory before anything is saved.
// refused holds the other snapshot ids when an earlier import came from a
// different file; then nothing is saved.
export function compare(facts, snapshot, rows) {
  const held = new Map(), others = new Set()
  for (const row of rows) {
    const match = row.name.match(importedName)
    if (!match) continue
    if (match[1] === snapshot) held.set(row.name, row.text)
    else others.add(match[1])
  }
  const plan = { refused: [...others].sort(), save: [], same: [], changed: [] }
  if (others.size) return plan
  for (const fact of facts) {
    if (!held.has(fact.name)) plan.save.push(fact)
    else if (held.get(fact.name) === fact.text) plan.same.push(fact)
    else plan.changed.push(fact)
  }
  return plan
}

export async function listMemories(client) {
  const rows = []
  let cursor = ''
  do {
    const page = await client.call('harness/memory/list', { query: '', cursor })
    rows.push(...page.items)
    cursor = page.nextCursor
  } while (cursor !== null)
  return rows
}

// Returns the exit code. client needs ship and call(method, params); base and
// cookie are for the Steward read.
export async function run({ client, base, cookie, dryRun = false, print = console.log }) {
  const ship = `~${client.ship}`
  const response = await fetch(`${base}/~/scry/steward/v1/prompts/files.json`, {
    headers: { cookie }, signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`Reading Steward's prompts copy failed: HTTP ${response.status}`)
  const memory = (await response.json())[ship]?.['MEMORY.md']
  if (memory === undefined) {
    print(`Steward on ${ship} holds no MEMORY.md, so nothing was imported. Possible reasons: the file is over 65,536 bytes, the desk or the OpenClaw plugin is older than the prompts copy, or the plugin never published it. Steward does not say which.`)
    return 1
  }
  const { snapshot, facts } = factsOf(memory)
  print(`MEMORY.md on ${ship}: snapshot ${snapshot}, ${facts.length} facts${dryRun ? ' (dry run, nothing will be saved)' : ''}`)
  if (!facts.length) {
    print('MEMORY.md holds no text outside managed blocks; nothing to import.')
    return 0
  }
  const plan = compare(facts, snapshot, await listMemories(client))
  if (plan.refused.length) {
    print(`Refused: Harness already holds facts imported from another snapshot (${plan.refused.join(', ')}). MEMORY.md changed since that import, and importing it on top would duplicate most of it under new names. Nothing was saved.`)
    return 1
  }
  if (dryRun) {
    const status = new Map([
      ...plan.save.map((fact) => [fact, 'would save']),
      ...plan.same.map((fact) => [fact, 'already imported']),
      ...plan.changed.map((fact) => [fact, 'changed since import, would leave alone']),
    ])
    for (const fact of facts) print(`--- ${fact.name} (${status.get(fact)}, ${bytes(fact.text)} bytes)\n${fact.text}`)
    // The list leaves forgotten facts out, so a rerun cannot tell them from missing ones.
    const rerun = plan.save.length && (plan.same.length || plan.changed.length)
    print(`Dry run: would save ${plan.save.length}, already imported ${plan.same.length}, changed and left alone ${plan.changed.length}, of ${facts.length} facts from snapshot ${snapshot}.${rerun ? ' A fact shown as "would save" may have been forgotten since the earlier import; a real run leaves a forgotten fact alone.' : ''}`)
    return 0
  }
  for (const fact of plan.same) print(`already imported ${fact.name}`)
  for (const fact of plan.changed) print(`changed since import, left alone: ${fact.name}`)
  let saved = 0, forgotten = 0
  for (const fact of plan.save) {
    try {
      await client.call('harness/memory/save', { name: fact.name, revision: '0', text: fact.text })
    } catch (error) {
      // The list leaves forgotten facts out, and a "0" save on one is refused.
      if (error.message !== forgottenRefusal) throw new Error(`Saving ${fact.name} failed after ${saved} saves: ${error.message}`)
      forgotten++
      print(`forgotten, left alone: ${fact.name}`)
      continue
    }
    saved++
    print(`saved ${fact.name}`)
  }
  print(`Saved ${saved}, already imported ${plan.same.length}, changed and left alone ${plan.changed.length}, forgotten and left alone ${forgotten}, of ${facts.length} facts from snapshot ${snapshot}.`)
  return 0
}

async function main() {
  const args = process.argv.slice(2)
  if (args.some((arg) => arg !== '--dry-run')) {
    process.stderr.write(usage)
    process.exitCode = 1
    return
  }
  // The client reads SHIP_COOKIE as it loads, so it is loaded only here.
  const { Client, base, cookie } = await import('../tests-js/lib/ship-client.mjs')
  const client = new Client()
  await client.start()
  try {
    process.exitCode = await run({ client, base, cookie, dryRun: args.includes('--dry-run') })
  } finally {
    await client.close()
  }
}

// Real paths, so that running the script through a symlink still runs it.
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1 })
