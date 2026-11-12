// Real head/ACP/Iris/index integration. No paid provider requests. Run alone:
// this temporarily selects local summary overrides and restores them on exit.
// Generic-hand replies use a synthetic sink; disabled bound fixtures retain
// their audit records. No Tlon adapter or real social destination is used.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const client = new Client(), names = [], requests = []
const tag = `lcmcheck${randomUUID().replaceAll('-', '').slice(0, 10)}`
const hand = new HandClient(client, { hand: tag, worker: 'fixture' }), bindings = []
let savedModels, leafCount = 0, branchCount = 0, recall = false
const server = createServer(async (req, res) => {
  const raw = await readText(req)
  const body = JSON.parse(raw)
  requests.push(body)
  let message
  const last = body.messages.at(-1)
  if (body.model === 'leaf-fixture') {
    leafCount++
    // Leaf compaction with memory evidence asks for one JSON object in one request.
    const text = `${tag} leaf ${leafCount}: Retain the chosen protocol and its original evidence.`
    const structured = body.messages[0].content.includes('Return one JSON object with summary')
    message = { role: 'assistant', content: structured ? JSON.stringify({ summary: text, memories: [] }) : text }
  } else if (body.model === 'branch-fixture') {
    branchCount++
    message = { role: 'assistant', content: `${tag} hierarchy: Preserve the protocol decision.` }
  } else if (recall && last.role !== 'tool') {
    message = { role: 'assistant', content: '', tool_calls: [{ id: 'recall', type: 'function', function: { name: 'lcm_search', arguments: JSON.stringify({ query: `${tag} originalneedle` }) } }] }
  } else if (recall) message = { role: 'assistant', content: last.content }
  else message = { role: 'assistant', content: 'Decision and evidence. '.repeat(30) }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ message, finish_reason: message.tool_calls ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 20 } }))
})
async function until(check, label = 'corpus indexing') {
  for (let i = 0; i < 200; i++) { const value = await check(); if (value) return value; await sleep(100) }
  throw new Error(`${label} did not settle within 20 seconds`)
}
const prompt = (sessionId, text) => client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text }] })
const snapshot = (sessionId) => client.call('harness/session/snapshot', { sessionId })
const search = (query, cursor) => client.call('harness/corpus/search', { query, limit: 2, ...(cursor ? { cursor } : {}) })
const drain = () => until(async () => !(await client.call('harness/corpus/status')).indexing)
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const config = { url: `http://127.0.0.1:${server.address().port}/completions`, model: 'conversation-fixture', key: '', headers: [], system: '', tools: [], 'max-context': 100000 }
  await client.start()
  savedModels = await client.call('harness/summary-models')
  await client.call('harness/summary-models/configure', { models: { compaction: { ...config, model: 'leaf-fixture' }, lcm: { ...config, model: 'branch-fixture' } } })
  async function make(suffix) {
    const name = `${tag}-${suffix}`
    await client.call('session/new', { name }); names.push(name)
    await client.call('harness/session/configure', { sessionId: name, config })
    return name
  }
  const sid = await make('evidence')
  for (let i = 0; i < 5; i++) {
    await prompt(sid, `${tag} originalneedle exchange ${i}. ${'Original recoverable facts. '.repeat(30)}`)
    await prompt(sid, `Recent exchange ${i}. ${'Keep current details verbatim. '.repeat(10)}`)
    await prompt(sid, '/compact')
  }
  await prompt(sid, 'Continue after hierarchy formation.')
  assert.ok(leafCount >= 4)
  assert.ok(branchCount >= 1, 'four sibling leaves must form a real parent')
  assert.ok(requests.filter((r) => r.model === 'leaf-fixture').every((r) => !r.messages.some((m) => m.content?.includes('[LCM node'))), 'leaves do not recursively summarize previous roots')
  assert.ok(requests.filter((r) => r.model === 'branch-fixture').every((r) => !r.tools), 'condensation has no tools')
  await drain()
  const page = await search(`${tag} originalneedle`)
  assert.equal(page.hits.length, 2)
  assert.ok(page.cursor)
  const second = await search(`${tag} originalneedle`, page.cursor)
  assert.ok(second.hits.every((r) => !page.hits.some((old) => old.eventCount === r.eventCount)))
  await assert.rejects(search(`${tag} different`, page.cursor), /Restart/)
  const source = page.hits[0]
  const original = await client.call('harness/corpus/read', source)
  assert.match(original.body, /Original recoverable facts/)
  const parents = await search(`${tag} hierarchy`)
  const parent = parents.hits.find((r) => r.kind === 'summary')
  assert.ok(parent)
  const expanded = await client.call('harness/corpus/expand', parent)
  assert.equal(expanded.depth, 1)
  assert.equal(expanded.sources.length, 4)
  const leaf = await client.call('harness/corpus/expand', expanded.sources[0])
  assert.ok(leaf.sources.some((r) => r.kind === 'message'))
  assert.ok((await client.call('harness/corpus/read', leaf.sources[0])).body)

  const reader = await make('reader')
  recall = true
  await prompt(reader, 'Recall the stored evidence.')
  let answer = (await snapshot(reader)).entries.at(-1).body
  // Direct owner conversations hold the live owner tools whatever their saved
  // grants say (execution-tools), so grant-less isolation is checked on a hand below.
  assert.ok(answer.includes(sid), 'an owner conversation recalls globally despite empty saved grants')
  await client.call('harness/session/configure', { sessionId: reader, config: { ...config, tools: ['corpus'] } })
  await prompt(reader, 'Recall with explicit owner authority.')
  answer = (await snapshot(reader)).entries.at(-1).body
  assert.ok(answer.includes(sid), 'the explicit corpus grant enables global owner recall')

  const ungranted = await make('hand-ungranted')
  await hand.bind(ungranted, { address: 'fixture-only:ungranted', sessionId: ungranted, actors: ['participant'] })
  bindings.push(ungranted)
  await hand.observe(ungranted, { event: 'recall-ungranted', actor: 'participant', text: 'Recall the stored evidence.' })
  const ungrantedReply = await until(async () => (await hand.outbox()).find((row) => row.sessionId === ungranted), 'ungranted recall reply')
  assert.match(ungrantedReply.text, /"hits":\[\]/, 'a model cannot read another session without a corpus grant')
  await hand.deliver(ungrantedReply.effectId, async () => 'fixture-local-ungranted')

  const social = await make('hand')
  await client.call('harness/session/configure', { sessionId: social, config: { ...config, tools: ['corpus'] } })
  await hand.bind(social, { address: 'fixture-only:recall', sessionId: social, actors: ['participant'] })
  bindings.push(social)
  await hand.observe(social, { event: 'recall', actor: 'participant', text: 'Recall the stored evidence.' })
  const scopedReply = await until(async () => (await hand.outbox()).find((row) => row.sessionId === social), 'social recall reply')
  await hand.deliver(scopedReply.effectId, async () => 'fixture-local-recall')
  recall = false
  await hand.observe(social, { event: 'evidence', actor: 'participant', text: `${tag} handneedle: source evidence from a non-Tlon hand.` })
  const handReply = await until(async () => (await hand.outbox()).find((row) => row.sessionId === social), 'generic hand evidence reply')
  await hand.deliver(handReply.effectId, async () => 'fixture-local-evidence')
  await drain()
  assert.ok((await search(`${tag} handneedle`)).hits.some((row) => row.sessionId === social), 'Generic hand input enters the shared corpus')
  const renamed = `${tag}-renamed`
  await client.call('harness/session/rename', { sessionId: sid, name: renamed })
  names[names.indexOf(sid)] = renamed
  const renamedSource = await client.call('harness/corpus/read', source)
  assert.equal(renamedSource.record.sessionId, renamed)
  assert.equal(renamedSource.body, original.body)
  await client.call('session/delete', { sessionId: renamed }); names.splice(names.indexOf(renamed), 1)
  await assert.rejects(client.call('harness/corpus/read', source), /not available|no longer/)
  await client.call('session/new', { name: renamed }); names.push(renamed)
  await assert.rejects(client.call('harness/corpus/read', source), /not available|no longer/)
  console.log(JSON.stringify({ ok: true, leafCount, branchCount, checks: ['separate routes', 'real hierarchical condensation', 'source expansion', 'retained raw text', 'indexed pagination', 'cursor fences', 'model recall scopes', 'social recall stays local despite corpus grant', 'non-Tlon hand indexing', 'rename identity', 'delete/recreate isolation'] }))
} finally {
  const cleanupErrors = []
  const clean = async (label, action) => {
    try { await action() }
    catch (error) { cleanupErrors.push(new Error(`${label}: ${error.message}`)) }
  }
  if (savedModels) await clean('restore summary settings', async () => {
    await client.call('harness/summary-models/configure', { models: savedModels })
    assert.deepEqual(await client.call('harness/summary-models'), savedModels)
  })
  for (const id of bindings) await clean(`disable fixture binding ${id}`, () => hand.enable(id, false))
  for (const sessionId of names.filter((id) => !bindings.includes(id))) await clean(`delete fixture session ${sessionId}`, () => client.call('session/delete', { sessionId }))
  await clean('close client', () => client.close())
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, `LCM fixture ${tag} cleanup is incomplete`)
  console.log('PASS summary settings restored; unbound LCM fixtures removed and bound audit fixtures disabled')
}
