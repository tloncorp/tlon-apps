import assert from 'node:assert/strict'
import test from 'node:test'

import { AcpClient, webConnection } from './browser-client.mjs'
import { EyreSubscription } from './eyre-subscription.mjs'

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no }); return { promise, resolve, reject } }
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

test('watch recovery keeps pending mutations and ignores the retired watch without replay', async (t) => {
  t.mock.method(EyreSubscription.prototype, 'run', async () => {})
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 204 }))
  const client = new AcpClient()
  client.host = 'nec'; client.running = true
  const sends = []
  client.poke = async (value) => sends.push(value)
  client.startStreaming()
  const old = client.subscription, connection = client.connection
  const reply = client.call('session/prompt')
  old.fail(new Error('lost stream'))
  assert.equal(client.pending.size, 1)
  assert.equal(client.connection, connection)
  client.startStreaming(); assert.equal(client.subscription, null, 'retries back off')
  client.streamRetryAt = 0; client.startStreaming()
  const message = { sequence: 1, payload: '{"id":1,"result":"done"}' }
  old.onUpdate({ messages: [message] })
  assert.equal(client.pending.size, 1)
  client.subscription.onUpdate({ messages: [message] })
  assert.equal(await reply, 'done')
  assert.equal(sends.filter((value) => value.send).length, 1)
  client.close()
})

test('failed initialization retires its subscription', async () => {
  const client = new AcpClient()
  let closed = false
  client.poke = async () => {}
  client.poll = async () => { client.subscription = { close: () => { closed = true } } }
  client.call = async () => { throw new Error('initialization failed') }
  await assert.rejects(client.start(), /initialization failed/)
  assert.equal(closed, true)
  assert.equal(client.subscription, null)
})

test('stream/scry races never acknowledge past an unseen frame', () => {
  const client = new AcpClient()
  const delivered = []
  client.receive = (frame) => delivered.push(frame.result)
  const first = { sequence: 1, payload: '{"id":1,"result":"first"}' }
  const second = { sequence: 2, payload: '{"id":2,"result":"second"}' }
  assert.equal(client.receiveBatch([second]), 0)
  assert.equal(client.pollRequested, true)
  assert.equal(client.receiveBatch([first, second]), 2)
  assert.equal(client.receiveBatch([first]), 2)
  assert.deepEqual(delivered, ['first', 'second'])
})

test('a token burst is acknowledged cumulatively without a poke per frame', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const client = new AcpClient()
  client.running = true
  const acks = []
  client.poke = async (value) => acks.push(value.ack.through)
  for (let i = 1; i <= 100; i++) { client.receivedThrough = i; client.queueAcknowledgement() }
  assert.deepEqual(acks, [])
  t.mock.timers.tick(250); await settle()
  assert.deepEqual(acks, [100])
  client.receivedThrough = 101; client.queueAcknowledgement()
  client.close(); t.mock.timers.tick(250); await settle()
  assert.deepEqual(acks, [100], 'closing cancels the pending acknowledgement timer')
})

test('healthy push delivery suppresses per-call polling while stalled streams retain a safety check', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const client = new AcpClient()
  client.subscription = { connected: true }
  client.poke = async () => {}
  const result = client.call('session/list')
  await settle(); assert.equal(client.pollRequested, false)
  t.mock.timers.tick(999); assert.equal(client.pollRequested, false)
  t.mock.timers.tick(1); assert.equal(client.pollRequested, true)
  client.receive({ id: 1, result: {} }); await result
})

test('a ready RPC reply is returned while its HTTP send remains pending', async () => {
  const client = new AcpClient()
  const send = deferred()
  client.poke = () => send.promise
  const result = client.call('session/list')
  client.receive({ id: 1, result: { sessions: [] } })
  let resolved = false
  result.then(() => { resolved = true })
  await settle()
  assert.equal(resolved, true)
  // An authoritative reply wins even if the HTTP request subsequently fails.
  send.reject(new Error('late HTTP failure'))
  assert.deepEqual(await result, { sessions: [] })
  await settle()
})

test('slow ACKs do not hold queue reads or the next ready response', async (t) => {
  const savedDocument = globalThis.document
  globalThis.document = { hidden: false }
  t.after(() => { globalThis.document = savedDocument })
  const client = new AcpClient()
  const ack = deferred()
  let polls = 0, received = false
  client.poke = (value) => value.ack ? ack.promise : Promise.resolve()
  client.pending.set(2, { resolve: () => { received = true } })
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ messages: [
    { sequence: ++polls, payload: JSON.stringify({ id: polls, result: {} }) },
  ] }) }))
  client.waitForPoll = async () => { if (polls === 2) client.running = false }
  client.running = true
  const polling = client.poll()
  await settle()
  assert.equal(polls, 2)
  assert.equal(received, true)
  ack.resolve()
  await polling
})

