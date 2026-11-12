import assert from 'node:assert/strict'
import test from 'node:test'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

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
  t.mock.method(globalThis, 'fetch', async () => {
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
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ messages: [frame(1)] }) }))
  failed.poke = async () => { throw new Error('Transport unavailable') }
  failed.running = true
  await assert.rejects(failed.poll(), /Transport unavailable/)
  assert.equal(failed.acknowledged, 0)
})
