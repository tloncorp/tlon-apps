// Opt-in real-provider check using the ship's saved defaults/credential.
// Owns one temporary, tools-disabled session. Does not print credentials or
// change global configuration. Includes compaction and background capture.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client, base, cookie } from './lib/ship-client.mjs'

const client = new Client()
let sessionId
const noteName = `deployment-${randomUUID().slice(0, 8)}`
const snapshot = () => client.call('harness/session/snapshot', { sessionId })
const prompt = (text) => client.call('session/prompt', {
  sessionId, prompt: [{ type: 'text', text }],
})
try {
  await client.start()
  const defaults = await client.call('harness/defaults')
  const override = process.env.SMOKE_URL || process.env.SMOKE_MODEL
  if (override) assert.ok(process.env.SMOKE_URL && process.env.SMOKE_MODEL, 'Set both SMOKE_URL and SMOKE_MODEL')
  const config = { ...defaults, ...(override ? {
    url: process.env.SMOKE_URL, model: process.env.SMOKE_MODEL,
    headers: [], 'max-context': 80000, // Conservative budget for this small test.
  } : {}), key: '', tools: [],
  system: 'This is a bounded conversation continuity test. Answer briefly, use no tools, and preserve the facts supplied by the user.' }
  ;({ sessionId } = await client.call('session/new', { name: `compact-provider-${randomUUID().slice(0, 8)}` }))
  await client.call('harness/session/configure', { sessionId, config })
  const anchor = `PINE-${randomUUID().slice(0, 8)}`
  const pinned = `PORT-${randomUUID().slice(0, 8)}`
  await prompt(`/remember ${noteName} The deployment label is ${pinned}.`)
  await prompt(`Our project identifier is ${anchor}. The project has a read-only policy and an amber theme. `
    + 'We are designing a small modular assistant whose history stays separate from the model context. '
    + 'The transcript must survive compaction, requests need output headroom, and failed summaries must preserve the previous context. '.repeat(15)
    + 'Acknowledge these project facts in one sentence.')
  await prompt('A separate recent note: this test must make no external changes. Acknowledge in one sentence.')
  const before = await snapshot()
  const start = Date.now()
  await prompt('/compact')
  const compactMs = Date.now() - start
  const compacted = await snapshot()
  assert.equal(compacted.compactions, 1)
  const memoryResponse = await fetch(`${base}/~/scry/harness/memory/${noteName}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(memoryResponse.ok)
  assert.equal((await memoryResponse.json()).text, `The deployment label is ${pinned}.`)
  assert.deepEqual(compacted.entries.slice(0, before.entries.length), before.entries)
  await prompt('What is the exact project identifier, access policy, theme, and deployment label? Answer in one short sentence.')
  const final = await snapshot()
  const answer = final.entries.at(-1).body
  assert.ok(answer.includes(anchor), 'project identifier survived in model context')
  assert.match(answer, /read.only/i)
  assert.match(answer, /amber/i)
  assert.ok(answer.includes(pinned), 'explicit note is usable after compaction')
  console.log(JSON.stringify({ ok: true, model: config.model, compactMs,
    compactionUsage: final.compactionUsage, answer, transcriptEntries: final.entries.length,
  }, null, 2))
} finally {
  if (sessionId) await prompt(`/forget ${noteName}`).catch(() => {})
  if (sessionId) await client.call('session/delete', { sessionId }).catch(() => {})
  await client.close()
}
