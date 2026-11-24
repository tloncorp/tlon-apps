// Loopback-only human command flow. No provider calls or social delivery.
// Fixtures retain task, confirmation, and hand audit records.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
assert.ok(process.env.SOAK_EXPECT_SHIP?.startsWith('~'))
const identity = await fetch(`${base}/~/name`, { headers: { cookie }, redirect: 'error' })
assert.ok(identity.ok)
assert.equal((await identity.text()).trim().replace(/^"|"$/g, ''), process.env.SOAK_EXPECT_SHIP)
const client = new Client(), tag = `work-${randomUUID().slice(0, 8)}`
console.log(`Work-control fixture: ${tag}`)
const hand = new HandClient(client, { hand: tag, worker: 'fixture' })
const sessions = [], bindings = [], results = [], cleanup = []
let providerCalls = 0, started = false, projectCreated = false, artifactCreated = false
let modelPrepare = false, modelRequest, modelChange
const server = createServer(async (req, res) => {
  providerCalls++
  if (!modelPrepare) { res.writeHead(500); res.end('Unexpected inference'); return }
  const raw = await readText(req)
  const body = JSON.parse(raw)
  const turn = body.messages.slice(body.messages.findLastIndex((item) => item.role === 'user'))
  const receipt = turn.findLast((item) => item.role === 'tool')
  if (receipt) modelRequest = JSON.parse(receipt.content)
  const message = receipt ? { role: 'assistant', content: modelPrepare === 'note' ? 'I noted the outstanding work.' : modelRequest.confirm }
    : { role: 'assistant', content: '', tool_calls: [{ id: 'prepare-work-fixture', type: 'function', function: {
      name: 'workspace', arguments: JSON.stringify({ action: modelPrepare === 'note' ? 'task-create' : 'manage', args: modelPrepare === 'note' ? modelChange : {
        action: 'project-edit', args: modelChange,
      } }),
    } }] }
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: receipt ? 'stop' : 'tool_calls', message }],
    usage: { prompt_tokens: 1, completion_tokens: 1 } }))
})
const work = (action, args = {}) => client.call('harness/workspace', { action, args })
const snapshot = (sessionId) => client.call('harness/session/snapshot', { sessionId })
async function until(label, read) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) { const value = await read(); if (value) return value; await sleep(120) }
  throw Error(`Timed out: ${label}`)
}
async function make(sid, tools = []) {
  await client.call('session/new', { name: sid }); sessions.push(sid)
  // Mid-turn growth estimates count the live tool catalog's ~26 kB of JSON as tokens;
  // a 32k window would compact on the ship's default route instead of this fixture.
  await client.call('harness/session/configure', { sessionId: sid, config: {
    url: `http://127.0.0.1:${server.address().port}/completions`, model: 'work-control-fixture',
    key: '', headers: [], tools, system: 'No inference is expected.', 'max-context': 100_000,
  } })
}
async function command(sid, text) {
  await client.call('session/prompt', { sessionId: sid, prompt: [{ type: 'text', text }] })
  const body = (await snapshot(sid)).entries.at(-1).body
  const details = body.match(/^Details: (\/work details r\d+)$/m)?.[1]
  if (!details) return body
  const record = JSON.parse(await command(sid, details))
  return JSON.stringify({ ...record, text: body })
}
async function handCommand(binding, actor, text) {
  const event = randomUUID()
  const observation = await hand.observe(binding, { event, actor, text })
  const body = (await until('hand command publication', async () => {
    const all = await hand.outbox()
    return all.find((row) => row.inputId === observation.inputId)
  })).text
  const details = body.match(/^Details: (\/work details r\d+)$/m)?.[1]
  if (!details) return body
  const record = JSON.parse(await handCommand(binding, actor, details))
  return JSON.stringify({ ...record, text: body })
}
const parse = (text) => {
  assert.ok(!text.startsWith('error:'), text)
  return JSON.parse(text)
}
async function confirmed(sid, action, args) {
  const request = parse(await command(sid, `/work ${action} ${JSON.stringify(args)}`))
  assert.equal(request.status, 'pending')
  const submitted = await command(sid, request.confirm)
  assert.ok(['running', 'done'].includes(parse(submitted).status), submitted)
  const result = await until('durable work completion', async () => {
    const receipt = parse(await command(sid, `/work result ${request.id}`))
    return receipt.status === 'running' ? null : receipt
  })
  assert.equal(result.status, 'done', JSON.stringify(result))
  return request
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start(); started = true
  const owner = `${tag}-owner`, social = `${tag}-social`, project = `${tag}-project`
  await make(owner, ['workspace']); await make(social, ['workspace'])
  const binding = `${tag}-binding`
  await hand.bind(binding, { address: `fixture-only:${tag}`, sessionId: social, actors: ['alice', 'mallory'] })
  bindings.push(binding)
  const denied = await handCommand(binding, 'alice', `/work hand-access ${JSON.stringify({ binding, actor: 'alice', owner: true })}`)
  assert.match(denied, /error:/)
  await confirmed(owner, 'hand-access', { binding, actor: 'alice', owner: true })
  const createdProject = await handCommand(binding, 'alice', `/work project-create ${JSON.stringify({ id: project, title: tag })}`)
  projectCreated = true
  assert.match(createdProject, new RegExp(tag))
  assert.doesNotMatch(createdProject, /confirm|request ID/i)
  const request = parse(await handCommand(binding, 'alice', `/work project-edit ${JSON.stringify({ id: project, version: 1, title: tag })}`))
  assert.match(await handCommand(binding, 'mallory', request.confirm), /error:/)
  assert.ok(['running', 'done'].includes(parse(await handCommand(binding, 'alice', request.confirm)).status))
  assert.equal((await work('project', { id: project })).title, tag)
  assert.equal(parse(await handCommand(binding, 'alice', `/work result ${request.id}`)).status, 'done')
  assert.match(await handCommand(binding, 'alice', request.confirm), /already settled or submitted/)
  results.push('generic hand owner grant, cross-actor denial, human-only prepare/confirm, durable result, duplicate fence')
  const task = `${tag}-task`
  const proposed = parse(await handCommand(binding, 'alice', `/work project-edit ${JSON.stringify({ id: project, version: 2, title: 'Prepared only' })}`))
  await confirmed(owner, 'hand-access', { binding, actor: 'alice', owner: false })
  assert.match(await handCommand(binding, 'alice', proposed.confirm), /error:/)
  assert.match(await handCommand(binding, 'alice', `/work result ${proposed.id}`), /error:/)
  assert.equal((await work('project', { id: project })).title, tag)
  results.push('owner revocation fences confirmation and stored-result access')
  const stale = parse(await command(owner, `/work project-edit ${JSON.stringify({ id: project, version: 2, title: 'Stale' })}`))
  const current = await work('project', { id: project })
  await work('project-edit', { id: project, version: current.version, title: 'Changed project' })
  assert.match(await command(owner, stale.confirm), /Work changed/)
  const note = await command(owner, `/work task-create ${JSON.stringify({ id: task, project, title: 'Check the forecast' })}`)
  assert.match(note, /Check the forecast/)
  assert.doesNotMatch(note, /confirm|Saving changes|request ID/i)
  assert.equal((await work('task', { id: task })).title, 'Check the forecast')
  assert.equal((await work('task', { id: task })).project, project)
  const assigned = await command(owner, `/work task-assign ${JSON.stringify({ id: task, version: (await work('task', { id: task })).version, assignee: social, scope: '0v0' })}`)
  assert.doesNotMatch(assigned, /error:|confirm/i)
  const assignment = await work('task', { id: task })
  assert.equal(assignment.claimant.label, social)
  assert.notEqual(assignment.claimant.scope, '0v0', 'The head resolves the actual agent; supplied scope cannot impersonate the owner')
  assert.deepEqual((await work('project', { id: project })).members, [], 'Assignment does not grant document membership')
  const completed = await command(owner, `/work task-update ${JSON.stringify({ id: task, version: assignment.version, status: 'done', outcome: 'Answered here.' })}`)
  assert.match(completed, /Answered here/)
  assert.equal((await work('task', { id: task })).artifact, null)
  results.push('protected workspace fence; direct task bookkeeping without confirmation, claim, artifact, or inference')
  assert.equal(providerCalls, 0)
  modelPrepare = 'note'
  modelChange = { id: `${tag}-agent-note`, project, title: 'Outstanding shared work' }
  const notedReply = await command(owner, 'Keep a shared note of the outstanding work.')
  modelPrepare = false
  assert.equal(notedReply, 'I noted the outstanding work.')
  assert.equal(modelRequest.id, `${tag}-agent-note`)
  assert.equal(modelRequest.status, 'open')
  assert.equal(modelRequest.confirm, undefined)
  assert.equal((await work('task', { id: `${tag}-agent-note` })).title, 'Outstanding shared work')
  assert.equal(providerCalls, 2)
  results.push('agent manages its own shared note and replies in the same conversation with no approval handoff')
  const artifact = `${tag}-artifact`
  await confirmed(owner, 'artifact-create', { id: artifact, project, title: 'Conversation review', body: 'Initial accepted content' })
  artifactCreated = true
  const proposal = await work('propose', { id: `${tag}-proposal`, artifact, base: 1,
    title: 'Conversation review', body: 'Exact human-reviewed replacement', reason: 'Synthetic review fixture' })
  const review = parse(await command(owner, `/work review ${JSON.stringify({ id: proposal.id, accept: true })}`))
  assert.match(review.text, /Exact human-reviewed replacement/)
  assert.equal((await work('artifact', { id: artifact })).content.body, 'Initial accepted content')
  assert.ok(['running', 'done'].includes(parse(await command(owner, review.confirm)).status))
  await until('native Notes review completion', async () => parse(await command(owner, `/work result ${review.id}`)).status === 'done')
  assert.equal((await work('artifact', { id: artifact })).content.body, 'Exact human-reviewed replacement')
  assert.equal((await work('artifact', { id: artifact })).artifact.publication, null)
  results.push('exact proposal preview and real asynchronous native Notes review without publication')
  const page = await work('preview', { id: artifact, revision: 2 })
  const publish = parse(await command(owner, `/work publish ${JSON.stringify({ id: artifact, revision: 2,
    head: 2, exposure: 0, confirm: `${artifact}@2`, previewToken: page.previewToken, paged: true, offset: 20 })}`))
  assert.match(publish.text, /Exact human-reviewed replacement/, 'Publication previews ignore caller truncation parameters')
  assert.match(await command(owner, publish.reject), /Request rejected/)
  assert.equal((await work('artifact', { id: artifact })).artifact.publication, null)
  results.push('full publication preview and rejection with no public page')
  modelPrepare = true
  modelChange = { id: project, version: (await work('project', { id: project })).version, title: 'Human confirmation required' }
  const modelReply = await command(owner, 'Prepare the synthetic project edit for my confirmation.')
  modelPrepare = false
  assert.equal(modelRequest.status, 'pending')
  assert.equal(modelReply, modelRequest.confirm, 'The synthetic model prints a confirmation command')
  assert.notEqual((await work('project', { id: project })).title, 'Human confirmation required')
  assert.match(await command(owner, modelRequest.confirm), /Review the change first/)
  assert.match(parse(await command(owner, modelRequest.inspect)).text, /Title: Human confirmation required/)
  assert.ok(['running', 'done'].includes(parse(await command(owner, modelRequest.confirm)).status))
  assert.equal((await work('project', { id: project })).title, 'Human confirmation required')
  assert.equal(providerCalls, 4)
  results.push('protected manage changes prepare only; model-authored confirmation text cannot execute')
  const taskNow = await work('task', { id: task })
  await work('task-update', { id: task, version: taskNow.version, status: 'done', artifact,
    outcome: 'Synthetic reviewed result; no social delivery.' })
  const replyArgs = { id: task, version: (await work('task', { id: task })).version,
    artifact, revision: 2, binding, actor: 'alice' }
  const disabled = parse(await command(owner, `/work task-reply ${JSON.stringify(replyArgs)}`))
  assert.match(disabled.text, /Exact human-reviewed replacement/)
  assert.ok(disabled.text.includes(`Conversation: fixture-only:${tag}`))
  await hand.enable(binding, false)
  assert.match(await command(owner, disabled.confirm), /Work changed/)
  await hand.enable(binding, true)
  await command(owner, disabled.reject)
  await confirmed(owner, 'hand-access', { binding, actor: 'alice', owner: true })
  const handReply = parse(await handCommand(binding, 'alice', `/work task-send ${task}`))
  assert.ok(handReply.text.includes(`Conversation: fixture-only:${tag}`))
  assert.ok(handReply.text.includes('Recipient: alice'))
  assert.ok(!handReply.text.includes('binding:'), 'Routing records are not normal conversation copy')
  const independent = await work('task', { id: `${tag}-agent-note` })
  await work('task-update', { id: independent.id, version: independent.version, outcome: 'Independent progress during another task’s approval.' })
  const queued = parse(await handCommand(binding, 'alice', handReply.confirm))
  assert.equal(queued.status, 'done')
  assert.equal(queued.delivery.status, 'pending', 'Queueing is not delivery')
  assert.equal(queued.delivery.text, 'Exact human-reviewed replacement')
  assert.match(await command(owner, `/work task-reply ${JSON.stringify({ ...replyArgs, ignored: true })}`), /already has a reply receipt/)
  assert.match(await command(owner, `/work task-reply ${JSON.stringify({ ...replyArgs, revision: '02' })}`), /already has a reply receipt/)
  await confirmed(owner, 'hand-access', { binding, actor: 'alice', owner: false })
  await assert.rejects(hand.claim(queued.delivery.effectId), /no longer has/)
  await hand.resolve(queued.delivery.effectId, { attempt: queued.delivery.attempt, status: 'abandoned',
    reason: 'Synthetic source revocation fixture. Nothing is sent.' })
  results.push('exact accepted reply preview, disabled destination fence, queue/delivery distinction, duplicate suppression, source revocation before claim')
  const failedRequest = await confirmed(owner, 'task-reply', replyArgs)
  const failed = parse(await command(owner, `/work result ${failedRequest.id}`)).delivery
  const nextIndependent = await work('task', { id: independent.id })
  await work('task-update', { id: nextIndependent.id, version: nextIndependent.version, status: 'done', outcome: 'Independent work finishes while a reply waits.' })
  await hand.claim(failed.effectId)
  await hand.receipt(failed.effectId, 'failed')
  const uncertainRequest = await confirmed(owner, 'task-reply', replyArgs)
  await assert.rejects(hand.retry(failed.effectId), /no longer has/)
  const uncertain = parse(await command(owner, `/work result ${uncertainRequest.id}`)).delivery
  const claimed = await hand.claim(uncertain.effectId)
  assert.equal(claimed.acquired, true)
  assert.equal((await hand.claim(uncertain.effectId)).acquired, false)
  await hand.receipt(uncertain.effectId, 'uncertain')
  assert.equal(parse(await command(owner, `/work result ${uncertainRequest.id}`)).delivery.status, 'uncertain')
  await assert.rejects(hand.retry(uncertain.effectId), /reconcile uncertain/)
  assert.match(await command(owner, `/work task-reply ${JSON.stringify(replyArgs)}`), /already has a reply receipt/)
  await hand.resolve(uncertain.effectId, { attempt: claimed.attempt, status: 'abandoned',
    reason: 'Synthetic uncertainty fixture. No external publisher runs.' })
  const deliveredRequest = await confirmed(owner, 'task-reply', replyArgs)
  const pendingDelivery = parse(await command(owner, `/work result ${deliveredRequest.id}`)).delivery
  await hand.claim(pendingDelivery.effectId)
  await hand.receipt(pendingDelivery.effectId, 'delivered', `synthetic-receipt:${tag}`)
  assert.equal(parse(await command(owner, `/work result ${deliveredRequest.id}`)).delivery.status, 'delivered')
  assert.match(await command(owner, deliveredRequest.confirm), /already settled or submitted/)
  assert.match(await command(owner, `/work task-reply ${JSON.stringify(replyArgs)}`), /already has a reply receipt/)
  assert.equal(providerCalls, 4, 'Reviewed replies never ask a model to send them')
  results.push('unrelated task changes preserve approval and queued delivery; exclusive claim, uncertain receipt without retry, explicit abandonment, actual delivery status, no duplicate delivered reply')
} finally {
  if (started) {
    for (const binding of bindings) {
      try { await hand.enable(binding, false); cleanup.push({ binding, disabled: true }) }
      catch (error) { cleanup.push({ binding, error: error.message }) }
    }
    if (projectCreated) {
      try {
        if (artifactCreated) {
          const id = `${tag}-artifact`, art = await work('artifact', { id })
          await work('artifact-archive', { id, base: art.artifact.head, archived: true })
          cleanup.push({ artifact: id, archived: true })
        }
        const id = `${tag}-project`, p = await work('project', { id })
        await work('project-edit', { id, version: p.version, title: p.title, description: p.description, archived: true })
        cleanup.push({ project: id, archived: true })
      } catch (error) { cleanup.push({ project: tag, error: error.message }) }
    }
    try { await client.close() }
    catch (error) { cleanup.push({ client: tag, error: error.message }) }
  }
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
  console.log(JSON.stringify({ fixture: tag, results, providerCalls, cleanup }, null, 2))
  assert.ok(cleanup.every((item) => !item.error), 'Fixture cleanup fails visibly')
}
