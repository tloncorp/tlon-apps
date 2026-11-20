// Deterministic live race test: real ACP/head/Iris, local provider + slow tool.
// No provider credentials, external writes, or modifications to user sessions.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'

const client = new Client(), observer = new Client()
const toolName = process.env.TOOL_NAME || 'http_fetch'
assert.ok(['http_fetch', 'curl'].includes(toolName))
const requests = [], toolRequests = [], held = []
let sessionId, url
const server = createServer(async (req, res) => {
  if (req.url === '/slow') {
    toolRequests.push(req.url); held.push(res)
    return // Remains in flight until cancellation or the test releases it.
  }
  if (req.url === '/fast') {
    toolRequests.push(req.url); res.end('ALREADY_DONE'); return
  }
  const body = await readText(req)
  requests.push(JSON.parse(body))
  const first = requests.length === 1
  const reuse = requests.length === 3
  res.writeHead(200, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ choices: [{ finish_reason: first || reuse ? 'tool_calls' : 'stop', message: {
    role: 'assistant', content: first || reuse ? '' : 'CONTINUED_OK',
    ...(first || reuse ? { tool_calls: (first ? ['fast', 'slow'] : ['slow']).map((name) => ({ id: `cancel-test-${name}`, type: 'function',
      function: { name: toolName, arguments: JSON.stringify({ url: `${url}/${name}`,
        ...(toolName === 'curl' ? { method: 'PATCH', headers: { 'X-Fixture': 'cancel' }, body: 'mutation' } : {}),
      }) } })) } : {}),
  } }], usage: { prompt_tokens: 10, completion_tokens: 2 } }))
})
const snapshot = () => observer.call('harness/session/snapshot', { sessionId })
const prompt = (text) => client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text }] })
async function until(fn, label) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    const result = await fn()
    if (result) return result
    await sleep(100)
  }
  throw new Error(`Timed out: ${label}`)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
  await Promise.all([client.start(), observer.start()])
  ;({ sessionId } = await client.call('session/new', { name: `cancel-test-${randomUUID().slice(0, 8)}` }))
  await client.call('harness/session/configure', { sessionId, config: {
    url: `${url}/completions`, model: 'cancellation-fixture', key: '', headers: [],
    system: 'Test fixture', 'max-context': 100_000, tools: [toolName === 'curl' ? 'curl' : 'web'],
  } })
  const admissionStart = Date.now(), clientMessageId = randomUUID()
  const pending = client.call('session/prompt', { sessionId, clientMessageId, prompt: [{ type: 'text', text: 'Start both tools' }] })
  pending.catch(() => {})
  await until(() => client.updates.some((frame) => frame.params?.update?.sessionUpdate === 'harness_prompt_admitted'
    && frame.params.update.clientMessageId === clientMessageId), 'durable input acknowledgement')
  const admissionMs = Date.now() - admissionStart
  await until(async () => {
    const state = await snapshot()
    return held.length && state.phase === 'tools' && state.entries.some((e) => e.body?.includes('ALREADY_DONE'))
  }, 'one finished and one in-flight tool')
  await observer.pokeAgent('harness', 'harness-action', { compact: { sid: sessionId } })
  assert.equal((await snapshot()).phase, 'tools', 'native compaction cannot race outstanding tools')
  assert.equal(requests.length, 1, 'no summarizer was dispatched during tool work')
  const start = Date.now()
  await observer.call('session/cancel', { sessionId })
  assert.equal((await pending).stopReason, 'cancelled')
  const cancelMs = Date.now() - start
  const stopped = await snapshot()
  assert.equal(stopped.phase, 'idle')
  const cancelled = stopped.entries.filter((e) => e.cancelled)
  assert.equal(cancelled.length, 1)
  assert.equal(cancelled[0].callId, 'cancel-test-slow')
  assert.match(cancelled[0].body, /Execution may already have occurred/)
  assert.ok(client.updates.some((frame) => frame.params?.update?.toolCallId === 'cancel-test-slow'
    && frame.params.update.status === 'failed'), 'ACP receives a terminal tool update')
  const resumed = await prompt('A different question; do not repeat the tools')
  assert.equal(resumed.stopReason, 'end_turn')
  assert.equal(requests.length, 2, 'exactly one new inference request')
  assert.deepEqual(toolRequests.sort(), ['/fast', '/slow'], 'neither tool was dispatched again')
  const messages = requests[1].messages
  const at = messages.findIndex((m) => m.tool_calls?.length)
  assert.deepEqual(messages.slice(at + 1, at + 4).map((m) => m.role), ['tool', 'tool', 'user'], 'provider exchange is closed before new input')
  assert.match(messages[at + 1].content, /ALREADY_DONE/)
  assert.match(messages[at + 2].content, /^cancelled:/)
  const finished = await snapshot()
  assert.equal(finished.phase, 'idle')
  assert.equal(finished.entries.at(-1).body, 'CONTINUED_OK')
  const repeated = prompt('Reuse the previous tool-call ID in a new request')
  repeated.catch(() => {})
  await until(async () => held.length === 2 && (await snapshot()).phase === 'tools', 'new generation reuses the old call ID')
  const waiting = await snapshot()
  held[0].end('LATE_RESULT_MUST_NOT_APPEAR')
  await sleep(500)
  assert.deepEqual(await snapshot(), waiting, 'old receipt cannot complete the new request with the same call ID')
  held[1].end('NEW_GENERATION_RESULT')
  assert.equal((await repeated).stopReason, 'end_turn')
  const final = await snapshot()
  assert.ok(final.entries.some((e) => e.body?.includes('NEW_GENERATION_RESULT')))
  assert.ok(!JSON.stringify(final).includes('LATE_RESULT_MUST_NOT_APPEAR'))
  assert.equal(requests.length, 4)
  const native = await fetch(`${base}/~/scry/harness/snapshot/${sessionId}.json`, { headers: { cookie } }).then((r) => r.json())
  assert.deepEqual(native.entries, final.entries)
  console.log(JSON.stringify({ ok: true, toolName, admissionMs, cancelMs, timing: 'Client observed, including transport and 100ms polling', checks: ['in-flight HTTP cancellation', 'completed sibling retained',
    'terminal ACP tool update', 'immediate next prompt', 'no duplicate execution', 'valid provider transcript',
    'late result fenced', 'native/ACP parity'] }, null, 2))
} finally {
  if (sessionId) await client.call('session/delete', { sessionId })
  await Promise.allSettled([client.close(), observer.close()])
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
