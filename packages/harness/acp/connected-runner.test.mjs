import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { createRunner, runnerEndpoint, validateEvent } from './connected-runner.mjs'

const key = `hrr_${'a'.repeat(64)}`
const agent = fileURLToPath(new URL('./fixtures/agent.mjs', import.meta.url))
const prompt = (attemptId, messages = [{ role: 'user', content: 'hello' }], extra = {}) => ({ version: 1, type: 'prompt', attemptId, conversationId: 'fixture', turnId: attemptId.replace(/[^0-9]/g, '') || '1', kind: 'turn', request: { model: '', messages, ...extra } })
const waitFor = async fn => { for (let i = 0; i < 400; i++) { if (await fn()) return; await delay(10) } assert.fail('Timed out waiting for fixture') }

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'harness-connected-'))
  const trace = join(root, 'trace.jsonl'), state = join(root, 'runner.json')
  let stream, sequence = 0, receipt, next = 0, gets = 0, drop = options.dropResponse
  const events = [], posts = [], requests = [], clients = [], jobs = new Set()
  const server = createServer(async (req, res) => {
    assert.equal(req.headers.authorization, `Bearer ${key}`)
    assert.equal(req.url, '/harness/runners/laptop/events')
    requests.push({ method: req.method, cursor: req.headers['last-event-id'] })
    if (req.method === 'GET') {
      gets++
      stream?.end(); stream = res
      res.writeHead(200, { 'content-type': 'text/event-stream' })
      res.write(': connected\n\n')
      for (const { id, event } of events) if (id > Number(req.headers['last-event-id'])) res.write(`id: ${id}\nevent: harness\ndata: ${JSON.stringify(event)}\n\n`)
      return
    }
    let text = ''; for await (const part of req) text += part
    const event = JSON.parse(text)
    posts.push(event)
    const same = event.sequence === sequence && JSON.stringify(event) === receipt
    if (!same && event.sequence !== sequence + 1) { res.writeHead(409); res.end('{}'); return }
    if (!same) { sequence = event.sequence; receipt = JSON.stringify(event) }
    let message = 'Acknowledged'
    if (['claim', 'complete', 'failed', 'delta'].includes(event.type) && !jobs.has(event.attemptId)) message = 'Inactive attempt; event discarded'
    if (['complete', 'failed'].includes(event.type)) jobs.delete(event.attemptId)
    if (drop === event.type) { drop = null; res.destroy(); return }
    res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ message }))
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const ship = `http://127.0.0.1:${server.address().port}`
  const config = { ship, runner: 'laptop', key, repo: root, state, command: [process.execPath, agent, trace], log: () => {}, reconnectMs: 5, heartbeatMs: 60_000, ...options }
  const start = async () => {
    const runner = await createRunner(config)
    const done = runner.run(); void done.catch(() => {})
    const client = { runner, done }; clients.push(client)
    return client
  }
  t.after(async () => {
    for (const { runner } of clients) await runner.close()
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
    await rm(root, { recursive: true, force: true })
  })
  const publish = event => {
    const id = ++next
    if (event.type === 'prompt') jobs.add(event.attemptId)
    else jobs.delete(event.attemptId)
    events.push({ id, event })
    stream?.write(`id: ${id}\nevent: harness\ndata: ${JSON.stringify(event)}\n\n`)
  }
  const frames = async () => { try { return (await readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse) } catch { return [] } }
  return { root, state, posts, requests, publish, start, frames, jobs, disconnect: () => stream?.destroy(), gets: () => gets }
}

test('runner endpoint is outbound HTTPS or loopback, without URL credentials', () => {
  assert.equal(runnerEndpoint('https://ship.example', 'laptop'), 'https://ship.example/harness/runners/laptop/events')
  for (const origin of ['http://ship.example', 'https://user:secret@ship.example', 'https://ship.example/?key=x', 'https://ship.example/path', 'file:///']) assert.throws(() => runnerEndpoint(origin, 'laptop'))
  assert.throws(() => runnerEndpoint('https://ship.example', '../owner'))
  assert.throws(() => validateEvent({ id: '1.5', event: 'harness', data: '{}' }))
})

