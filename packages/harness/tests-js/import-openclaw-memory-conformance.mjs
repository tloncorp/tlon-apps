// The OpenClaw MEMORY.md import against a fake ship: Steward is given a copy
// through its own projection route, as the OpenClaw plugin would publish it,
// and the import is run and rerun against Harness memory. It restores the
// ship's previous Steward copy; the imported memories stay, on a ship the
// runner resets before each script.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { factsOf, listMemories, run } from '../acp/import-openclaw-memory.mjs'

const script = fileURLToPath(new URL('../acp/import-openclaw-memory.mjs', import.meta.url))
const execute = promisify(execFile)
const client = new Client()
const ship = `~${client.ship}`
let saves = 0
// Counts the save requests the import sends, refused ones included.
const counted = { ship: client.ship, call: (method, params) => {
  if (method === 'harness/memory/save') saves++
  return client.call(method, params)
} }

const sections = Array.from({ length: 30 }, (_, index) =>
  `## Topic ${index + 1}\n- Fact ${index + 1} is about topic-${index + 1}.\n  - A nested detail.\n- A second fact.`)
const memory = [
  '<!-- idempotency-marker:tlon-runtime:v1 -->',
  'Seeded runtime text that must not be imported.',
  '<!-- /idempotency-marker -->',
  'A preamble before any heading.',
  '',
  '# Learned',
  ...sections,
  '## Commands',
  '```',
  '# a shell comment, not a heading',
  'deploy --dry-run',
  '```',
  '## Long',
  'ünïcödé '.repeat(250).trim(),
  '',
].join('\n')

async function files() {
  const response = await fetch(`${base}/~/scry/steward/v1/prompts/files.json`, { headers: { cookie }, signal: AbortSignal.timeout(15_000) })
  assert.ok(response.ok, `Steward scry HTTP ${response.status}`)
  return (await response.json())[ship]
}
async function project(copy) {
  const response = await fetch(`${base}/steward/~/v1/prompts/project`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ project: copy }), signal: AbortSignal.timeout(15_000),
  })
  assert.ok(response.ok, `Steward projection HTTP ${response.status}`)
  assert.deepEqual(await response.json(), { projected: true })
  assert.deepEqual((await files()) ?? {}, copy)
}
async function importing(dryRun = false) {
  saves = 0
  const lines = []
  const code = await run({ client: counted, base, cookie, dryRun, print: (line) => { console.log(line); lines.push(line) } })
  return { code, output: lines.join('\n') }
}
async function cli(...args) {
  let result
  try {
    result = { code: 0, ...(await execute(process.execPath, [script, ...args], { timeout: 120_000 })) }
  } catch (error) {
    if (typeof error.code !== 'number') throw error
    result = error
  }
  console.log(result.stdout + result.stderr)
  assert.ok(!`${result.stdout}${result.stderr}`.includes(cookie.split('=')[1]), 'the script never prints the cookie')
  return result
}
const imported = (rows) => new Map(rows.filter(({ name }) => name.startsWith('imported-')).map((row) => [row.name, row]))

const previous = await files()
await client.start()
try {
  await project({ 'MEMORY.md': memory })
  const { snapshot, facts } = factsOf(memory)
  assert.ok(facts.length > 25, 'more facts than one list page')
  assert.ok(!facts.some(({ text }) => text.includes('Seeded runtime text')))

  console.log('--- dry run on a ship without imported memories')
  const before = await listMemories(client)
  assert.equal(imported(before).size, 0)
  const dry = await cli('--dry-run')
  assert.equal(dry.code, 0)
  for (const fact of facts) assert.ok(dry.stdout.includes(`--- ${fact.name} (would save`), fact.name)
  assert.deepEqual(await listMemories(client), before, '--dry-run saves nothing')

  console.log('--- first import')
  const first = await importing()
  assert.equal(first.code, 0)
  assert.equal(saves, facts.length)
  assert.match(first.output, new RegExp(`Saved ${facts.length}, already imported 0, changed and left alone 0, forgotten and left alone 0, of ${facts.length} facts from snapshot ${snapshot}\\.`))
  const held = imported(await listMemories(client))
  assert.deepEqual([...held.keys()].sort(), facts.map(({ name }) => name))
  for (const fact of facts) assert.equal(held.get(fact.name).text, fact.text, fact.name)

  console.log('--- second run of the same file')
  const second = await importing()
  assert.equal(second.code, 0)
  assert.equal(saves, 0, 'a second run on an unchanged file sends no save')
  assert.match(second.output, new RegExp(`Saved 0, already imported ${facts.length}, `))
  assert.deepEqual(imported(await listMemories(client)), held)

  console.log('--- after the owner changes one fact and forgets another')
  const [changed, forgotten] = [facts[1], facts[2]]
  const edit = await client.call('harness/memory/save', { name: changed.name, revision: held.get(changed.name).revision, text: 'Corrected by the owner.' })
  await client.call('harness/memory/forget', { name: forgotten.name, revision: held.get(forgotten.name).revision })
  const third = await importing()
  assert.equal(third.code, 0)
  assert.equal(saves, 1, 'only the forgotten name, missing from the list, is tried')
  assert.ok(third.output.includes(`changed since import, left alone: ${changed.name}`))
  assert.ok(third.output.includes(`forgotten, left alone: ${forgotten.name}`))
  assert.match(third.output, new RegExp(`Saved 0, already imported ${facts.length - 2}, changed and left alone 1, forgotten and left alone 1, `))
  const after = imported(await listMemories(client))
  assert.equal(after.get(changed.name).text, 'Corrected by the owner.')
  assert.equal(after.get(changed.name).revision, edit.revision)
  assert.ok(!after.has(forgotten.name))
  assert.equal((await client.call('harness/memory/read', { name: forgotten.name })).text, null, 'the forgotten fact stays forgotten')

  console.log('--- a changed file')
  await project({ 'MEMORY.md': `${memory}\nA line added after the import.\n` })
  const settled = await listMemories(client)
  const refused = await cli()
  assert.equal(refused.code, 1)
  assert.match(refused.stdout, new RegExp(`imported from another snapshot \\(${snapshot}\\).*Nothing was saved\\.`))
  assert.deepEqual(await listMemories(client), settled, 'a refused snapshot saves nothing')
  saves = 0
  assert.equal((await importing()).code, 1)
  assert.equal(saves, 0)
  console.log('import-openclaw-memory conformance passed')
} finally {
  await project(previous ?? {})
  await client.close()
}
