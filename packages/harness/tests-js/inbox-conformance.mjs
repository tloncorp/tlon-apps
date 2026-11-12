// Read-only smoke test of the installed owner inbox. Uses only a selected
// loopback ship; no fixtures, model calls, task changes, Notes writes or sends.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { AcpClient } from '../acp/browser-client.mjs'
import { options, deadline } from './lib/reliability.mjs'

const config = options(process.env)
const realFetch = globalThis.fetch, savedDocument = globalThis.document
const host = await realFetch(`${config.base}/~/host`, { signal: AbortSignal.timeout(5000), redirect: 'error' })
assert.ok(host.ok, 'Local ship host is unavailable')
const hostName = (await host.text()).trim().replace(/^"|"$/g, '')
assert.equal(hostName.replace(/^~/, ''), config.expectedShip.slice(1), 'Refusing a different local ship')
const cookieRows = (await readFile(config.cookiePath, 'utf8')).split('\n')
const fields = cookieRows.find((line) => line.split('\t')[5] === `urbauth-${config.expectedShip}`)?.split('\t')
assert.ok(fields?.[6], 'Expected ship authentication cookie not found')
const cookie = `${fields[5]}=${fields[6]}`
const identity = await realFetch(`${config.base}/~/name`, { headers: { cookie }, signal: AbortSignal.timeout(5000), redirect: 'error' })
assert.ok(identity.ok, 'Local ship authentication failed')
assert.equal((await identity.text()).trim().replace(/^"|"$/g, '').replace(/^~/, ''), config.expectedShip.slice(1), 'Authenticated ship mismatch')
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
globalThis.fetch = (path, init = {}) => {
  const url = new URL(path, config.base)
  assert.equal(url.origin, config.base)
  return realFetch(url, { ...init, headers: { ...init.headers, cookie }, redirect: 'error', ...(init.keepalive ? { signal: AbortSignal.timeout(5000) } : {}) })
}
const client = new AcpClient()
const states = ['uncertain', 'blocked', 'approval', 'running', 'waiting', 'finished']
const kinds = ['task', 'proposal', 'input', 'schedule', 'notes']
const timings = []
try {
  await deadline(client.start(), 30_000, 'initialize inbox reader')
  const call = async (params) => {
    const start = performance.now()
    const result = await deadline(client.call('harness/inbox', params), 30_000, 'owner inbox read')
    timings.push(performance.now() - start)
    assert.ok(Array.isArray(result.items))
    assert.ok(result.items.length <= params.limit)
    assert.equal(result.referenceOnly, true)
    assert.ok(Number.isSafeInteger(result.observedAt))
    for (const row of result.items) {
      assert.ok(states.includes(row.state))
      assert.ok(kinds.includes(row.kind))
      assert.equal(typeof row.id, 'string')
      if (params.kind !== 'all') assert.equal(row.kind, params.kind)
      if (params.state === 'attention') assert.ok(states.slice(0, 3).includes(row.state))
      else if (params.state !== 'all') assert.equal(row.state, params.state)
      assert.ok(!('body' in row) && !('content' in row) && !('entries' in row), 'Inbox must not include documents or transcripts')
    }
    for (const [state, count] of Object.entries(result.counts)) {
      assert.ok(states.includes(state))
      assert.ok(Number.isSafeInteger(count) && count >= 0)
    }
    return result
  }
  const first = await call({ state: 'all', kind: 'all', limit: 1 })
  if (first.cursor) {
    await assert.rejects(deadline(client.call('harness/inbox', { state: 'attention', kind: 'all', limit: 1, cursor: first.cursor }), 30_000, 'cross-filter cursor rejection'), /Work changed|page is no longer valid/)
  }
  for (const state of ['attention', ...states]) await call({ state, kind: 'all', limit: 24 })
  for (const kind of kinds) await call({ state: 'all', kind, limit: 24 })
  await assert.rejects(deadline(client.call('harness/inbox', { limit: 33 }), 30_000, 'page bound rejection'), /1–32|Invalid inbox/)
  await assert.rejects(deadline(client.call('harness/inbox', { state: 'invented-state' }), 30_000, 'invalid state rejection'), /valid inbox|Invalid inbox/)
  console.log(JSON.stringify({ verdict: 'pass', readOnly: true, reads: timings.length, maxReadMs: Math.round(Math.max(...timings)), countsAtFirstRead: first.counts,
    limits: 'Existing retained data only; empty sources do not prove positive source coverage. RPC time is not Arvo event CPU.' }, null, 2))
} finally {
  client.close()
  globalThis.fetch = realFetch
  if (savedDocument === undefined) delete globalThis.document
  else globalThis.document = savedDocument
}
