// Real ACP/head/Iris and generic hand delivery against a stand-in provider
// that refuses any request above a byte limit, as a provider refuses a request
// too large for its model. A refused turn compacts and is answered once.
// Owns named fixtures; clears and restores the summary model overrides so
// summaries use each conversation's own route.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

// Count every terminal frame the client receives, including any duplicate
// whose promise was already settled.
const terminals = []
class CountingMap extends Map {
  get(id) { terminals.push(id); return super.get(id) }
}
const client = new Client(), observer = new Client()
client.pending = new CountingMap()
const tag = `size-${randomUUID().slice(0, 8)}`
const hand = new HandClient(observer, { hand: tag, worker: 'fixture' })
const sessions = [], bindings = [], requests = [], held = []
let url, savedModels, limit = Infinity, hold = false, toolHits = 0
// The refusal states no counts, so nothing can read a limit from it.
const tooLarge = '{"error":{"message":"This request exceeds the model\'s maximum context length.","type":"invalid_request_error","code":"context_length_exceeded"}}'
const summary = 'Checkpoint: earlier exchanges discussed project notes; the requested page was fetched.'
const structured = (body) => body.messages[0].content.includes('Return one JSON object with summary')
const checkpoint = (body) => structured(body) ? JSON.stringify({ summary, memories: [] }) : summary
function respond(res, message, finish = 'stop') {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: finish, message }],
    usage: { prompt_tokens: 100, completion_tokens: 20 } }))
}
const server = createServer(async (req, res) => {
  if (req.url === '/big') {
    toolHits++
    return res.end('BIG_TOOL_RESULT '.repeat(500))
  }
  const raw = await readText(req)
  const body = JSON.parse(raw)
  const first = body.messages?.[0]?.content ?? ''
  if (first.startsWith('Extract reusable shared knowledge')) return respond(res, { role: 'assistant', content: '[]' })
  const kind = first.startsWith('Produce a concise historical checkpoint') ? 'summary' : 'turn'
  const record = { kind, size: raw.length, body }
  requests.push(record)
  if (raw.length > limit) {
    record.status = 400
    res.writeHead(400, { 'content-type': 'application/json' })
    return res.end(tooLarge)
  }
  record.status = 200
  if (kind === 'summary') {
    if (hold) return held.push({ res, body })
    return respond(res, { role: 'assistant', content: checkpoint(body) })
  }
  // Fetch once per request for the page; a checkpoint records that it was fetched.
  const last = body.messages.findLastIndex((m) => m.role === 'user')
  const fetched = body.messages.slice(last + 1).some((m) => m.role === 'tool') ||
    body.messages.some((m) => typeof m.content === 'string' && m.content.includes(summary))
  if (JSON.stringify(body.messages[last]?.content ?? '').includes('FETCH_BIG') && !fetched) {
    return respond(res, { role: 'assistant', content: '', tool_calls: [{ id: `call-${requests.length}`,
      type: 'function', function: { name: 'http_fetch', arguments: JSON.stringify({ url: `${url.replace('/completions', '')}/big` }) } }] },
    'tool_calls')
  }
  respond(res, { role: 'assistant', content: 'ANSWER: ' + 'Useful project detail. '.repeat(40) })
})
const release = () => {
  const { res, body } = held.shift()
  respond(res, { role: 'assistant', content: checkpoint(body) })
}
const snapshot = (sessionId) => observer.call('harness/session/snapshot', { sessionId })
const prompt = (sessionId, text) => client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text }] })
const normal = (i) => `Exchange ${i}: ` + 'Normal sized project note. '.repeat(50)
async function until(label, check, timeoutMs = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const value = await check()
    if (value) return value
    await sleep(200)
  }
  throw Error(`Timed out: ${label}`)
}
async function make(name, tools = []) {
  console.log(`Checking ${name}`)
  const { sessionId } = await client.call('session/new', { name: `${tag}-${name}` })
  sessions.push(sessionId)
  await client.call('harness/session/configure', { sessionId, config: {
    url, model: 'fixture', key: '', headers: [], 'max-context': 400000,
    system: 'The fixture owner instructions.', tools,
  } })
  return sessionId
}
// The first turn's size, plus room for a few more exchanges.
async function calibrate(sid, room, send = (text) => prompt(sid, text)) {
  limit = Infinity
  const from = requests.length
  await send('hello')
  limit = requests.slice(from).find((r) => r.kind === 'turn').size + room
}
// One answered prompt, whose requests show the refusal and the recovery.
function recovered(steps, label) {
  const kinds = steps.map((r) => `${r.kind}:${r.status}`)
  assert.equal(steps.filter((r) => r.status === 400).length, 1, `${label}: one refusal (${kinds})`)
  const refused = steps.findIndex((r) => r.status === 400)
  assert.equal(steps[refused].kind, 'turn', label)
  assert.ok(steps.slice(refused).some((r) => r.kind === 'summary' && r.status === 200), `${label}: a summary follows (${kinds})`)
  const answer = steps.at(-1)
  assert.equal(answer.kind, 'turn', label)
  assert.equal(answer.status, 200, label)
  assert.ok(answer.size < limit, `${label}: the re-issued turn fits`)
  assert.ok(answer.size < steps[refused].size, `${label}: the re-issued turn is smaller`)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}/completions`
  await Promise.all([client.start(), observer.start()])
  savedModels = await client.call('harness/summary-models')
  await client.call('harness/summary-models/configure', { models: { compaction: null, lcm: null } })

  // History grows past the provider's limit: the refused prompt is answered.
  const historySid = await make('history')
  await calibrate(historySid, 6000)
  let steps = []
  for (let i = 1; i <= 8 && !steps.some((r) => r.status === 400); i++) {
    const from = requests.length
    const terminalsBefore = terminals.length
    const id = client.rpc + 1
    const result = await prompt(historySid, normal(i))
    assert.equal(result.stopReason, 'end_turn')
    steps = requests.slice(from)
    await sleep(500)
    assert.deepEqual(terminals.slice(terminalsBefore).filter((t) => t === id), [id], 'one terminal frame for the prompt')
  }
  recovered(steps, 'history')
  const history = await snapshot(historySid)
  assert.equal(history.phase, 'idle')
  assert.ok(history.compactions >= 1)
  assert.match(history.entries.at(-1).body, /^ANSWER:/)

  // A tool result pushes the next request over: compaction, one answer, and
  // the tool is not called again.
  const toolSid = await make('tool', ['web'])
  await calibrate(toolSid, 3000)
  const toolFrom = requests.length
  const toolResult = await prompt(toolSid, 'Please FETCH_BIG now.')
  assert.equal(toolResult.stopReason, 'end_turn')
  const toolSteps = requests.slice(toolFrom)
  assert.equal(toolSteps[0].kind, 'turn')
  assert.equal(toolSteps[0].status, 200, 'the tool call itself fits')
  recovered(toolSteps.slice(1), 'tool')
  assert.equal(toolHits, 1, 'the tool ran once')

  // A hand sees nothing while the recovery summary is held, then one reply
  // for that input, and one for the next.
  const handSid = await make('hand')
  bindings.push(handSid)
  await hand.bind(handSid, { address: 'fixture:conversation', sessionId: handSid, actors: ['alice'] })
  const published = async (input) => (await hand.outbox()).filter((p) => p.inputId === input.inputId)
  const observe = async (event, text) => {
    const input = await hand.observe(handSid, { event, text, actor: 'alice' })
    await until(`${event} settles`, async () => held.length || (await published(input)).length)
    return input
  }
  await calibrate(handSid, 6000, (text) => observe('calibrate', text))
  hold = true
  let refused
  for (let i = 1; i <= 8 && !refused; i++) {
    const input = await observe(`normal-${i}`, normal(i))
    if (held.length) refused = input
  }
  assert.ok(refused, 'a refusal started a held summary')
  await sleep(1500)
  assert.deepEqual(await published(refused), [], 'no publication while the summary is held')
  hold = false
  release()
  await until('reply after the summary', async () => (await published(refused)).length)
  await sleep(1500)
  const replies = await published(refused)
  assert.equal(replies.length, 1, 'one publication for the refused input')
  assert.match(replies[0].text, /ANSWER:/)
  const next = await observe('after', 'One more short question?')
  await sleep(1500)
  assert.equal((await published(next)).length, 1, 'one publication for the next input')

  console.log(JSON.stringify({ ok: true, checks: [
    'history past the limit is compacted and answered once',
    'a tool result past the limit is compacted without re-running the tool',
    'a hand gets one reply per input, none while the summary is held',
    'one ACP terminal frame per prompt',
  ] }, null, 2))
} finally {
  for (const { res } of held) res.destroy()
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
  // Hand-bound sessions retain their audit records; unbound fixtures are removed.
  for (const sessionId of sessions.filter((id) => !bindings.includes(id))) {
    await clean(`delete fixture session ${sessionId}`, () => client.call('session/delete', { sessionId }))
  }
  await Promise.all([clean('close client', () => client.close()), clean('close observer', () => observer.close())])
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, `Size recovery fixture ${tag} cleanup is incomplete`)
  console.log('PASS summary settings restored; unbound fixtures removed and bound audit fixtures disabled')
}