test('ACKs coalesce to the highest delivered cursor and fence recovery', async () => {
  const client = new AcpClient()
  const sends = []
  client.running = true
  client.poke = (value) => {
    if (value.open) return Promise.resolve()
    const pending = deferred(); sends.push({ ...pending, through: value.ack.through, connection: value.ack.connection }); return pending.promise
  }
  client.receivedThrough = 1; client.acknowledge()
  client.receivedThrough = 4; client.acknowledge()
  client.receivedThrough = 9; client.acknowledge()
  assert.deepEqual(sends.map((s) => s.through), [1])
  sends[0].resolve(); await settle()
  assert.deepEqual(sends.map((s) => s.through), [1, 9])
  await client.recover()
  client.receivedThrough = 2; client.acknowledge()
  assert.notEqual(sends[1].connection, sends[2].connection, 'old ACKs cannot delete frames in the replacement queue')
  sends[1].resolve(); await settle()
  assert.equal(client.acknowledgedThrough, 0)
  assert.notEqual(client.ackFlight, null)
  sends[2].resolve(); await settle()
  assert.equal(client.acknowledgedThrough, 2)
  client.close()
})

test('each browser instance gets a fresh valid ACP connection', () => {
  const first = webConnection()
  const second = webConnection()
  assert.notEqual(first, second)
  assert.match(first, /^harness-web-[a-z0-9-]+$/)
  assert.ok(first.length <= 128)
})

test('re-delivery after a lost acknowledgement does not duplicate updates', () => {
  const client = new AcpClient()
  const seen = []
  client.receive = (frame) => seen.push(frame)
  const first = { sequence: 1, payload: '{"method":"session/update","params":{"text":"one"}}' }
  const second = { sequence: 2, payload: '{"method":"session/update","params":{"text":"two"}}' }
  assert.equal(client.receiveBatch([first]), 1)
  assert.equal(client.receiveBatch([first, second]), 2)
  assert.equal(client.receiveBatch([first, second]), 2)
  assert.deepEqual(seen.map((frame) => frame.params.text), ['one', 'two'])
})

test('queue recovery never repeats a possibly admitted mutation', async () => {
  const client = new AcpClient()
  client.receivedThrough = 12
  client.acknowledgedThrough = 12
  const sent = []
  let rejected = false
  client.poke = async (value) => sent.push(value)
  client.pending.set(1, { frame: { method: 'session/prompt' }, reject: () => { rejected = true } })
  await client.recover()
  assert.ok(rejected)
  assert.equal(client.pending.size, 0)
  assert.equal(sent.length, 1)
  assert.ok(sent[0].open)
  assert.equal(client.receivedThrough, 0)
  assert.equal(client.acknowledgedThrough, 0)
})

test('empty polls do not repeat ACKs, while failed ACKs retry without redelivery', async (t) => {
  const savedDocument = globalThis.document
  globalThis.document = { hidden: false }
  t.after(() => { globalThis.document = savedDocument })
  const client = new AcpClient()
  const acknowledgements = [], delivered = []
  let polls = 0
  client.receive = (frame) => delivered.push(frame)
  client.poke = async (value) => {
    acknowledgements.push(value.ack.through)
    if (acknowledgements.length === 1) throw new Error('lost ACK')
  }
  client.dispatchEvent = () => true
  t.mock.method(globalThis, 'fetch', async () => {
    polls++
    return Response.json({ messages: polls <= 2 ? [{ sequence: 1, payload: '{"method":"update"}' }] : [] })
  })
  client.waitForPoll = async () => { if (polls === 4) client.running = false }
  client.running = true
  await client.poll()
  assert.equal(polls, 4)
  assert.deepEqual(acknowledgements, [1, 1])
  assert.equal(delivered.length, 1)
  assert.equal(client.acknowledgedThrough, 1)
})

test('outbound calls wake an idle poll and closure releases a sleeping poll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const client = new AcpClient()
  client.poke = async () => {}
  const sleeping = client.waitForPoll(1500)
  const reply = client.call('session/list')
  await sleeping
  client.receive({ id: 1, result: [] })
  assert.deepEqual(await reply, [])
  client.wakePoll() // A send during an in-flight read skips the next sleep.
  await client.waitForPoll(1500)
  const closing = client.waitForPoll(1500)
  client.close()
  await closing
})

