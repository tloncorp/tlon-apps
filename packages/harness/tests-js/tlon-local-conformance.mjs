// Native DM delivery without inspector exports, plus cancellation before a
// reminder's first run. Restores Harness settings; never changes another desk.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie } from './lib/ship-client.mjs'

const peerUrl = process.env.PEER_URL
assert.ok(peerUrl && process.env.PEER_COOKIE)
const fields = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${fields[5]}=${fields[6]}`, peer = fields[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), marker = `local-${randomUUID()}`
const client = new Client(), errors = []
let originals, job, firedJob, modelCalls = 0
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    modelCalls++
    const receipt = body.messages.slice(last + 1).find((m) => m.role === 'tool')
    if (receipt) job = JSON.parse(receipt.content)
    const message = receipt ? { role: 'assistant', content: `${marker}-accepted` } : {
      role: 'assistant', content: '', tool_calls: [{ id: marker, type: 'function', function: {
        name: 'reminder_add', arguments: JSON.stringify({ at: new Date(Date.now() + 86400000).toISOString().replace(/\.\d{3}Z$/, 'Z'), destination: `dm/${peer}`, text: `${marker}-must-never-fire` }),
      } }],
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: receipt ? 'stop' : 'tool_calls', message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
  } catch (error) { errors.push(error); res.writeHead(500); res.end('Fixture failed') }
})
async function until(label, read) {
  const deadline = Date.now() + 90000
  while (Date.now() < deadline) {
    if (errors.length) throw new AggregateError(errors)
    const value = await read(); if (value) return value
    await sleep(200)
  }
  throw new Error(`Timed out: ${label}`)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await client.call('harness/tlon')).policy }
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '', url: `http://127.0.0.1:${server.address().port}/completions`, model: 'local-only-fixture', tools: [], headers: [] } })
  const status = await client.call('harness/tlon/configure', { enabled: true, owner: peer, trusted: [], response: 'mentions', allowed: [], channels: [] })
  assert.equal(status.lens.enabled, false)
  await assert.rejects(client.call('harness/tlon/lens/retry'), /Enable Context Lens/)
  await client.call('harness/tlon/watch')
  const da = (((BigInt(Date.now()) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const sent = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([{
    id: 1, action: 'poke', ship: peer.slice(1), app: 'chat', mark: 'chat-dm-action-2', json: { ship, diff: { id: `${peer}/${da}`, delta: { add: { time: null, essay: {
      content: [{ inline: [`${marker}: schedule a reminder for tomorrow, then confirm.`] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null,
    } } } } },
  }]), signal: AbortSignal.timeout(15000) })
  assert.ok(sent.ok)
  const reply = await until('native reply at peer', async () => {
    const response = await fetch(`${peerUrl}/~/scry/chat/v4/dm/${ship}/writs/newest/32/light.json`, { headers: { cookie: peerCookie }, signal: AbortSignal.timeout(15000) })
    assert.ok(response.ok)
    return Object.values((await response.json()).writs || {}).find((row) => row.essay?.author === ship && JSON.stringify(row.essay.content).includes(`${marker}-accepted`))
  })
  assert.equal(reply.essay.blob, null)
  assert.ok(job?.id)
  const cancelled = (await client.call('harness/cron/cancel', { id: job.id })).find((row) => row.id === job.id)
  assert.equal(cancelled.state, 'cancelled'); assert.equal(cancelled.remaining, 1)
  assert.equal(cancelled.lastInput, null); assert.equal(cancelled.clearable, true)
  await until('cancelled authority removed', async () => (await client.call('harness/session/config', { sessionId: job.runSessionId })).tools.length === 0)
  const before = await client.call('harness/session/snapshot', { sessionId: job.runSessionId })
  assert.ok(!(await client.call('harness/cron/clear', { id: job.id })).some((row) => row.id === job.id))
  assert.deepEqual(await client.call('harness/session/snapshot', { sessionId: job.runSessionId }), before)
  const beforeCalls = modelCalls
  const requestId = `0v${BigInt(`0x${randomUUID().replaceAll('-', '')}`).toString(32).replace(/\B(?=(.{5})+$)/g, '.')}`
  firedJob = await client.call('harness/cron/add', { id: requestId, binding: job.sourceBinding, actor: peer, kind: 'reminder', args: {
    at: new Date(Date.now() + 8000).toISOString().replace(/\.\d{3}Z$/, 'Z'), destination: `dm/${peer}`, text: `${marker}-literal-shared-reminder`,
  } })
  assert.equal(firedJob.hand, 'tlon')
  await until('shared head reminder published through Tlon', async () => {
    const response = await fetch(`${peerUrl}/~/scry/chat/v4/dm/${ship}/writs/newest/32/light.json`, { headers: { cookie: peerCookie }, signal: AbortSignal.timeout(15000) })
    assert.ok(response.ok)
    return Object.values((await response.json()).writs || {}).find((row) => row.essay?.author === ship && JSON.stringify(row.essay.content).includes(`${marker}-literal-shared-reminder`))
  })
  const delivered = await until('head delivery receipt', async () => (await client.call('harness/cron')).find((row) => row.id === firedJob.id && row.delivery === 'delivered'))
  assert.equal(delivered.execution, 'completed'); assert.equal(delivered.clearable, true)
  assert.equal(modelCalls, beforeCalls, 'literal reminder performs no inference')
  await client.call('harness/cron/clear', { id: firedJob.id }); firedJob = null
  console.log('PASS native DM reply, cancelled unused reminder reclaimed, preserved conversation evidence, shared-head reminder delivered through Tlon without inference')
} finally {
  if (job?.id) await client.call('harness/cron/cancel', { id: job.id }).catch(() => {})
  if (firedJob?.id) await client.call('harness/cron/cancel', { id: firedJob.id }).catch(() => {})
  if (originals) {
    await client.call('harness/tlon/configure', originals.policy)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
