import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { clean, compare, cut, factsOf, maxFactBytes, maxPathBytes, snapshotId } from './import-openclaw-memory.mjs'

const bytes = (text) => Buffer.byteLength(text, 'utf8')
const whole = (text) => Buffer.from(text, 'utf8').toString('utf8') === text && !text.includes('�')

const memory = `Preamble line kept before any heading.

<!-- idempotency-marker:tlon-runtime:v1 -->
Seeded runtime text.
<!-- /idempotency-marker -->

# People
- Alice prefers mornings.
  - She is in Lisbon.
  and replies slowly on Fridays.
- Bob runs the release train.

## Projects
The launch is in March.
It slipped once.

\`\`\`
# not a heading
- not an item

still literal
\`\`\`

<!-- idempotency-marker:tlon-runtime:v2 -->
More seeded text.
# Seeded heading
<!-- /idempotency-marker -->
### Notes
1. First numbered item.
2. Second numbered item.
`
const headless = 'Just one paragraph\nover two lines.\n\nAnd a second one.\n- with an item'
const oversize = `# Long\n${'word '.repeat(300).trim()}\n\n${'日'.repeat(700)}`

// The cleaned text's non-blank lines, without headings outside code fences.
function contentLines(cleaned) {
  const lines = []
  let fenced = false
  for (const line of cleaned.split('\n')) {
    if (!fenced && /^#{1,6} /.test(line)) continue
    if (line.trim()) lines.push(line)
    if (line.startsWith('```')) fenced = !fenced
  }
  return lines
}

// Rejoins the facts' bodies: whole units by a newline, cut pieces as they were.
function rejoin(facts) {
  return facts.map(({ body, continued }, index) => (index && !continued ? '\n' : '') + body).join('')
    .split('\n').filter((line) => line.trim())
}

test('every managed block is removed, whatever its version, including a second one', () => {
  const cleaned = clean(memory)
  for (const seeded of ['idempotency-marker', 'Seeded runtime text.', 'More seeded text.', 'Seeded heading']) assert.ok(!cleaned.includes(seeded), seeded)
  for (const kept of ['Preamble line', '# People', 'Bob runs', '### Notes', 'Second numbered item.']) assert.ok(cleaned.includes(kept), kept)
})

test('an opening marker with no closing marker stops the import', () => {
  assert.throws(() => factsOf('# Notes\nKept.\n<!-- idempotency-marker:tlon-runtime:v3 -->\nUnclosed.\n'), /no closing marker/)
})

test('CRLF input gives the same facts as LF', () => {
  assert.deepEqual(factsOf(memory.replaceAll('\n', '\r\n')), factsOf(memory))
})

test('a heading line, a list line and a blank line inside a code fence stay literal', () => {
  const fence = factsOf(memory).facts.find((fact) => fact.text.includes('```'))
  assert.equal(fence.path, 'People > Projects')
  assert.ok(fence.body.includes('```\n# not a heading\n- not an item\n\nstill literal\n```'))
})

test('a level-3 heading under a level-1 and then a level-2 heading takes the right path', () => {
  const facts = cut('# Top\n### Deep\nunder deep\n## Middle\n### Deeper\nunder deeper')
  assert.deepEqual(facts.map(({ path, body }) => [path, body]), [['Top > Deep', 'under deep'], ['Top > Middle > Deeper', 'under deeper']])
  assert.equal(factsOf(memory).facts.at(-1).path, 'People > Projects > Notes')
})

test('a paragraph, then a list item with a nested item and a continuation line, make two units', () => {
  const paragraph = `${'p'.repeat(600)}\nsecond paragraph line`
  const item = `- ${'i'.repeat(600)}\n  - nested item\n  continuation line`
  assert.deepEqual(cut(`# Units\n${paragraph}\n${item}`).map(({ body }) => body), [paragraph, item])
})

test('a blank line starts a new unit and a top-level list item starts one without a blank line', () => {
  const a = 'a'.repeat(600), b = 'b'.repeat(600), c = 'c'.repeat(600)
  assert.deepEqual(cut(`${a}\n\n${b}\n* ${c}`).map(({ body }) => body), [a, b, `* ${c}`])
  // Without a blank line or an item, the second line joins the first unit, which
  // is then too big and cut at its newline.
  assert.deepEqual(cut(`${a}\n${b}`).map(({ body, continued }) => [body, continued]), [[`${a}\n`, false], [b, true]])
})

test('units of a section share a fact while they fit, joined by one newline', () => {
  assert.deepEqual(cut('# S\none\n\ntwo\n- three').map(({ path, body }) => [path, body]), [['S', 'one\ntwo\n- three']])
})

test('text before the first heading and a file with no headings are kept with an empty path', () => {
  const first = factsOf(memory).facts[0]
  assert.equal(first.path, '')
  assert.equal(first.text, 'Preamble line kept before any heading.')
  const { facts } = factsOf(headless)
  assert.deepEqual(facts.map(({ text }) => text), [headless.replace('\n\n', '\n')])
})

test('a section with no units makes no fact', () => {
  assert.deepEqual(cut('# Empty\n\n## Also empty\n# Full\nbody').map(({ path }) => path), ['Full'])
})

test('no fact exceeds 1,024 bytes', () => {
  for (const fixture of [memory, headless, oversize]) {
    for (const { text } of factsOf(fixture).facts) assert.ok(bytes(text) <= maxFactBytes, `${bytes(text)} bytes`)
  }
})

test('a path line over 120 bytes is cut on a character boundary', () => {
  const title = 'é'.repeat(41) + 'ü'.repeat(40)
  const [fact] = factsOf(`# ${title}\n## more\nbody`).facts
  assert.ok(bytes(fact.path) <= maxPathBytes && bytes(fact.path) >= maxPathBytes - 1)
  assert.ok(whole(fact.path))
  assert.ok(`${title} > more`.startsWith(fact.path))
  assert.equal(fact.text, `${fact.path}\nbody`)
})

test('a 2,000-byte unit with no whitespace is cut without splitting a multi-byte character', () => {
  const unit = 'x' + '日'.repeat(666) + 'y'
  assert.equal(bytes(unit), 2000)
  const facts = cut(`# Big\n${unit}`)
  assert.ok(facts.length > 1)
  for (const { body, path } of facts) {
    assert.ok(whole(body))
    assert.ok(bytes(`${path}\n${body}`) <= maxFactBytes)
  }
  assert.equal(facts.map(({ body }) => body).join(''), unit)
  assert.deepEqual(facts.map(({ continued }) => continued), facts.map((_, index) => index > 0))
})

test('an oversize unit is cut at the last whitespace that fits', () => {
  const unit = 'word '.repeat(300).trim()
  const [first, second] = cut(`# Long\n${unit}`)
  assert.ok(first.body.endsWith('word '))
  assert.ok(bytes(`Long\n${first.body}word `) > maxFactBytes)
  assert.ok(second.continued && second.body.startsWith('word'))
  assert.equal(first.body + second.body, unit)
})

test('joining the bodies gives back every non-blank, non-heading line of the cleaned text, in order', () => {
  for (const fixture of [memory, headless, oversize, memory.replaceAll('\n', '\r\n')]) {
    const cleaned = clean(fixture)
    assert.deepEqual(rejoin(cut(cleaned)), contentLines(cleaned))
  }
})

test('names are valid, numbered from 001 by position, and the same on a second call', () => {
  const first = factsOf(memory), second = factsOf(memory)
  assert.equal(first.snapshot, snapshotId(clean(memory)))
  assert.match(first.snapshot, /^[0-9a-f]{8}$/)
  first.facts.forEach(({ name }, index) => {
    assert.match(name, /^[a-z0-9_-]{1,64}$/)
    assert.equal(name, `imported-${first.snapshot}-${String(index + 1).padStart(3, '0')}`)
  })
  assert.deepEqual(second, first)
  assert.notEqual(factsOf(`${memory}\nOne more line.`).snapshot, first.snapshot)
})

const row = (name, text) => ({ name, revision: '7', text })

test('with no imported memories every fact is saved', () => {
  const { snapshot, facts } = factsOf(memory)
  const plan = compare(facts, snapshot, [row('project', 'An unrelated memory.')])
  assert.deepEqual(plan, { refused: [], save: facts, same: [], changed: [] })
})

test('a rerun of the same snapshot keeps what is there, leaves a changed fact alone and saves only the missing one', () => {
  const { snapshot, facts } = factsOf(memory)
  const [kept, changed, missing] = facts
  const plan = compare([kept, changed, missing], snapshot, [row(kept.name, kept.text), row(changed.name, 'Edited by the owner.')])
  assert.deepEqual(plan, { refused: [], save: [missing], same: [kept], changed: [changed] })
})

test('memories imported from another snapshot refuse the whole import', () => {
  const { snapshot, facts } = factsOf(memory)
  const plan = compare(facts, snapshot, [row(facts[0].name, facts[0].text), row('imported-0badf00d-001', 'Older file.')])
  assert.deepEqual(plan, { refused: ['0badf00d'], save: [], same: [], changed: [] })
})

test('names outside the imported-<snapshot>-<number> pattern do not affect the plan', () => {
  const { snapshot, facts } = factsOf(memory)
  const plan = compare(facts, snapshot, [row('imported-notes', 'The bot named this itself.'), row('imported-0badf00d-01', 'Not three digits.')])
  assert.deepEqual(plan.save, facts)
  assert.deepEqual(plan.refused, [])
})

test('the script runs when invoked through a symlink', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harness-import-unit-'))
  t.after(() => rm(directory, { recursive: true }))
  const link = join(directory, 'import-openclaw-memory.mjs')
  await symlink(fileURLToPath(new URL('./import-openclaw-memory.mjs', import.meta.url)), link)
  // Without a cookie the entry fails at once, which shows it ran.
  await assert.rejects(promisify(execFile)(process.execPath, [link], { timeout: 5000, env: { PATH: process.env.PATH } }),
    (error) => error.code === 1 && /Set SHIP_COOKIE/.test(error.stderr))
})
