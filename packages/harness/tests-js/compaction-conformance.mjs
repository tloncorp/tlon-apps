// Real ACP/head/Iris and generic hand delivery; deterministic local provider.
// Owns named fixtures. Temporarily selects a local summary route and restores
// the prior summary overrides; never changes defaults or credential keys.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const client = new Client(), observer = new Client()
const tag = `compact-${randomUUID().slice(0, 8)}`
const hand = new HandClient(observer, { hand: tag, worker: 'fixture' })
const sessions = [], bindings = [], requests = []
let mode = 'ok', url, savedModels, measured = false
const held = []
const summary = 'Checkpoint: preserve the project constraints and source history.'
// A leaf compaction with memory evidence asks for one JSON object in one request.
const structured = (body) => body.messages[0].content.includes('Return one JSON object with summary')
const checkpoint = (body, text) => structured(body) ? JSON.stringify({ summary: text, memories: [] }) : text
function respond(res, content, finish = 'stop', promptTokens = 100) {
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: finish,
    message: { role: 'assistant', content } }],
  usage: { prompt_tokens: promptTokens, completion_tokens: 20 } }))
}
const server = createServer(async (req, res) => {
  const raw = await readText(req)
  const body = JSON.parse(raw)
  const compact = body.messages?.[0]?.content?.startsWith('Produce a concise historical checkpoint')
  if (body.messages?.[0]?.content?.startsWith('Extract reusable shared knowledge')) return respond(res, '[]')
  requests.push({ body, compact })
  if (!compact) return respond(res, 'ANSWER: ' + 'Useful project detail. '.repeat(40), 'stop', measured ? Math.ceil(raw.length / 4) : 100)
  if (mode === 'hold') { held.push({ res, body }); return }
  if (mode === 'auth') { res.writeHead(401); res.end('{"error":"fixture key refused"}'); return }
  if (mode === 'empty') return respond(res, checkpoint(body, ' \n'))
  if (mode === 'broken') return respond(res, '{"summary":"cut off')
  if (mode === 'plain') return respond(res, summary)
  if (mode === 'fenced') return respond(res, '```json\n' + JSON.stringify({ summary, memories: [] }) + '\n```')
  if (mode === 'length') return respond(res, checkpoint(body, summary), 'length')
  if (mode === 'expand') return respond(res, checkpoint(body, 'x'.repeat(8000)))
  return respond(res, checkpoint(body, summary))
})
const release = (text) => {
  const { res, body } = held.shift()
  respond(res, checkpoint(body, text))
}
const snapshot = (sessionId) => observer.call('harness/session/snapshot', { sessionId })
const prompt = (sessionId, text, via = client) => via.call('session/prompt', {
  sessionId, prompt: [{ type: 'text', text }],
})
async function until(label, check, timeoutMs = 15000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const value = await check()
    if (value) return value
    await sleep(timeoutMs > 15000 ? 500 : 100)
  }
  throw Error(`Timed out: ${label}`)
}
async function make(name) {
  console.log(`Checking ${name}`)
  const { sessionId } = await client.call('session/new', { name: `${tag}-${name}` })
  sessions.push(sessionId)
  await client.call('harness/session/configure', { sessionId, config: {
    url, model: 'fixture', key: '', headers: [], 'max-context': 100000,
    system: 'The fixture owner instructions.', tools: [],
  } })
  return sessionId
}
async function seed(sid) {
  for (const marker of ['OLD_SOURCE', 'RECENT_SOURCE']) {
    await prompt(sid, `${marker}: ${'Retain this source evidence. '.repeat(40)}`)
  }
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}/completions`
  await Promise.all([client.start(), observer.start()])
  savedModels = await client.call('harness/summary-models')
  const summaryConfig = { url, model: 'summary-fixture', key: '', headers: [], 'max-context': 100000, system: '', tools: [] }
  await client.call('harness/summary-models/configure', { models: { compaction: summaryConfig, lcm: summaryConfig } })

  const sid = await make('manual')
  await prompt(sid, '/compact')
  assert.equal(requests.length, 0, 'short history is refused without inference')
  assert.match((await snapshot(sid)).entries.at(-1).body, /No completed exchange or settled tool batch/)
  // Use a clean session so the refusal command is not an extra source exchange.
  const compactSid = await make('success')
  await seed(compactSid)
  const before = await snapshot(compactSid)
  mode = 'hold'
  const pending = prompt(compactSid, '/compact')
  pending.catch(() => {})
  await until('summary request held', () => held.length === 1)
  assert.equal((await snapshot(compactSid)).phase, 'compacting')
  const sent = requests.at(-1).body
  assert.ok(sent.messages.some((m) => m.content?.includes('OLD_SOURCE')))
  assert.ok(!sent.messages.some((m) => m.content?.includes('RECENT_SOURCE') || m.content === '/compact'))
  assert.ok(!sent.tools, 'summary request has no tool grant')
  assert.equal(sent.max_tokens, 4096)
  release(summary)
  assert.equal((await pending).stopReason, 'end_turn')
  const after = await snapshot(compactSid)
  assert.equal(after.phase, 'idle')
  assert.equal(after.compactions, 1)
  assert.deepEqual(after.compactionUsage, { prompt: 100, completion: 20 })
  assert.equal(after.usage.prompt, before.usage.prompt + 100)
  assert.deepEqual(after.entries.slice(0, before.entries.length), before.entries)
  assert.match(after.entries.at(-1).body, /Context compacted/)
  mode = 'ok'
  await prompt(compactSid, 'Continue after the checkpoint')
  const next = requests.at(-1).body.messages
  const checkpoint = next.find((m) => m.content?.includes(summary))
  assert.equal(checkpoint.role, 'user', 'historical text is not promoted to system authority')
  assert.ok(!next.some((m) => m.content?.includes('OLD_SOURCE')))
  assert.ok(next.some((m) => m.content?.includes('RECENT_SOURCE')))
  await prompt(compactSid, '/context')
  assert.match((await snapshot(compactSid)).entries.at(-1).body, /Compaction tokens: 100 input, 20 output/)

  // Summary failures preserve context, halt without retry, and permit recovery.
  for (const [failure, reason] of [
    ['empty', /no usable summary/], ['broken', /no usable summary/], ['length', /complete summary/],
    ['expand', /did not reduce/], ['auth', /fixture key refused/],
  ]) {
    const failedSid = await make(failure)
    await seed(failedSid)
    mode = failure
    const count = requests.length
    await assert.rejects(prompt(failedSid, '/compact'), reason)
    const failed = await snapshot(failedSid)
    assert.equal(failed.phase, 'error')
    assert.equal(failed.compactions, 0)
    assert.equal(requests.length, count + 1, 'no automatic failure retry')
    mode = 'ok'
    await prompt(failedSid, 'Recover with a new question')
    assert.ok(requests.at(-1).body.messages.some((m) => m.content?.includes('OLD_SOURCE')))
    assert.equal((await snapshot(failedSid)).phase, 'idle')
  }

  // The request asks for JSON but nothing enforces it, so other replies still compact.
  for (const reply of ['plain', 'fenced']) {
    const replySid = await make(reply)
    await seed(replySid)
    mode = reply
    await prompt(replySid, '/compact')
    const replied = await snapshot(replySid)
    assert.equal(replied.phase, 'idle')
    assert.equal(replied.compactions, 1)
    mode = 'ok'
    await prompt(replySid, 'Continue from the checkpoint')
    assert.ok(requests.at(-1).body.messages.some((m) => m.content?.includes(summary)))
  }

  // Cancellation settles the prompt promptly and fences the abandoned result.
  const cancelSid = await make('cancel')
  await seed(cancelSid)
  mode = 'hold'
  const cancelled = prompt(cancelSid, '/compact')
  cancelled.catch(() => {})
  await until('cancellable summary held', () => held.length === 1)
  const start = Date.now()
  await prompt(cancelSid, '/stop', observer)
  assert.equal((await cancelled).stopReason, 'cancelled')
  const cancelMs = Date.now() - start
  release('LATE_CHECKPOINT_MUST_NOT_APPEAR')
  await sleep(300)
  assert.equal((await snapshot(cancelSid)).compactions, 0)
  mode = 'ok'
  await prompt(cancelSid, 'Resume after cancellation')
  assert.ok(!requests.at(-1).body.messages.some((m) => m.content?.includes('LATE_CHECKPOINT')))

  // Native input may arrive during a summary. Keep it outside the frozen span
  // and after the command acknowledgement in model context, so it gets answered.
  const raceSid = await make('new-input')
  await seed(raceSid)
  mode = 'hold'
  const raced = prompt(raceSid, '/compact')
  raced.catch(() => {})
  await until('summary before concurrent input', () => held.length === 1)
  await observer.pokeAgent('harness', 'harness-action', { send: { sid: raceSid, text: 'NEW_DURING_SUMMARY' } })
  await until('concurrent input admitted', async () => (await snapshot(raceSid)).entries.some((e) => e.body === 'NEW_DURING_SUMMARY'))
  mode = 'ok'
  release(summary)
  await raced
  assert.equal(requests.at(-1).compact, false, 'new input receives inference, not just a command acknowledgement')
  assert.equal(requests.at(-1).body.messages.at(-1).content, 'NEW_DURING_SUMMARY')

  // Automatic compaction has the same budget/coverage policy and resumes the
  // original request, without inventing another user prompt or command reply.
  const autoSid = await make('automatic')
  measured = true // Report real sizes, so the budget anchors on them.
  await seed(autoSid)
  const autoConfig = await client.call('harness/session/config', { sessionId: autoSid })
  // Owner sessions carry the full tool catalog, which no checkpoint can shrink.
  // The input budget is 65% of a window this small. Set it just above the last
  // request, which the compacted one will fit, but below that request plus its
  // reply at one token per byte, so the next turn needs compaction.
  const autoBytes = JSON.stringify(requests.at(-1).body).length
  const autoWindow = Math.ceil((autoBytes / 4 + 200) / 0.65)
  await client.call('harness/session/configure', { sessionId: autoSid, config: { ...autoConfig, key: '', 'max-context': autoWindow } })
  const autoStart = requests.length
  await prompt(autoSid, 'Continue within the smaller window')
  measured = false
  assert.deepEqual(requests.slice(autoStart).map((r) => r.compact), [true, false])
  assert.equal((await snapshot(autoSid)).compactions, 1)

  // The same history fits a larger model and compacts for a smaller one. No
  // absolute working-context cap; note content survives the model change too.
  // Report each request's real size, as a provider would: the budget anchors on
  // it. The window also has to cover one token per byte for each new 105 KB
  // message, as reserved after a measured turn.
  const modelSid = await make('model-context')
  const largeConfig = await client.call('harness/session/config', { sessionId: modelSid })
  await client.call('harness/session/configure', { sessionId: modelSid, config: { ...largeConfig, key: '', 'max-context': 200000 } })
  measured = true
  await prompt(modelSid, 'Historical material. '.repeat(5000))
  await prompt(modelSid, 'Further source data. '.repeat(5000))
  await prompt(modelSid, 'Recent exchange')
  await prompt(modelSid, `/remember ${tag}-project Exact durable constraint.`)
  await prompt(modelSid, 'Continue within the larger model window')
  assert.ok(JSON.stringify(requests.at(-1).body).length / 4 > 48000, 'context exceeds the former fixed cap')
  assert.equal((await snapshot(modelSid)).compactions, 0, 'large model does not compact at a fixed 48k')
  const modelConfig = await client.call('harness/session/config', { sessionId: modelSid })
  await client.call('harness/session/configure', { sessionId: modelSid, config: {
    ...modelConfig, key: '', model: 'smaller-fixture', 'max-context': 60000,
  } })
  const modelStart = requests.length
  await prompt(modelSid, 'Continue with the durable constraint')
  assert.deepEqual(requests.slice(modelStart).map((r) => r.compact), [true, false])
  assert.equal(requests.at(-1).body.model, 'smaller-fixture')
  const compactedModel = await snapshot(modelSid)
  assert.ok(compactedModel.memory.some((note) => note.name === `${tag}-project` && note.body.startsWith('Exact durable constraint.')))
  assert.ok(requests.at(-1).body.messages.some((m) => m.role === 'user' && m.content?.includes(`${tag}-project: Exact durable constraint.`)))
  assert.ok(!requests.at(-2).body.messages.some((m) => m.content?.startsWith('Relevant shared memories')))
  measured = false

  // A provider switch while the summary is in flight affects the next turn,
  // not the decoder for the already-dispatched request.
  const switchSid = await make('switch')
  await seed(switchSid)
  mode = 'hold'
  const switched = prompt(switchSid, '/compact')
  switched.catch(() => {})
  await until('summary before provider change', () => held.length === 1)
  const switchConfig = await client.call('harness/session/config', { sessionId: switchSid })
  await client.call('harness/session/configure', { sessionId: switchSid, config: {
    ...switchConfig, key: '', model: 'next-model', url: 'https://chatgpt.com/backend-api/codex/responses',
  } })
  release(summary) // Still the Chat Completions response shape.
  await switched
  assert.equal((await snapshot(switchSid)).compactions, 1)
  assert.equal((await snapshot(switchSid)).model, 'next-model')

  // Hands use exactly the same command, not an adapter-specific summarizer.
  const handSid = await make('hand')
  await seed(handSid)
  bindings.push(handSid)
  await hand.bind(handSid, { address: 'fixture:conversation', sessionId: handSid, actors: ['alice'] })
  mode = 'hold'
  const input = await hand.observe(handSid, { event: 'compact', text: '/compact', actor: 'alice' })
  await until('hand summary held', () => held.length === 1)
  assert.ok(!(await hand.outbox()).some((p) => p.inputId === input.inputId), 'no premature success publication')
  release(summary)
  await until('hand checkpoint receipt', async () => (await hand.outbox()).some((p) => p.inputId === input.inputId && /Context compacted/.test(p.text)))
  await hand.observe(handSid, { event: 'context', text: '/context', actor: 'alice' })
  assert.ok((await hand.outbox()).some((p) => /Compaction tokens: 100 input, 20 output/.test(p.text)))

  // An irreducible request must fail locally, never hit the provider oversized.
  const largeSid = await make('irreducible')
  const cfg = await client.call('harness/session/config', { sessionId: largeSid })
  await client.call('harness/session/configure', { sessionId: largeSid, config: { ...cfg, key: '', 'max-context': 1000 } })
  const count = requests.length
  await assert.rejects(prompt(largeSid, 'Huge indivisible ask. '.repeat(1000)), /context budget/)
  assert.equal(requests.length, count)

  // Opt in for the actual three-minute Behn deadline. Native compaction avoids
  // the test RPC client's shorter prompt timeout; the ship still owns the job.
  let watchdogMs
  if (process.env.COMPACTION_WATCHDOG_TEST === '1') {
    const watchdogSid = await make('watchdog')
    mode = 'ok'
    await seed(watchdogSid)
    mode = 'hold'
    const start = Date.now()
    await observer.pokeAgent('harness', 'harness-action', { compact: { sid: watchdogSid } })
    await until('watchdog summary held', () => held.length === 1)
    const count = requests.length
    const timedOut = await until('hung summary terminates', async () => {
      const s = await snapshot(watchdogSid)
      return s.phase === 'error' && s
    }, 195000)
    watchdogMs = Date.now() - start
    assert.match(timedOut.error, /Compaction timed out/)
    assert.equal(timedOut.compactions, 0)
    assert.equal(requests.length, count, 'timeout does not retry')
    release('LATE_WATCHDOG_RESULT')
    await sleep(300)
    assert.equal((await snapshot(watchdogSid)).compactions, 0)
  }
  // With no summary model chosen, a conversation summarizes on its own route
  // and keeps its instructions and tools out of the request.
  await client.call('harness/summary-models/configure', { models: { compaction: null, lcm: null } })
  const ownSid = await make('own-route')
  const ownConfig = await client.call('harness/session/config', { sessionId: ownSid })
  await client.call('harness/session/configure', { sessionId: ownSid, config: {
    ...ownConfig, key: '', model: 'own-route-model', tools: ['web'], system: 'OWN_ROUTE_INSTRUCTIONS',
  } })
  mode = 'ok'
  await seed(ownSid)
  const beforeOwn = requests.length
  await prompt(ownSid, '/compact')
  assert.equal(requests.length, beforeOwn + 1)
  const ownRequest = requests.at(-1).body
  assert.equal(ownRequest.model, 'own-route-model')
  assert.ok(!ownRequest.tools, 'summary request has no tool grant')
  assert.ok(!JSON.stringify(ownRequest).includes('OWN_ROUTE_INSTRUCTIONS'), 'summary request omits the instructions')
  assert.equal((await snapshot(ownSid)).compactions, 1)

  // A chosen summary model with no credential stops and names that model.
  // This route is real, so only try it on a ship with no device credential.
  const status = await client.call('harness/status', { provider: 'openai' })
  if (!status['has-device-login']) {
    const chosenConfig = { ...summaryConfig, url: 'https://chatgpt.com/backend-api/codex/responses', model: 'chosen-summary-model' }
    await client.call('harness/summary-models/configure', { models: { compaction: chosenConfig, lcm: chosenConfig } })
    const chosenSid = await make('chosen-route')
    await seed(chosenSid)
    const beforeChosen = requests.length
    await assert.rejects(prompt(chosenSid, '/compact'), /summary model chosen-summary-model/)
    assert.equal(requests.length, beforeChosen, 'a missing credential makes no provider call')
    assert.equal((await snapshot(chosenSid)).compactions, 0)
  }
  console.log(JSON.stringify({ ok: true, cancelMs, watchdogMs, checks: [
    'bounded frozen source request', 'recent turn retained', 'transcript retained',
    'separate and cumulative summary usage', 'checkpoint authority', 'failure recovery',
    'plain and fenced summaries compact', 'no failure retry', 'cancellation and late result fencing', 'ACP and hand command parity',
    'concurrent input survives manual acknowledgement', 'automatic compaction resumes input',
    'model-relative compaction after a model switch', 'selected shared facts survive compaction verbatim',
    'provider switch keeps the dispatched codec',
    'irreducible request blocked before dispatch',
    'unset summary model uses the conversation route', 'chosen summary model names itself when uncredentialed',
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
  if (sessions[0]) await clean('forget fixture memory', () => prompt(sessions[0], `/forget ${tag}-project`))
  for (const id of bindings) await clean(`disable fixture binding ${id}`, () => hand.enable(id, false))
  // Hand-bound sessions retain their audit records; unbound fixtures are removed.
  for (const sessionId of sessions.filter((id) => !bindings.includes(id))) {
    await clean(`delete fixture session ${sessionId}`, () => client.call('session/delete', { sessionId }))
  }
  await Promise.all([clean('close client', () => client.close()), clean('close observer', () => observer.close())])
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, `Compaction fixture ${tag} cleanup is incomplete`)
  console.log('PASS summary settings restored; unbound fixtures removed and bound audit fixtures disabled')
}
