import assert from 'node:assert/strict'
import test from 'node:test'
import { EyreSubscription } from './eyre-subscription.mjs'

const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }
const event = (id, json) => `id: ${id}\ndata: ${JSON.stringify(json)}\n\n`
const diff = (messages = []) => ({ id: 1, response: 'diff', json: { messages } })

test.beforeEach((t) => {
  const previous = Object.getOwnPropertyDescriptor(navigator, 'locks')
  const held = new Set()
  Object.defineProperty(navigator, 'locks', { configurable: true, value: {
    async request(name, options, run) {
      assert.equal(options.ifAvailable, true)
      if (held.has(name)) return run(null)
      held.add(name)
      try { return await run({ name }) } finally { held.delete(name) }
    },
  } })
  t.after(() => { if (previous) Object.defineProperty(navigator, 'locks', previous); else delete navigator.locks })
})

test('streams reserve at most two origin-wide slots and release them on close', async (t) => {
  const streams = [], failures = [], requests = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, method: options.method })
    return options.method === 'PUT' ? new Response(null, { status: 204 })
      : new Response(new ReadableStream(), { headers: { 'content-type': 'text/event-stream' } })
  })
  const start = () => {
    const stream = new EyreSubscription({ ship: 'nec', onUpdate() {}, onDisconnect: (error) => failures.push(error.message) })
    streams.push(stream)
    return { stream, running: stream.run() }
  }
  const a = start(), b = start()
  await settle()
  const c = start(); await c.running
  assert.equal(requests.length, 4, 'a tab without a slot opens no HTTP connection')
  assert.deepEqual(failures, ['Using queue reads while event streams are busy'])
  a.stream.close(); await a.running
  const d = start(); await settle()
  assert.equal(d.stream.started, true)
  b.stream.close(); d.stream.close()
  await Promise.all([b.running, d.running])
})

test('background tabs release their stream without closing the durable connection', async (t) => {
  const previous = globalThis.document
  const document = new EventTarget(); document.hidden = false
  globalThis.document = document
  t.after(() => { globalThis.document = previous })
  const calls = [], failures = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    if (options.method === 'PUT') { calls.push(JSON.parse(options.body)); return new Response(null, { status: 204 }) }
    return new Response(new ReadableStream(), { headers: { 'content-type': 'text/event-stream' } })
  })
  const stream = new EyreSubscription({ ship: 'nec', onUpdate() {}, onDisconnect: (error) => failures.push(error.message) })
  const running = stream.run(); await settle()
  document.hidden = true; document.dispatchEvent(new Event('visibilitychange'))
  await running
  assert.deepEqual(failures, ['Event stream paused in a background tab'])
  assert.deepEqual(calls.at(-1), [{ action: 'delete' }])
})

test('stream parsing tolerates split frames/UTF-8 and discards event replay', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const actions = [], updates = [], failures = []
  let controller
  const body = new ReadableStream({ start(value) { controller = value } })
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    if (options.method === 'PUT') { actions.push(...JSON.parse(options.body)); return new Response(null, { status: 204 }) }
    return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
  })
  const stream = new EyreSubscription({ ship: 'nec', connection: 'test', onUpdate: (value) => updates.push(value), onDisconnect: (error) => failures.push(error) })
  const running = stream.run()
  const encoder = new TextEncoder()
  const message = { sequence: 1, payload: '{"id":1,"result":"hello 🪐"}' }
  const bytes = encoder.encode(':\n' + event(0, { id: 1, response: 'subscribe', ok: 'ok' }) + event(1, diff([message])) + event(1, diff([message])))
  for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7))
  for (let i = 0; i < bytes.length; i++) await Promise.resolve()
  assert.equal(stream.connected, true)
  assert.deepEqual(updates, [{ messages: [message] }])
  t.mock.timers.tick(250); await settle()
  assert.deepEqual(actions.filter((a) => a.action === 'ack'), [{ action: 'ack', 'event-id': 1 }])
  stream.close(); await running
  assert.equal(failures.length, 0)
  assert.equal(actions.at(-1).action, 'delete')
  assert.equal(actions[0].path, '/v1/test/client')
})

test('failed subscriptions fall back and delete only their disposable watch channel', async (t) => {
  const calls = [], failures = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    const actions = JSON.parse(options.body); calls.push({ path, actions })
    return new Response(null, { status: actions[0].action === 'subscribe' ? 503 : 204 })
  })
  const stream = new EyreSubscription({ ship: 'nec', connection: 'test', onUpdate: () => assert.fail(), onDisconnect: (error) => failures.push(error) })
  await stream.run()
  assert.equal(stream.connected, false)
  assert.equal(failures.length, 1)
  assert.deepEqual(calls.map((c) => c.actions[0].action), ['subscribe', 'delete'])
  assert.ok(calls.every((c) => c.path.includes('/harness-events-')))
})

test('cumulative Eyre ACKs are single-flight and a failed ACK restores fallback', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const acknowledgements = [], failures = []
  let resolve
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    const action = JSON.parse(options.body)[0]
    if (action.action !== 'ack') return new Response(null, { status: 204 })
    acknowledgements.push(action['event-id'])
    return new Promise((yes) => { resolve = yes })
  })
  const stream = new EyreSubscription({ ship: 'nec', connection: 'test', onUpdate() {}, onDisconnect: (error) => failures.push(error) })
  stream.receive(event(1, diff()).trimEnd()); t.mock.timers.tick(250)
  for (let id = 2; id <= 10; id++) stream.receive(event(id, diff()).trimEnd())
  t.mock.timers.tick(500); assert.deepEqual(acknowledgements, [1])
  resolve(new Response(null, { status: 204 })); await settle()
  t.mock.timers.tick(250); assert.deepEqual(acknowledgements, [1, 10])
  resolve(new Response(null, { status: 503 })); await settle()
  assert.equal(stream.connected, false)
  assert.equal(failures.length, 1)
})