test('SSE prompt, claimed execution, streamed reply and duplicate POST receipt', async t => {
  const f = await fixture(t, { dropResponse: 'complete' })
  const client = await f.start()
  f.publish(prompt('attempt-1'))
  await waitFor(() => f.posts.filter(event => event.type === 'complete').length === 2)
  const replies = f.posts.filter(event => event.type === 'complete')
  assert.deepEqual(replies[0], replies[1])
  assert.match(replies[0].response.choices[0].message.content, /hello/)
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
  assert.ok(f.posts.some(event => event.type === 'delta'))
  await client.runner.close()
})

test('SSE reconnect resumes the cursor without invoking the agent again', async t => {
  const f = await fixture(t)
  const client = await f.start()
  f.publish(prompt('attempt-1'))
  await waitFor(() => f.posts.some(event => event.type === 'complete'))
  f.disconnect()
  await waitFor(() => f.gets() > 1)
  assert.equal(f.requests.filter(event => event.method === 'GET').at(-1).cursor, '1')
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
  await client.runner.close()
})

test('Harness tool result continues the same local ACP prompt over SSE', async t => {
  const f = await fixture(t, { harnessTools: ['current_time'] })
  const tools = [{ type: 'function', function: { name: 'current_time', parameters: { type: 'object' } } }]
  const messages = [{ role: 'user', content: 'relay-once' }]
  await f.start()
  f.publish(prompt('attempt-1', messages, { tools }))
  await waitFor(() => f.posts.some(event => event.type === 'complete'))
  const first = f.posts.find(event => event.type === 'complete').response.choices[0].message
  assert.equal(first.tool_calls[0].function.name, 'current_time')
  f.publish(prompt('attempt-2', [...messages, first, { role: 'tool', tool_call_id: first.tool_calls[0].id, content: 'ship clock result' }], { tools }))
  await waitFor(() => f.posts.filter(event => event.type === 'complete').length === 2)
  assert.match(f.posts.filter(event => event.type === 'complete')[1].response.choices[0].message.content, /ship clock result/)
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
})

test('cancellation interrupts an active attempt and a stale completion cannot restart it', async t => {
  const f = await fixture(t)
  await f.start()
  const event = prompt('attempt-1', [{ role: 'user', content: 'hang' }])
  f.publish(event)
  await waitFor(async () => (await f.frames()).some(frame => frame.method === 'session/prompt'))
  f.publish({ ...event, type: 'cancel', request: null })
  await waitFor(() => f.posts.some(event => event.type === 'failed'))
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
})

test('restart reports uncertain work without executing it again', async t => {
  const f = await fixture(t)
  const first = await f.start()
  f.publish(prompt('attempt-1', [{ role: 'user', content: 'hang' }]))
  await waitFor(async () => (await f.frames()).some(frame => frame.method === 'session/prompt'))
  await first.runner.close()
  await f.start()
  await waitFor(() => f.posts.some(event => event.type === 'failed'))
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
})

test('cancellation also stops a settled provider exchange waiting on a Harness tool', async t => {
  const f = await fixture(t, { harnessTools: ['current_time'] })
  await f.start()
  const event = prompt('attempt-1', [{ role: 'user', content: 'relay-once' }], { tools: [{ type: 'function', function: { name: 'current_time', parameters: { type: 'object' } } }] })
  f.publish(event)
  await waitFor(() => f.posts.some(event => event.type === 'complete'))
  f.publish({ ...event, type: 'cancel', request: null })
  await waitFor(async () => (await f.frames()).some(frame => frame.method === 'session/cancel'))
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
})

test('work cancelled before connecting is acknowledged without any local execution', async t => {
  const f = await fixture(t)
  const event = prompt('attempt-1')
  f.publish(event); f.publish({ ...event, type: 'cancel', request: null })
  await f.start()
  await waitFor(() => f.posts.some(event => event.type === 'ack' && event.through === 2))
  assert.deepEqual(await f.frames(), [])
})
