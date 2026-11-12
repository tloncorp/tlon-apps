// Loopback-only, owner-directed workflow through real head, Workspace, Notes,
// scheduler and hand receipts. The local model and delivery sink are synthetic:
// no Tlon adapter route, public page, remote provider or external send exists.
// Retain audit records; cancel schedules, disable bindings and archive fixtures.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const target = new URL(base), expectedShip = process.env.SOAK_EXPECT_SHIP
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(target.hostname), 'Requires a loopback test ship')
assert.ok(expectedShip?.startsWith('~'), 'Set SOAK_EXPECT_SHIP to the intended test ship')
for (const path of ['host', 'name']) {
  const response = await fetch(`${base}/~/${path}`, {
    headers: path === 'name' ? { cookie } : {}, redirect: 'error', signal: AbortSignal.timeout(5000),
  })
  assert.ok(response.ok, `Ship ${path} check failed`)
  assert.equal((await response.text()).trim().replace(/^"|"$/g, ''), expectedShip, `Unexpected ship ${path}`)
}

const marker = `flow-${randomUUID().slice(0, 12)}`
const project = `${marker}-project`, task = `${marker}-task`, artifact = `${marker}-artifact`
const source = `${marker}-request`, worker = `${marker}-worker`, address = `fixture-only:${marker}`
const owner = new Client(), hand = new HandClient(owner, { hand: marker, worker: `${marker}-delivery` })
const errors = [], cleanup = [], bindings = new Set(), schedules = new Set(), calls = []
const privateContext = `${marker}-PRIVATE_SOURCE_CONTEXT`
const approvedText = `Reviewed result for ${marker}: the meeting checklist has three items: agenda, attendees, and owner.`
let started = false, projectCreated = false, taskCreated = false, artifactCreated = false, completed = false
let steps = [], workerReceipts = [], proposalId, modelURL
const work = (action, args = {}) => owner.call('harness/workspace', { action, args })
const answer = (res, text, tools = []) => res.end(JSON.stringify({
  choices: [{ finish_reason: tools.length ? 'tool_calls' : 'stop', message: {
    role: 'assistant', content: text, ...(tools.length ? { tool_calls: tools } : {}),
  } }], usage: { prompt_tokens: 1, completion_tokens: 1 },
}))
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw); calls.push(body)
    res.writeHead(200, { 'content-type': 'application/json' })
    if (body.model === 'social-request-fixture') return answer(res, 'Request recorded. Artifact work requires owner acceptance and review.')
    assert.equal(body.model, 'social-worker-fixture')
    assert.ok(!JSON.stringify(body.messages).includes(privateContext), 'Worker receives no private source transcript')
    assert.ok(body.tools.some((entry) => entry.function.name === 'workspace'))
    const lastUser = body.messages.findLastIndex((message) => message.role === 'user')
    workerReceipts = body.messages.slice(lastUser + 1).filter((message) => message.role === 'tool')
    const step = steps[workerReceipts.length]
    if (!step) return answer(res, 'Proposal ready; owner review is required. No reply is scheduled.')
    answer(res, '', [{ id: `${marker}-step-${workerReceipts.length}`, type: 'function', function: {
      name: 'workspace', arguments: JSON.stringify({ action: step.action, args: step.args }),
    } }])
  } catch (error) {
    errors.push(error)
    if (!res.headersSent) res.writeHead(500)
    res.end('Synthetic workflow model failure')
  }
})
async function until(label, read) {
  const end = Date.now() + 30_000
  while (Date.now() < end) {
    if (errors.length) throw new AggregateError(errors)
    const result = await read(); if (result) return result
    await sleep(150)
  }
  throw new Error(`Timed out: ${label}`)
}
async function make(sessionId, model, tools) {
  await owner.call('session/new', { name: sessionId })
  await owner.call('harness/session/configure', { sessionId, config: {
    url: modelURL, model, key: '', headers: [], tools, 'max-context': 150_000,
    system: 'Synthetic local workflow conformance. Only the fixture model is used.',
  } })
}
async function scope(sessionId) {
  let offset = 0
  do {
    const page = await work('sessions', { offset, limit: 64 })
    const item = page.items.find((row) => row.sessionId === sessionId)
    if (item) return item.scope
    offset = page.nextOffset
  } while (offset != null)
  throw new Error(`No scope for ${sessionId}`)
}
async function inbox(kind, id, state) {
  let cursor = null
  do {
    const page = await owner.call('harness/inbox', { kind, state, limit: 32, cursor })
    const item = page.items.find((row) => row.id === id)
    if (item) return item
    cursor = page.cursor
  } while (cursor)
  assert.fail(`${kind} ${id} missing from ${state} inbox`)
}
console.log(`Fixture ${marker}; retained evidence uses this prefix.`)
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  modelURL = `http://127.0.0.1:${server.address().port}/completions`
  await owner.start(); started = true
  await make(source, 'social-request-fixture', [])
  await make(worker, 'social-worker-fixture', ['workspace'])
  await hand.bind(source, { address, sessionId: source, actors: ['requester'] }); bindings.add(source)
  const request = { event: `${marker}-message`, actor: 'requester', text: `Please prepare a meeting checklist. ${privateContext}` }
  await assert.rejects(hand.observe(source, { ...request, actor: 'outsider' }), /actor/i)
  const admitted = await hand.observe(source, request)
  assert.equal((await hand.observe(source, request)).inputId, admitted.inputId, 'Repeated source event admits once')
  const acknowledgement = await until('request acknowledgement', async () => (await hand.outbox()).find((row) => row.sessionId === source))
  assert.equal(acknowledgement.address, address)
  await hand.deliver(acknowledgement.effectId, async () => `${marker}-local-ack`)
  assert.equal((await owner.call('harness/session/snapshot', { sessionId: source })).entries.filter((row) => row.role === 'user').length, 1)
  assert.deepEqual(await hand.schedules(source), [], 'Admission alone schedules no work')

  // Acceptance is an explicit owner action, not an inference from a message.
  await work('project-create', { id: project, title: 'Synthetic reviewed workflow', description: 'Local-only end-to-end fixture.' }); projectCreated = true
  const workerScope = await scope(worker)
  await work('member', { id: project, version: 1, scope: workerScope, role: 'contributor' })
  const provenance = `Accepted request: binding ${source}; input ${admitted.inputId}; event ${request.event}; actor ${request.actor}.`
  const createdTask = await work('task-create', { id: task, project, title: 'Prepare a meeting checklist', description: provenance }); taskCreated = true
  assert.equal((await inbox('task', task, 'waiting')).status, 'open')
  const sources = [{ label: `Request input ${admitted.inputId}`, url: `${base}/~/scry/harness/hands/${source}.json` }]
  steps = [
    { action: 'task-claim', args: { id: task, version: createdTask.version } },
    { action: 'artifact-create', args: { id: artifact, project, title: 'Meeting checklist', body: approvedText, sources } },
    { action: 'review', args: { id: artifact, accept: true } },
    { action: 'publish', args: { id: artifact } },
    { action: 'task-update', args: { id: task, version: createdTask.version + 1, status: 'blocked', artifact, outcome: 'Awaiting owner review of the proposed checklist; no result reply is authorized.' } },
  ]
  await owner.call('session/prompt', { sessionId: worker, prompt: [{ type: 'text', text: `${provenance} Claim ${task}, propose the checklist in ${artifact}, and wait for owner review. No source transcript is supplied.` }] })
  if (errors.length) throw new AggregateError(errors)
  assert.equal(workerReceipts.length, steps.length)
  const claim = JSON.parse(workerReceipts[0].content), draft = JSON.parse(workerReceipts[1].content)
  artifactCreated = true; proposalId = draft.proposal.id
  assert.equal(claim.claimant.scope, workerScope)
  assert.equal(draft.artifact.head, 0)
  assert.equal(draft.proposal.status, 'pending')
  assert.equal(draft.proposal.by.scope, workerScope)
  assert.match(workerReceipts[2].content, /owner interface/)
  assert.match(workerReceipts[3].content, /owner interface/)
  assert.equal(JSON.parse(workerReceipts[4].content).status, 'blocked')
  assert.equal((await inbox('proposal', proposalId, 'approval')).artifact, artifact)
  assert.equal((await inbox('task', task, 'blocked')).claimant.scope, workerScope)
  assert.deepEqual(await hand.outbox(), [], 'Artifact work creates no social reply')
  assert.deepEqual(await hand.schedules(source), [], 'Pending proposal creates no schedule')
  console.log('PASS admitted request, explicit acceptance, isolated worker, attributed proposal and owner-only review/publication')

  await work('review', { id: proposalId, accept: true, reason: 'Owner checks this exact synthetic checklist for the requested reply.' })
  const accepted = await work('artifact', { id: artifact })
  assert.equal(accepted.artifact.head, 1)
  assert.equal(accepted.artifact.publication, null, 'Review does not publish a page')
  assert.equal(accepted.content.body, approvedText)
  assert.deepEqual(accepted.content.sources, sources)
  assert.equal((await inbox('proposal', proposalId, 'finished')).revision, 1)
  await work('task-update', { id: task, version: (await work('task', { id: task })).version, status: 'done', artifact,
    outcome: `Owner accepts proposal ${proposalId}, artifact ${artifact}@1. Reply delivery is tracked separately.` })
  assert.equal((await inbox('task', task, 'finished')).artifact, artifact)
  assert.deepEqual(await hand.outbox(), [], 'Task completion does not send a reply')

  // The owner selects accepted text. The scheduler does not infer review status
  // or grant a scheduled model access to the project. Delivery is literal.
  const scheduleId = `0v${BigInt(`0x${randomUUID().replaceAll('-', '')}`).toString(32).replace(/\B(?=(.{5})+$)/g, '.')}`
  const parameters = { id: scheduleId, actor: 'requester', kind: 'reminder',
    at: new Date(Date.now() + 7000).toISOString().replace(/\.\d{3}Z$/, 'Z'), destination: address, text: accepted.content.body }
  await assert.rejects(hand.schedule(source, { ...parameters, destination: 'fixture-only:wrong-thread' }), /a destination only if it names this conversation/)
  const job = await hand.schedule(source, parameters); schedules.add(job.id); bindings.add(job.runSessionId)
  assert.deepEqual(await hand.schedule(source, parameters), job, 'Explicit schedule identity deduplicates creation')
  await work('artifact-save', { id: artifact, base: 1, project, title: 'Meeting checklist',
    body: 'PRIVATE_LATER_EDIT_NOT_SELECTED_FOR_DELIVERY', sources })
  assert.equal((await work('artifact', { id: artifact })).artifact.head, 2)
  const beforeDelivery = calls.length
  const output = await until('reviewed literal reply', async () => (await hand.outbox()).find((row) => row.sessionId === job.runSessionId))
  assert.equal(output.text, approvedText)
  assert.equal(output.address, address)
  assert.equal(calls.length, beforeDelivery, 'Literal reply invokes no model')
  for (const secret of [privateContext, provenance, worker, sources[0].url]) assert.ok(!output.text.includes(secret))
  assert.deepEqual((await owner.call('harness/session/snapshot', { sessionId: job.runSessionId })).entries, [])
  const delivery = await hand.claim(output.effectId)
  assert.equal(delivery.acquired, true)
  const localSink = [{ externalId: `${marker}-local-result`, text: delivery.text }]
  await hand.receipt(output.effectId, 'uncertain')
  assert.equal((await inbox('input', output.effectId, 'uncertain')).delivery, 'uncertain')
  await assert.rejects(hand.retry(output.effectId), /uncertain/)
  await assert.rejects(hand.deliver(output.effectId, async (intent) => {
    localSink.push({ externalId: `${marker}-duplicate`, text: intent.text })
    return `${marker}-duplicate`
  }), /not available/)
  await assert.rejects(hand.clearSchedule(job.id), /pending or uncertain/)
  // Reconcile with the local sink, without invoking a second publication.
  await hand.receipt(output.effectId, 'delivered', localSink[0].externalId)
  assert.equal((await inbox('input', output.effectId, 'finished')).externalId, localSink[0].externalId)
  assert.equal(localSink.length, 1)
  assert.deepEqual(await hand.outbox(), [])
  assert.equal((await hand.schedules(source)).find((row) => row.id === job.id).delivery, 'delivered')
  completed = true
  console.log(JSON.stringify({ ok: true, request: admitted.inputId, task, worker, proposal: proposalId,
    artifact: `${artifact}@1`, schedule: job.id, reply: output.effectId,
    externalDelivery: 'synthetic local sink only', modelRequests: calls.length }, null, 2))
} finally {
  const clean = async (label, action) => {
    try { await action(); cleanup.push({ label, ok: true }) }
    catch (error) { cleanup.push({ label, error: error.message }) }
  }
  if (started) {
    for (const id of schedules) await clean(`schedule ${id}`, () => hand.cancelSchedule(id))
    for (const id of bindings) await clean(`binding ${id}`, () => hand.enable(id, false))
    if (taskCreated && !completed) await clean(`blocked task ${task}`, async () => {
      const current = await work('task', { id: task })
      await work('task-update', { id: task, version: current.version, status: 'blocked',
        outcome: 'Synthetic verification is incomplete; inspect retained fixture evidence.', artifact: current.artifact })
    })
    if (artifactCreated) await clean(`artifact ${artifact}`, async () => {
      const current = await work('artifact', { id: artifact })
      await work('artifact-archive', { id: artifact, base: current.artifact.head, archived: true })
    })
    if (projectCreated) await clean(`project ${project}`, async () => {
      const current = await work('project', { id: project })
      await work('project-edit', { id: project, version: current.version, title: current.title, description: current.description, archived: true })
    })
    await clean('ACP connection', () => owner.close())
  }
  server.closeAllConnections()
  if (server.listening) await new Promise((resolve) => server.close(resolve))
  console.log(JSON.stringify({ retainedFixture: marker, cleanup }, null, 2))
}
assert.ok(cleanup.every((row) => row.ok), 'Cleanup incomplete; inspect named fixture records')
console.log('PASS owner-directed request-to-reviewed-reply workflow; real social transport is not exercised')
