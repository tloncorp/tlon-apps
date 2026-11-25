import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createServer } from 'node:http'

const execute = promisify(execFile)
test('live benchmarks and soak refuse before credentials or connections without explicit opt-in', async () => {
  for (const script of ['memory-benchmark', 'hosting-benchmark', 'performance-turn-benchmark', 'performance-read-benchmark', 'reliability-soak']) {
    for (const value of ['', 'true', '0']) {
      await assert.rejects(execute(process.execPath, [`tests-js/${script}.mjs`], {
        cwd: new URL('../', import.meta.url), timeout: 5000,
        env: { PATH: process.env.PATH, HARNESS_HEAVY_TESTS: value },
      }), (error) => error.code === 1 && /Disk-intensive live tests are disabled/.test(error.stderr))
    }
  }
  const help = await execute(process.execPath, ['tests-js/reliability-soak.mjs', '--help'], {
    cwd: new URL('../', import.meta.url), timeout: 5000, env: { PATH: process.env.PATH },
  })
  assert.match(help.stdout, /HARNESS_HEAVY_TESTS=1/)
})

test('test transport acknowledges new queue positions only, never idle polls', async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'harness-client-unit-'))
  const cookiePath = join(directory, 'cookie')
  const previousCookie = process.env.SHIP_COOKIE
  t.after(async () => {
    if (previousCookie === undefined) delete process.env.SHIP_COOKIE
    else process.env.SHIP_COOKIE = previousCookie
    await rm(directory, { recursive: true })
  })
  await writeFile(cookiePath, 'localhost\tFALSE\t/\tFALSE\t0\turbauth-~zod\tUNIT_FIXTURE\n', { mode: 0o600 })
  process.env.SHIP_COOKIE = cookiePath
  const { Client } = await import('./lib/ship-client.mjs')
  const client = new Client(), acknowledgements = []
  const frame = (sequence) => ({ sequence, payload: JSON.stringify({ method: 'test/update' }) })
  const batches = [[frame(1)], [], [frame(1)], [frame(2)], []]
  const fetching = t.mock.method(globalThis, 'fetch', async () => {
    const messages = batches.shift()
    if (!batches.length) client.running = false
    return { ok: true, json: async () => ({ messages }) }
  })
  client.poke = async (value) => acknowledgements.push(value.ack.through)
  client.running = true
  await client.poll()
  assert.deepEqual(acknowledgements, [1, 2])
  assert.equal(client.acknowledged, 2)
  assert.equal(client.updates.length, 2)

  const failed = new Client()
  // A second mock of fetch would be restored to the first, not to fetch.
  fetching.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ messages: [frame(1)] }) }))
  failed.poke = async () => { throw new Error('Transport unavailable') }
  failed.running = true
  await assert.rejects(failed.poll(), /Transport unavailable/)
  assert.equal(failed.acknowledged, 0)
})

// A stand-in ship whose queue poll answers after .hold milliseconds, or never,
// and which answers every call but `unanswered`; with .holdAck it leaves its
// first acknowledgement unanswered.
async function standIn(t, hold, { holdAck = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'harness-client-unit-'))
  const cookiePath = join(directory, 'cookie')
  const previousCookie = process.env.SHIP_COOKIE
  await writeFile(cookiePath, 'localhost\tFALSE\t/\tFALSE\t0\turbauth-~zod\tUNIT_FIXTURE\n', { mode: 0o600 })
  process.env.SHIP_COOKIE = cookiePath
  const results = [], polls = [], requests = [], acks = []
  const server = createServer((req, res) => {
    requests.push(req.method)
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      if (req.method === 'PUT') {
        const { send, ack } = JSON.parse(raw)[0].json
        if (ack && acks.push(ack.through) === 1 && holdAck) return
        if (send && JSON.parse(send.payload).method !== 'unanswered') results.push({ sequence: results.length + 1, payload: JSON.stringify({ jsonrpc: '2.0', id: JSON.parse(send.payload).id, result: { ok: true } }) })
        return res.end()
      }
      polls.push(Date.now())
      if (hold === Infinity) return
      const answer = () => res.end(JSON.stringify({ messages: results }))
      if (polls.length > 1) return answer()
      setTimeout(answer, hold)
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(async () => {
    if (previousCookie === undefined) delete process.env.SHIP_COOKIE
    else process.env.SHIP_COOKIE = previousCookie
    server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true })
  })
  const { Client } = await import('./lib/ship-client.mjs')
  return { url: `http://127.0.0.1:${server.address().port}`, Client, polls, requests, acks }
}

test('test transport asks again when a queue poll outlasts its request limit', { timeout: 10000 }, async (t) => {
  const { url, Client, polls } = await standIn(t, 600)
  const client = new Client({ url, auth: 'urbauth-~zod=UNIT_FIXTURE', limit: 200, deadline: 5000 })
  await client.start()
  assert.ok(polls.length >= 2)
  client.running = false; await client.polling
})

test('test transport fails at the call deadline, naming the silent poll, and stops', { timeout: 5000 }, async (t) => {
  const { url, Client, polls, requests } = await standIn(t, Infinity)
  const client = new Client({ url, auth: 'urbauth-~zod=UNIT_FIXTURE', limit: 200, deadline: 1000 })
  const started = Date.now()
  const failure = await client.start().then(() => assert.fail('initialize answered'), (error) => error)
  const elapsed = Date.now() - started
  assert.match(failure.message, /^initialize timed out; the ship has not answered GET \/~\/scry\/acp\/v1\/conformance-[^/]+\/client\.json for \d+\.\d s$/)
  assert.ok(elapsed >= 950 && elapsed < 3000, `failed after ${elapsed} ms`)
  assert.equal(client.running, false)
  await client.polling
  const asked = polls.length
  await new Promise((resolve) => setTimeout(resolve, 600))
  assert.equal(polls.length, asked, 'no polls after the failure')
  const sent = requests.length
  await assert.rejects(client.call('harness/tlon'), (error) => error === failure)
  assert.equal(requests.length, sent, 'a call after the failure sends nothing')
})

test('test transport sends an acknowledgement that times out again, without failing the client', { timeout: 5000 }, async (t) => {
  const { url, Client, acks } = await standIn(t, 0, { holdAck: true })
  const client = new Client({ url, auth: 'urbauth-~zod=UNIT_FIXTURE', limit: 200, deadline: 5000 })
  await client.start()
  while (!client.acknowledged && !client.failure) await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(client.failure, undefined)
  assert.deepEqual(acks, [1, 1])
  assert.equal(client.running, true)
  assert.deepEqual(await client.call('initialize'), { ok: true })
  client.running = false; await client.polling
})

test('test transport fails one call, not the client, when the ship answers polls', { timeout: 5000 }, async (t) => {
  const { url, Client } = await standIn(t, 0)
  const client = new Client({ url, auth: 'urbauth-~zod=UNIT_FIXTURE', limit: 200, deadline: 1000 })
  await client.start()
  await assert.rejects(client.call('unanswered'), /^Error: unanswered timed out$/)
  assert.equal(client.running, true)
  assert.deepEqual(await client.call('initialize'), { ok: true })
  client.running = false; await client.polling
})
