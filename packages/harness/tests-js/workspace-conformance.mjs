// Local-only feature conformance. Real Gall/ACP/tools/public HTTP; deterministic
// local model. No global configuration changes, remote providers, or deployment.
// Unique private fixture records remain as evidence; all pages are unpublished.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base } from './lib/ship-client.mjs'

assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Run this fixture only on a local test ship')
const marker = `work-${randomUUID().slice(0, 8)}`
console.log(`Fixture ${marker}; inspect this identity if interrupted.`)
const client = new Client(), workerClient = new Client()
const sessions = [], artifacts = new Set(), projects = new Set(), replies = new Map(), errors = [], held = new Map()
const content = { title: 'A page for friends', body: '# Welcome\n\n**Approved** public text. [A link](https://example.com).\n\n<script>UNSAFE_SCRIPT</script>\n\n![No request](https://example.com/tracker.png)', sources: [{ label: 'PRIVATE_SOURCE_LABEL', url: 'https://example.com/PRIVATE_SOURCE_URL' }] }
let modelURL
const response = (res, text, tools = []) => res.end(JSON.stringify({ choices: [{ finish_reason: tools.length ? 'tool_calls' : 'stop', message: { role: 'assistant', content: text, ...(tools.length ? { tool_calls: tools } : {}) } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
const tool = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw)
    const last = body.messages.findLastIndex((message) => message.role === 'user')
    const message = body.messages[last].content
    const command = JSON.parse(typeof message === 'string' ? message : message.map((part) => part.text || '').join(''))
    const receipts = body.messages.slice(last + 1).filter((message) => message.role === 'tool')
    if (command.hold && !receipts.length) await new Promise((resolve) => held.set(command.token, resolve))
    res.writeHead(200, { 'content-type': 'application/json' })
    if (receipts.length) { replies.set(command.token, receipts.at(-1).content); return response(res, `Fixture completed ${command.token}`) }
    if (command.mode === 'delegate') return response(res, '', [tool(command.token, 'run_subagent', { prompt: JSON.stringify(command.child) })])
    if (command.mode === 'admin') return response(res, '', [tool(command.token, 'harness_admin', { method: 'harness/workspace', params: JSON.stringify({ action: command.action, args: command.args }) })])
    assert.ok(body.tools.some((entry) => entry.function.name === 'workspace'), 'Workspace tool is advertised to the active authorized worker')
    response(res, '', [tool(command.token, 'workspace', { action: command.action, args: command.args })])
  } catch (error) { errors.push(error); if (!res.headersSent) res.writeHead(500); res.end('Synthetic model failure') }
})
const work = (action, args = {}) => client.call('harness/workspace', { action, args })
const prompt = (sessionId, command, via = client) => via.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: JSON.stringify(command) }] })
async function agent(sessionId, action, args = {}, extra = {}, via = client) {
  const token = randomUUID(), command = { token, mode: 'tool', action, args, ...extra }
  await prompt(sessionId, command, via)
  if (errors.length) throw new AggregateError(errors)
  const result = replies.get(token)
  assert.equal(typeof result, 'string', `Tool receipt for ${action}`)
  return result.startsWith('error:') ? result : JSON.parse(result)
}
async function make(label, tools = ['workspace', 'subagents']) {
  const { sessionId } = await client.call('session/new', { name: `${marker}-${label}` })
  sessions.push(sessionId)
  await client.call('harness/session/configure', { sessionId, config: { url: modelURL, model: 'local-workspace-fixture', key: '', headers: [], system: 'Synthetic workspace tool conformance. Only the local fixture endpoint is used.', 'max-context': 150_000, tools } })
  return sessionId
}
async function directory() {
  const result = []
  let offset = 0
  do { const page = await work('sessions', { offset, limit: 64 }); result.push(...page.items); offset = page.nextOffset } while (offset != null)
  return result
}
async function member(project, scope, role) {
  return work('member', { id: project, version: (await work('project', { id: project })).version, scope, role })
}
async function until(label, read) {
  const end = Date.now() + 20_000
  while (Date.now() < end) { if (errors.length) throw new AggregateError(errors); const value = await read(); if (value) return value; await sleep(100) }
  throw new Error(`Timed out: ${label}`)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  modelURL = `http://127.0.0.1:${server.address().port}/completions`
  await Promise.all([client.start(), workerClient.start()])
  const first = await make('researcher'), second = await make('writer'), outsider = await make('outsider'), admin = await make('admin', ['workspace', 'admin'])
  const names = await directory()
  const firstScope = names.find((item) => item.sessionId === first).scope, secondScope = names.find((item) => item.sessionId === second).scope
  const project = `${marker}-project`, doc = `${marker}-document`, privateDoc = `${marker}-private`, task = `${marker}-task`
  projects.add(project)
  await client.pokeAgent('harness', 'harness-workspace', { id: `${marker}-native`, action: 'project-create', args: { id: project, title: 'PRIVATE_PROJECT_TITLE', description: 'Shared fixture' } })
  await until('native workspace creation', async () => { try { return (await work('project', { id: project })).id === project } catch { return false } })
  await member(project, firstScope, 'contributor'); await member(project, secondScope, 'reader')
  await work('artifact-create', { id: doc, project, ...content }); artifacts.add(doc)
  assert.equal((await agent(first, 'artifact', { id: doc })).content.body, content.body)
  assert.equal((await agent(second, 'artifact', { id: doc })).content.title, content.title)
  assert.match(await agent(outsider, 'artifact', { id: doc }), /not found|not permitted/)
  assert.match(await agent(second, 'propose', { artifact: doc, base: 1, ...content }), /contributor access/)
  assert.match(await agent(first, 'publish', { id: doc, revision: 1, head: 1, slug: `${marker}-forged`, exposure: 0, confirm: `${doc}@1` }), /owner interface/)
  assert.match(await agent(first, 'member', { id: project, version: 3, scope: secondScope, role: 'contributor' }), /owner interface/)
  const adminToken = randomUUID()
  await prompt(admin, { token: adminToken, mode: 'admin', action: 'publish', args: { id: doc } })
  assert.match(replies.get(adminToken), /scoped workspace|owner|not.*allow|not.*support|Unknown/i)
  console.log('PASS owner/native API, membership and model authority separation')

  const draft = await agent(first, 'artifact-create', { id: privateDoc, ...content }); artifacts.add(privateDoc)
  assert.equal(draft.artifact.head, 0); assert.equal(draft.proposal.status, 'pending')
  assert.match(await agent(first, 'review', { id: privateDoc, accept: true }), /owner interface/)
  assert.match(await agent(second, 'artifact', { id: privateDoc }), /not found|not permitted/)
  await work('review', { id: privateDoc, accept: true })
  assert.equal((await agent(first, 'artifact', { id: privateDoc })).content.title, content.title)
  await assert.rejects(work('artifact-save', { id: privateDoc, base: 1, project, ...content }), /scope is fixed/)

  const proposal = await agent(first, 'propose', { artifact: doc, base: 1, ...content, body: 'A proposed revision', reason: 'Synthetic exact replacement' })
  await work('artifact-save', { id: doc, base: 1, project, ...content, body: 'A newer owner revision' })
  await assert.rejects(work('review', { id: proposal.id, accept: true }), /stale/)
  const liveProposal = await agent(first, 'propose', { artifact: doc, base: 2, ...content })
  await member(project, firstScope, null)
  await assert.rejects(work('review', { id: liveProposal.id, accept: true }), /no longer.*access/)
  assert.match(await agent(first, 'artifact', { id: doc }), /not found|not permitted/)
  await member(project, firstScope, 'contributor')
  await work('review', { id: liveProposal.id, accept: true })
  console.log('PASS private proposals, stale rejection and live review authority')

  const delegated = { token: randomUUID(), mode: 'tool', action: 'propose', args: { artifact: doc, base: 3, ...content, reason: 'Delegated worker proposal' } }
  await prompt(first, { token: randomUUID(), mode: 'delegate', child: delegated })
  if (errors.length) throw new AggregateError(errors)
  const childProposal = JSON.parse(replies.get(delegated.token))
  assert.equal(childProposal.status, 'pending')
  assert.notEqual(childProposal.by.scope, firstScope, 'Proposal retains actual worker identity, not parent attribution')
  const createdTask = await agent(second, 'task-create', { id: task, project, title: 'Shared task tracking', description: 'Synthetic coordination' })
  assert.equal(createdTask.id, task, 'Document membership does not gate shared task tracking')
  const [claimA, claimB] = await Promise.all([agent(first, 'task-claim', { id: task, version: createdTask.version }), agent(second, 'task-claim', { id: task, version: createdTask.version }, {}, workerClient)])
  assert.equal([claimA, claimB].filter((result) => typeof result !== 'string').length, 1, 'Exactly one worker wins the claim')
  const loser = typeof claimA === 'string' ? first : second
  const claimedTask = await work('task', { id: task })
  assert.equal((await agent(loser, 'task-update', { id: task, version: claimedTask.version, status: 'done' })).status, 'done', 'Agents can coordinate shared tracking without becoming the claimant')

  const token = randomUUID(), pending = prompt(first, { token, mode: 'tool', action: 'artifact', args: { id: doc }, hold: true })
  await until('held model dispatch', () => held.has(token))
  await member(project, firstScope, null)
  held.get(token)(); await pending
  assert.match(replies.get(token), /not found|not permitted/, 'Revocation before tool execution fences the private read')
  await member(project, firstScope, 'contributor')

  const preview = await work('preview', { id: doc, revision: 3 })
  console.log('PASS delegated attribution, atomic claims and in-flight revocation')
  assert.ok(!preview.html.includes('<script>'))
  assert.ok(preview.html.includes('&lt;script&gt;'))
  await assert.rejects(work('publish', { id: doc, revision: 3, head: 3, exposure: 0, previewToken: preview.previewToken, confirm: 'wrong' }), /Invalid/)
  const published = await work('publish', { id: doc, revision: 3, head: 3, exposure: 0, previewToken: preview.previewToken, confirm: `${doc}@3` })
  const publicURL = `${base}${published.artifact.publication.path}`
  assert.match(published.artifact.publication.path, /^\/notes\/pub\//)
  const unauthenticated = await fetch(publicURL)
  assert.equal(unauthenticated.status, 200)
  const html = await unauthenticated.text()
  assert.equal(html, preview.html)
  // Native Notes owns HTTP headers; Harness supplies restrictive document policy.
  assert.match(html, /Content-Security-Policy/)
  assert.match(html, /default-src &#39;none&#39;/)
  for (const secret of ['PRIVATE_SOURCE_LABEL', 'PRIVATE_SOURCE_URL', 'PRIVATE_PROJECT_TITLE', first, proposal.reason]) assert.ok(!html.includes(secret), `Public projection omits ${secret}`)
  await work('artifact-save', { id: doc, base: 3, project, ...content, body: 'PRIVATE_UNPUBLISHED_REVISION' })
  assert.equal(await (await fetch(publicURL)).text(), html)
  await work('unpublish', { id: doc, exposure: 1 })
  assert.notEqual(await (await fetch(publicURL)).text(), html, 'Notes removes the snapshot (its app fallback may still return 200)')

  const long = `${marker}-long`, longBody = 'é'.repeat(9_000)
  await work('artifact-create', { id: long, project, title: 'Paged Unicode', body: longBody, sources: [] }); artifacts.add(long)
  const firstPage = await agent(first, 'artifact', { id: long })
  assert.equal(Buffer.byteLength(firstPage.content.body), 8_000)
  assert.equal(firstPage.content.nextOffset, 8_000)
  const secondPage = await agent(first, 'revision', { id: long, revision: 1, offset: firstPage.content.nextOffset })
  assert.equal(Buffer.byteLength(secondPage.content.body), 8_000)
  assert.equal(secondPage.content.nextOffset, 16_000)
  const finalPage = await agent(first, 'revision', { id: long, revision: 1, offset: secondPage.content.nextOffset })
  assert.equal(finalPage.content.nextOffset, null)
  assert.equal(firstPage.content.body + secondPage.content.body + finalPage.content.body, longBody, 'Paged agent reads reconstruct the exact Unicode document')
  assert.match(await agent(first, 'revision', { id: long, revision: 1, offset: 1 }), /invalid read parameters/)

  // Rename preserves membership, while deleting/recreating does not.
  const renamed = `${marker}-renamed`
  await client.call('harness/session/rename', { sessionId: second, name: renamed }); sessions.push(renamed)
  assert.equal((await agent(renamed, 'artifact', { id: doc })).artifact.id, doc)
  await client.call('session/delete', { sessionId: renamed })
  await make('renamed')
  assert.match(await agent(renamed, 'artifact', { id: doc }), /not found|not permitted/)
  console.log(JSON.stringify({ ok: true, checks: ['owner/native workspace API', 'reader/contributor separation', 'private drafts', 'no model approval or publication', 'stale proposal rejection', 'live revocation', 'delegated worker attribution', 'atomic competing task claims', 'immutable project scope', 'exact native Notes public snapshot', 'unauthenticated GET', 'inert HTML and document policy', 'private metadata omission', 'native unpublish', 'Unicode pagination', 'rename and recreate identity'], retainedFixtures: { project, artifacts: [...artifacts], sessions } }, null, 2))
} finally {
  for (const release of held.values()) release()
  for (const id of artifacts) {
    try { const { artifact } = await work('artifact', { id }); if (artifact.publication) await work('unpublish', { id, exposure: artifact.exposure }); if (!artifact.archived) await work('artifact-archive', { id, base: artifact.head, archived: true }) }
    catch (error) { console.error(`Fixture cleanup ${id}: ${error.message}`) }
  }
  for (const id of projects) {
    try { const project = await work('project', { id }); await work('project-edit', { id, version: project.version, title: project.title, description: project.description, archived: true }) }
    catch (error) { console.error(`Fixture project cleanup ${id}: ${error.message}`) }
  }
  await Promise.all([client.close(), workerClient.close()])
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
