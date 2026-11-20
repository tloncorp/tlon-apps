// Real head/ACP/Iris with a local provider: cancelling a child must settle its
// parent's tool, without cancelling the parent or reviving it on a late reply.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from './lib/ship-client.mjs'

const client = new Client(), observer = new Client()
const held = [], requests = []
let sessionId, childId
const server = createServer(async (req, res) => {
  const body = await readText(req)
  const request = JSON.parse(body)
  requests.push(request)
  if (request.messages.some((m) => m.role === 'user' && m.content === 'CHILD_WORK')) {
    held.push(res); return
  }
  const resumed = request.messages.some((m) => m.role === 'tool')
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: resumed ? 'stop' : 'tool_calls', message: {
    role: 'assistant', content: resumed ? 'CHILD_CANCELLED_PARENT_FINISHED' : '',
    ...(!resumed ? { tool_calls: [{ id: 'child-work', type: 'function', function: {
      name: 'run_subagent', arguments: JSON.stringify({ prompt: 'CHILD_WORK' }),
    } }] } : {}),
  } }], usage: { prompt_tokens: 10, completion_tokens: 2 } }))
})
async function until(fn, label) {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    const value = await fn()
    if (value) return value
    await sleep(100)
  }
  throw new Error(`Timed out: ${label}`)
}
const snapshot = (id) => observer.call('harness/session/snapshot', { sessionId: id })
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await Promise.all([client.start(), observer.start()])
  ;({ sessionId } = await client.call('session/new', { name: `settlement-test-${randomUUID().slice(0, 8)}` }))
  await client.call('harness/session/configure', { sessionId, config: {
    url: `http://127.0.0.1:${server.address().port}/completions`, model: 'settlement-fixture',
    key: '', headers: [], system: 'Test fixture', 'max-context': 100_000, tools: ['subagents'],
  } })
  const pending = client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'Delegate work' }] })
  pending.catch(() => {})
  childId = await until(async () => {
    if (!held.length) return false
    const listed = await observer.call('session/list')
    return listed.sessions.find((s) => s.sessionId.startsWith(`${sessionId}--`))?.sessionId
  }, 'child inference in flight')
  assert.equal((await snapshot(sessionId)).phase, 'tools')
  await observer.call('session/cancel', { sessionId: childId })
  await until(async () => (await snapshot(sessionId)).entries.at(-1)?.body === 'CHILD_CANCELLED_PARENT_FINISHED', 'parent receives terminal child result')
  assert.equal((await pending).stopReason, 'end_turn')
  const finished = await snapshot(sessionId)
  assert.equal(finished.phase, 'idle')
  const results = finished.entries.filter((e) => e.role === 'tool')
  assert.equal(results.length, 1)
  assert.match(results[0].body, /^error: subagent cancelled:/)
  assert.equal((await snapshot(childId)).phase, 'idle')
  assert.equal(requests.length, 3, 'parent request, child request, parent continuation only')
  await observer.call('session/cancel', { sessionId: childId })
  assert.deepEqual(await snapshot(sessionId), finished, 'repeated cancellation cannot settle the parent twice')
  for (const res of held) res.end('LATE_CHILD_RESULT')
  await sleep(500)
  assert.deepEqual(await snapshot(sessionId), finished, 'late child reply cannot settle twice')
  console.log('PASS: child cancellation settles parent exactly once; parent finishes through ACP; late child reply fenced')
} finally {
  if (childId) await observer.call('session/delete', { sessionId: childId })
  if (sessionId) await observer.call('session/delete', { sessionId })
  await Promise.allSettled([client.close(), observer.close()])
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