test('ACP targets the current server, ignoring other localhost cookies and globals', async (t) => {
  const savedWindow = globalThis.window, savedDocument = globalThis.document
  globalThis.window = { ship: 'lux' }
  globalThis.document = { get cookie() { throw new Error('Cookie guessing must not be used') } }
  t.after(() => { globalThis.window = savedWindow; globalThis.document = savedDocument })
  const requests = []
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    requests.push({ path, options })
    return new Response(path.startsWith('/~/channel/') ? '' : '~fasbud-nomtud-sitful-hatred')
  })
  const client = new AcpClient()
  await Promise.all([client.poke({ open: { connection: 'a' } }), client.poke({ open: { connection: 'b' } })])
  assert.equal(requests.filter((r) => r.path === '/~/host').length, 1)
  assert.equal(requests.filter((r) => r.path === '/~/name').length, 1)
  for (const request of requests.filter((r) => r.path.startsWith('/~/channel/'))) {
    assert.equal(JSON.parse(request.options.body)[0].ship, 'fasbud-nomtud-sitful-hatred')
  }
})

test('invalid, unavailable or unauthenticated identity never emits an ACP poke', async (t) => {
  for (const mode of ['invalid', 'unavailable', 'signed-out']) {
    const requests = []
    const mocked = t.mock.method(globalThis, 'fetch', async (path) => {
      requests.push(path)
      if (mode === 'unavailable') return new Response('', { status: 503 })
      return new Response(mode === 'invalid' ? '<html>login</html>' : path === '/~/host' ? '~nec' : '~zod')
    })
    const client = new AcpClient()
    assert.throws(() => client.ship(), /not been identified/)
    await assert.rejects(client.poke({ open: { connection: 'a' } }), /identity|identify|Sign in/)
    assert.deepEqual(requests.sort(), ['/~/host', '/~/name'])
    assert.equal(client.identity, null)
    mocked.mock.restore()
  }
})

test('identity lookup can recover after failure without inventing a destination', async (t) => {
  let available = false
  t.mock.method(globalThis, 'fetch', async () => new Response(available ? '~nec' : '', { status: available ? 200 : 503 }))
  const client = new AcpClient()
  await assert.rejects(client.identify())
  available = true
  assert.equal(await client.identify(), 'nec')
  assert.equal(client.ship(), 'nec')
})

test('slow RPC replies have no elapsed-time deadline, including prompts', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const client = new AcpClient()
  const sent = []
  client.poke = async (value) => sent.push(value)
  const methods = ['initialize', 'session/list', 'session/prompt']
  const replies = methods.map((method) => client.call(method))
  await Promise.resolve()
  t.mock.timers.tick(31 * 60_000)
  assert.equal(client.pending.size, 3)
  assert.equal(sent.length, 3, 'a slow request is never resent')
  for (const [index, method] of methods.entries()) client.receive({ id: index + 1, result: method })
  assert.deepEqual(await Promise.all(replies), methods)
  assert.equal(client.pending.size, 0)
})

test('identity and HTTP pokes wait past the old 15 second timeout', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const waiting = []
  t.mock.method(globalThis, 'fetch', (path, options) => new Promise((resolve, reject) => {
    waiting.push({ path, options, resolve })
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
  }))
  const client = new AcpClient()
  const pending = client.poke({ open: { connection: client.connection } })
  assert.equal(waiting.length, 2)
  t.mock.timers.tick(45_000)
  for (const request of waiting) {
    assert.equal(request.options.signal.aborted, false)
    request.resolve(new Response('~nec'))
  }
  await client.identity
  // Allow the poke continuation after the shared identity promise to run.
  for (let i = 0; i < 5 && waiting.length < 3; i++) await Promise.resolve()
  assert.equal(waiting.length, 3)
  t.mock.timers.tick(45_000)
  assert.equal(waiting[2].options.signal.aborted, false)
  waiting[2].resolve(new Response(''))
  await pending
})

test('closing aborts a slow queue read without reporting a transport error', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let signal
  t.mock.method(globalThis, 'fetch', (path, options) => {
    if (path.startsWith('/~/channel/')) return Promise.resolve(new Response(''))
    signal = options.signal
    return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  })
  const client = new AcpClient()
  client.host = 'nec'
  client.running = true
  const polling = client.poll()
  t.mock.timers.tick(45_000)
  assert.equal(signal.aborted, false)
  client.close()
  await polling
  assert.equal(signal.aborted, true)
  assert.equal(client.lastError, null)
})

test('closing settles pending calls even before startup completes', async () => {
  const client = new AcpClient()
  client.poke = async () => {}
  const pending = client.call('session/prompt')
  const rejected = assert.rejects(pending, /Connection closed/)
  client.close()
  await rejected
  assert.equal(client.pending.size, 0)
  client.receive({ id: 1, result: 'late reply' })
  await assert.rejects(client.call('session/list'), /Connection closed/)
  await assert.rejects(client.identify(), /Connection closed/)
})

test('transport failures still reject immediately without resending', async () => {
  const client = new AcpClient()
  let sends = 0
  client.poke = async () => { sends++; throw new Error('offline') }
  await assert.rejects(client.call('session/list'), /offline/)
  assert.equal(sends, 1)
  assert.equal(client.pending.size, 0)
})
