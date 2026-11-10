// Loopback-only credential conformance. Creates two uniquely named projects,
// one task and one short-lived key; finally revokes that key and archives only
// these projects. No Notes writes, model calls, publications or external sends.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { AcpClient } from '../acp/browser-client.mjs'
import { options, deadline } from './lib/reliability.mjs'

const config = options(process.env)
const realFetch = globalThis.fetch, savedDocument = globalThis.document
const host = await realFetch(`${config.base}/~/host`, { signal: AbortSignal.timeout(5000), redirect: 'error' })
assert.ok(host.ok, 'Local ship unavailable')
assert.equal((await host.text()).trim().replace(/^"|"$/g, '').replace(/^~/, ''), config.expectedShip.slice(1), 'Refusing another ship')
const fields = (await readFile(config.cookiePath, 'utf8')).split('\n').find((line) => line.split('\t')[5] === `urbauth-${config.expectedShip}`)?.split('\t')
assert.ok(fields?.[6], 'Expected ship cookie not found')
const cookie = `${fields[5]}=${fields[6]}`
const identity = await realFetch(`${config.base}/~/name`, { headers: { cookie }, signal: AbortSignal.timeout(5000), redirect: 'error' })
assert.ok(identity.ok, 'Owner authentication failed')
assert.equal((await identity.text()).trim().replace(/^"|"$/g, '').replace(/^~/, ''), config.expectedShip.slice(1))
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
globalThis.fetch = (path, init = {}) => {
  const url = new URL(path, config.base)
  assert.equal(url.origin, config.base)
  return realFetch(url, { ...init, headers: { ...init.headers, cookie }, redirect: 'error', ...(init.keepalive ? { signal: AbortSignal.timeout(5000) } : {}) })
}
const owner = new AcpClient()
const marker = `client-check-${randomUUID()}`
const project = `${marker}-project`, other = `${marker}-other`, task = `${marker}-task`, id = `${marker}-key`
const key = `hpr_${randomBytes(32).toString('hex')}`
const projects = [project, other], cleanup = []
let attemptedKey = false, attemptedTask = false, reads = 0
const work = (action, args = {}) => deadline(owner.call('harness/workspace', { action, args }), 30_000, action)
const read = async (body, status = 200, override = {}) => {
  // Intentionally uses the original fetch: no owner cookie accompanies a key.
  const response = await realFetch(`${config.base}/harness-project/read${override.suffix || ''}`, {
    method: override.method || 'POST', headers: override.headers || { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    ...(override.method === 'GET' ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    signal: AbortSignal.timeout(30_000), redirect: 'error',
  })
  reads++
  assert.equal(response.status, status, `Unexpected status on read ${reads}`)
  assert.equal(response.headers.get('cache-control'), 'no-store')
  assert.equal(response.headers.get('access-control-allow-origin'), null)
  const text = await response.text()
  assert.ok(!text.includes(key), 'Response must not echo the bearer key')
  return JSON.parse(text)
}
try {
  await deadline(owner.start(), 30_000, 'initialize owner')
  for (const selected of projects) await work('project-create', { id: selected, title: 'Synthetic client boundary check', description: 'Test-owned, archived after verification.' })
  attemptedTask = true
  await work('task-create', { id: task, project, title: 'Synthetic read-only task', description: 'No execution requested.' })
  // A new task's version starts from the workspace's write count, not from 1.
  const taskVersion = (await work('task', { id: task })).version
  const parameters = { id, project, version: 1, label: 'Synthetic client boundary check', days: 1, key }
  attemptedKey = true
  const issued = await work('client-create', parameters)
  assert.equal(issued.status, 'active')
  assert.equal(issued.access, 'read-only')
  assert.ok(!('key' in issued) && !('digest' in issued))
  assert.deepEqual(await work('client-create', parameters), issued, 'Explicit identical create preserves identity and expiry')
  const list = await work('clients', { project })
  assert.equal(list.items.length, 1)
  assert.ok(!JSON.stringify(list).includes(key))
  assert.equal((await read({ action: 'project', args: { id: project } })).id, project)
  assert.equal((await read({ action: 'project', args: { id: project } })).members, null)
  assert.equal((await read({ action: 'task', args: { id: task } })).title, 'Synthetic read-only task')
  assert.deepEqual((await read({ action: 'projects' })).items.map((row) => row.id), [project])
  await read({ action: 'project', args: { id: other } }, 404)
  await read({ action: 'help' }, 401, { headers: { cookie, 'content-type': 'application/json' } })
  await read({ action: 'help' }, 401, { headers: { authorization: `Bearer hpr_${'0'.repeat(64)}` } })
  for (const action of ['client-create', 'client-revoke', 'member', 'task-update', 'artifact-create', 'review', 'publish', 'sessions', 'harness_admin', 'tlon']) await read({ action, args: {} }, 403)
  await read('{invalid', 400)
  await read({ action: 'help', args: [] }, 400)
  await read('x'.repeat(8193), 413)
  await read({ action: 'help' }, 404, { suffix: '?key=never-in-a-url' })
  await read({}, 405, { method: 'GET' })
  assert.equal((await work('task', { id: task })).version, taskVersion)
  await work('project-edit', { id: project, version: 1, title: 'Synthetic client boundary check', description: 'Test-owned.', archived: true })
  await read({ action: 'help' }, 401)
  assert.equal((await work('clients', { project })).items[0].status, 'suspended')
  await work('project-edit', { id: project, version: 2, title: 'Synthetic client boundary check', description: 'Test-owned.', archived: false })
  await read({ action: 'help' })
  const revoked = await work('client-revoke', { id, project })
  assert.equal(revoked.status, 'revoked')
  assert.deepEqual(await work('client-revoke', { id, project }), revoked)
  await read({ action: 'help' }, 401)
  await assert.rejects(work('client-create', parameters), /identity already used/)
} finally {
  if (attemptedKey) {
    try { await work('client-revoke', { id, project }); cleanup.push({ key: id, status: 'revoked' }) }
    catch (error) { cleanup.push({ key: id, error: error.message }) }
  }
  if (attemptedTask) {
    try {
      const selected = await work('project', { id: project })
      const retained = await work('task', { id: task })
      if (retained.status !== 'done') {
        if (selected.archived) await work('project-edit', { id: project, version: selected.version, title: selected.title, description: selected.description, archived: false })
        await work('task-update', { id: task, version: retained.version, status: 'done', outcome: 'Synthetic verification ended; no execution was requested.' })
      }
      cleanup.push({ task, status: 'done' })
    } catch (error) { cleanup.push({ task, error: error.message }) }
  }
  for (const selected of projects) {
    try {
      const current = await work('project', { id: selected })
      if (!current.archived) await work('project-edit', { id: selected, version: current.version, title: current.title, description: current.description, archived: true })
      cleanup.push({ project: selected, status: 'archived' })
    } catch (error) { cleanup.push({ project: selected, error: error.message }) }
  }
  owner.close()
  globalThis.fetch = realFetch
  if (savedDocument === undefined) delete globalThis.document
  else globalThis.document = savedDocument
  console.log(JSON.stringify({ reads, cleanup }, null, 2))
}
assert.ok(cleanup.every((record) => !record.error), 'Fixture cleanup incomplete; inspect the named records')
console.log('PASS project-scoped bearer HTTP, owner-cookie separation, read-only actions, bounds, archive suspension, restore and permanent revocation')
