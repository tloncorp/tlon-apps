// Shared scheduler through a non-Tlon hand and the native/ACP boundary.
// Uses only a local deterministic model. Leaves uniquely named conversation
// and delivery evidence, cancels fixture schedules, never edits global policy.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const marker = `shared-cron-${randomUUID()}`
const client = new Client()
const hand = new HandClient(client, { hand: `fixture-chat-${marker}`, worker: marker })
const errors = [], schedules = new Set(), bindings = [], calls = []
let source, modelJob, runCalls = 0
const id = () => `0v${BigInt(`0x${randomUUID().replaceAll('-', '')}`).toString(32).replace(/\B(?=(.{5})+$)/g, '.')}`
const future = (ms) => new Date(Date.now() + ms).toISOString().replace(/\.\d{3}Z$/, 'Z')
const answer = (res, text, tools = []) => res.end(JSON.stringify({ choices: [{ finish_reason: tools.length ? 'tool_calls' : 'stop', message: {
  role: 'assistant', content: text, ...(tools.length ? { tool_calls: tools } : {}),
} }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
const tool = (name, args) => ({ id: `${marker}-${name}-${randomUUID()}`, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw); calls.push(body)
    res.writeHead(200, { 'content-type': 'application/json' })
    const receipts = body.messages.slice(body.messages.findLastIndex((message) => message.role === 'user') + 1).filter((message) => message.role === 'tool')
    if (body.messages.some((message) => message.role === 'user' && message.content === `${marker}-run`)) {
      runCalls++
      assert.ok(!JSON.stringify(body.messages).includes('PRIVATE_SCHEDULING_CONTEXT'))
      assert.ok(!body.tools.some((entry) => ['cron_add', 'reminder_add', 'run_subagent', 'harness_admin'].includes(entry.function.name)))
      if (!receipts.length) return answer(res, '', [tool('cron_add', { schedule: '* * * * *', timezone: 'UTC', prompt: 'Recursive work must be rejected', runs: '2' })])
      assert.match(receipts.at(-1).content, /not granted/)
      return answer(res, `${marker}-run-finished`)
    }
    assert.ok(body.tools.some((entry) => entry.function.name === 'cron_add'), 'any active hand receives shared scheduling tools')
    if (!receipts.length) return answer(res, '', [
      tool('schedule_once', { schedule: '* * * * *', timezone: 'UTC', prompt: 'Must not recur', runs: '2' }),
      tool('cron_add', { at: future(86_400_000), prompt: 'Wrong scheduling tool' }),
    ])
    if (receipts.length === 2) {
      assert.ok(receipts.some(receipt => /schedule_once requires at and prompt/.test(receipt.content)))
      assert.ok(receipts.some(receipt => /cron_add requires a recurring schedule/.test(receipt.content)))
      return answer(res, '', [tool('cron_add', { schedule: '* * * * *', timezone: 'UTC', prompt: `${marker}-run`, runs: '2' })])
    }
    modelJob = JSON.parse(receipts.at(-1).content)
    assert.equal(modelJob.hand, hand.hand)
    schedules.add(modelJob.id)
    answer(res, `${marker}-created`)
  } catch (error) { errors.push(error); if (!res.headersSent) res.writeHead(500); res.end('Fixture failure') }
})
async function until(label, read, timeout = 95_000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (errors.length) throw new AggregateError(errors)
    const value = await read(); if (value) return value
    await sleep(200)
  }
  throw new Error(`Timed out: ${label}`)
}
async function add(options) {
  const request = { id: id(), actor: 'alice', kind: 'reminder', at: future(86_400_000), destination: 'room/scheduler-test', text: 'literal fixture', ...options }
  const job = await hand.schedule(source, request)
  schedules.add(job.id); bindings.push(job.runSessionId)
  return { job, request }
}
async function native(action) {
  await client.pokeAgent('harness', 'harness-cron', { id: `${marker}-native`, action })
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  const { sessionId } = await client.call('session/new', { name: marker }); source = sessionId
  const config = await client.call('harness/session/config', { sessionId })
  await client.call('harness/session/configure', { sessionId, config: { ...config, key: '', url: `http://127.0.0.1:${server.address().port}/completions`, model: 'shared-scheduler-fixture', system: 'Synthetic scheduler test.', headers: [], tools: [] } })
  await hand.bind(source, { sessionId, address: 'room/scheduler-test', actors: ['alice'] }); bindings.push(source)
  await hand.observe(source, { event: `${marker}-create`, actor: 'alice', text: 'Schedule the requested bounded task. PRIVATE_SCHEDULING_CONTEXT' })
  await until('model creates schedule through non-Tlon hand', () => modelJob)
  assert.equal(modelJob.sourceBinding, source); assert.equal(modelJob.state, 'active')
  assert.equal((await hand.schedules(source)).length, 1, 'Malformed one-time and recurring requests create no jobs')
  bindings.push(modelJob.runSessionId)
  const sourceOutput = await until('source reply', async () => (await hand.outbox()).find((effect) => effect.sessionId === source))
  await hand.deliver(sourceOutput.effectId, async () => 'fixture-source-delivered')

  const upcoming = await add({ text: 'Cancelled before firing' })
  assert.deepEqual(await hand.schedule(source, upcoming.request), upcoming.job, 'idempotent create')
  await assert.rejects(hand.schedule(source, { ...upcoming.request, text: 'Conflicting payload' }), /different request/)
  await assert.rejects(hand.schedule(source, { ...upcoming.request, id: id(), destination: 'wrong-room' }), /a destination only if it names this conversation/)
  await assert.rejects(hand.schedule(source, { ...upcoming.request, id: id(), actor: 'mallory' }), /authorized actor/)
  await native({ cancel: { id: upcoming.job.id } })
  const cancelled = await until('native cancel visible in shared ACP list', async () => (await hand.schedules(source)).find((job) => job.id === upcoming.job.id && job.state === 'cancelled'))
  assert.equal(cancelled.clearable, true)
  await hand.clearSchedule(cancelled.id); schedules.delete(cancelled.id)

  const literal = await add({ at: future(5_000), text: '/cancel is literal, not a command' })
  const before = calls.length
  const literalOutput = await until('literal reminder delivery intent', async () => (await hand.outbox()).find((effect) => effect.sessionId === literal.job.runSessionId))
  assert.equal(literalOutput.text, '/cancel is literal, not a command')
  assert.equal(literalOutput.address, 'room/scheduler-test')
  assert.equal(calls.filter((call) => JSON.stringify(call).includes('/cancel is literal')).length, 0, 'reminder never invokes the model')
  assert.ok(calls.length >= before)
  await hand.deliver(literalOutput.effectId, async () => 'fixture-literal-delivered')
  await hand.clearSchedule(literal.job.id); schedules.delete(literal.job.id)

  const output = await until('bounded scheduled model run', async () => (await hand.outbox()).find((effect) => effect.sessionId === modelJob.runSessionId))
  assert.match(output.text, /run-finished/)
  assert.equal(output.address, 'room/scheduler-test'); assert.equal(output.hand, hand.hand)
  await hand.claim(output.effectId); await hand.receipt(output.effectId, 'uncertain')
  await assert.rejects(hand.clearSchedule(modelJob.id), /pending or uncertain/)
  const active = (await hand.schedules(source)).find((job) => job.id === modelJob.id)
  assert.equal(active.remaining, 1); assert.equal(active.delivery, 'uncertain')
  await hand.enable(source, false)
  const paused = (await hand.schedules(source)).find((job) => job.id === modelJob.id)
  assert.equal(paused.state, 'paused', 'source binding revocation pauses future runs')
  assert.deepEqual((await client.call('harness/session/config', { sessionId: modelJob.runSessionId })).tools, [])
  await hand.enable(source, true)
  assert.equal((await hand.schedules(source)).find((job) => job.id === modelJob.id).state, 'paused', 're-enabling does not silently resurrect work')
  await hand.receipt(output.effectId, 'delivered', 'fixture-reconciled')
  await hand.cancelSchedule(modelJob.id)
  await hand.clearSchedule(modelJob.id); schedules.delete(modelJob.id)
  assert.ok(runCalls >= 2, 'scheduled task completed its rejected-recursion tool turn')
  console.log(JSON.stringify({ ok: true, checks: ['non-Tlon model scheduling', 'native/ACP parity', 'idempotent creation', 'actor and destination validation', 'literal no-inference reminder', 'bounded isolated inference', 'no recursive schedules', 'exclusive hand delivery', 'uncertainty blocks clear', 'source revocation', 'no automatic resurrection'], retainedFixture: source }, null, 2))
} finally {
  for (const job of schedules) await hand.cancelSchedule(job).catch((error) => console.error(`Fixture schedule ${job}: ${error.message}`))
  for (const binding of bindings) await hand.enable(binding, false).catch(() => {})
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
