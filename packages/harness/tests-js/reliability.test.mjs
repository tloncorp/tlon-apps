import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, stat, rm, mkdtemp, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { options, Metric, deadline, until, journal, parseProcess, processMemory } from './lib/reliability.mjs'
import { fixture } from './lib/reliability-fixture.mjs'

const env = { SHIP_URL: 'http://127.0.0.1', SHIP_COOKIE: '/fixture/cookie', SOAK_EXPECT_SHIP: '~nec' }
test('reliability defaults are read-only, local, paced and bounded', () => {
  const value = options(env)
  assert.equal(value.work, false)
  assert.equal(value.durationMs, 60_000)
  assert.equal(value.workers, 2)
  for (const SHIP_URL of ['https://example.com', 'http://user:secret@localhost', 'http://localhost/path', 'file://localhost/', 'http://localhost/?x=y']) {
    assert.throws(() => options({ ...env, SHIP_URL }), /loopback/)
  }
  for (const field of ['SHIP_URL', 'SHIP_COOKIE', 'SOAK_EXPECT_SHIP']) assert.throws(() => options({ ...env, [field]: '' }))
  for (const [key, value] of Object.entries({ SOAK_DURATION_MS: 'Infinity', SOAK_INTERVAL_MS: '0', SOAK_WORKERS: '5', SOAK_MAX_ROUNDS: '100000', SOAK_WORK: 'yes', SOAK_WORKER_PID: '-1' })) {
    assert.throws(() => options({ ...env, [key]: value }), /must be/)
  }
  assert.equal(options({ ...env, SOAK_WORK: '1', SOAK_DURATION_MS: '86400000' }).durationMs, 86_400_000)
})

test('latency samples stay bounded; maxima and counts retain early outliers', () => {
  const metric = new Metric(3)
  assert.equal(metric.summary().recentP95, null)
  metric.add(1000)
  for (let n = 1; n <= 10_000; n++) metric.add(1)
  assert.equal(metric.values.length, 3)
  assert.deepEqual(metric.summary(), { count: 10_001, mean: 1.1, max: 1000, recentSamples: 3, recentMedian: 1, recentP95: 1 })
  for (const n of [NaN, Infinity, -1]) assert.throws(() => metric.add(n))
})

test('test deadlines reject without retrying an uncertain action', async () => {
  let calls = 0
  const action = () => { calls++; return new Promise(() => {}) }
  await assert.rejects(deadline(action(), 5, 'write'), /inspect accepted work/)
  assert.equal(calls, 1)
  const controller = new AbortController()
  const waiting = deadline(action(), 1000, 'write', controller.signal)
  controller.abort(new Error('Explicit test stop'))
  await assert.rejects(waiting, /Explicit test stop/)
  await assert.rejects(until(() => false, 1000, 'test', controller.signal), /Explicit test stop/)
})

test('memory samples fence PID reuse and describe RSS, not loom occupancy', async () => {
  const fields = ['S', ...Array(18).fill('0'), '1234', '0']
  assert.deepEqual(parseProcess(`10 (worker ) name) ${fields.join(' ')}`, 'VmRSS:\t42 kB\n'), { startTime: '1234', rssBytes: 42 * 1024 })
  assert.throws(() => parseProcess('bad', 'bad'))
  if (process.platform === 'linux') {
    const sample = await processMemory(process.pid)
    assert.ok(sample.rssBytes > 0)
    await assert.rejects(processMemory(process.pid, 'different-process'), /process changed/)
  }
})

test('journals retain an interrupted run and refuse to overwrite its final report', async () => {
  const log = await journal()
  try {
    await Promise.all([log.write({ type: 'fixture-intent', sessionId: 'soak-test-0' }), log.write({ type: 'failure', message: 'Interrupted' })])
    const rows = (await readFile(`${log.directory}/events.jsonl`, 'utf8')).trim().split('\n').map(JSON.parse)
    assert.deepEqual(rows.map((row) => row.type), ['fixture-intent', 'failure'])
    await log.finish({ verdict: 'interrupted' })
    await assert.rejects(log.finish({ verdict: 'pass' }), /EEXIST/)
    assert.equal((await stat(`${log.directory}/events.jsonl`)).mode & 0o777, 0o600)
    assert.equal((await stat(`${log.directory}/report.json`)).mode & 0o777, 0o600)
  } finally { await rm(log.directory, { recursive: true }) }
})

const post = (base, path, value) => fetch(`${base}${path}`, { method: 'POST', body: typeof value === 'string' ? value : JSON.stringify(value) })
const request = (token, receipt) => ({ messages: [{ role: 'user', content: token }, ...(receipt ? [{ role: 'tool', content: receipt }] : [])] })

test('fixture observes an effect before replying and detects duplicate execution', async () => {
  const source = await fixture()
  try {
    const record = source.begin('token', 'client-detach')
    const response = await (await post(source.base, '/model', request('token'))).json()
    assert.equal(response.choices[0].message.tool_calls[0].function.name, 'curl')
    let completed = false
    const pending = post(source.base, '/effect', 'token').then((response) => { completed = true; return response.text() })
    await until(() => record.effects === 1, 1000, 'local acceptance')
    assert.equal(completed, false)
    assert.equal(source.counts().effects, 1)
    record.releaseEffect()
    assert.equal(await pending, 'EFFECT_token')
    const finish = await (await post(source.base, '/model', request('token', 'EFFECT_token'))).json()
    assert.equal(finish.choices[0].message.content, 'DONE_token')
    assert.equal((await post(source.base, '/effect', 'token')).status, 500)
    assert.equal(record.effects, 2, 'The fixture counts duplicates rather than concealing them through deduplication')
    assert.match(source.failures[0].message, /executed twice/)
    source.end('token')
    assert.equal(source.counts().retainedRecords, 0)
  } finally { await source.close() }
})

test('fixture can fail a provider or wait for revocation before returning its tool call', async () => {
  const source = await fixture()
  try {
    const failed = source.begin('failed', 'provider-failure')
    assert.equal((await post(source.base, '/model', request('failed'))).status, 503)
    assert.equal(failed.effects, 0)
    source.end('failed')
    const revoked = source.begin('revoked', 'revoke-before-dispatch')
    const waiting = post(source.base, '/model', request('revoked'))
    await until(() => revoked.releaseModel, 1000, 'held provider')
    assert.equal(revoked.effects, 0)
    revoked.releaseModel()
    assert.equal((await waiting).status, 200)
    assert.equal((await post(source.base, '/model', request('revoked', 'error: tool grant revoked'))).status, 200)
    assert.equal(source.failures.length, 0)
  } finally { await source.close() }
})

test('runner refuses the wrong local ship before any writes and keeps credentials out of reports', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'reliability-guard-test-'))
  const cookiePath = join(directory, 'cookie')
  await writeFile(cookiePath, 'localhost\tFALSE\t/\tFALSE\t0\turbauth-~nec\tDO_NOT_LOG_TEST_SECRET\n', { mode: 0o600 })
  const requests = []
  const server = createServer((req, res) => { requests.push([req.method, req.url]); res.end('~nec') })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  let reportDirectory
  try {
    const result = await promisify(execFile)(process.execPath, ['tests-js/reliability-soak.mjs'], {
      cwd: new URL('../', import.meta.url), timeout: 10_000,
      env: { PATH: process.env.PATH, TMPDIR: tmpdir(), HARNESS_HEAVY_TESTS: '1', SHIP_URL: `http://127.0.0.1:${server.address().port}`, SHIP_COOKIE: cookiePath, SOAK_EXPECT_SHIP: '~zod', SOAK_WORK: '1' },
    }).then(() => assert.fail('Wrong-ship guard must fail'), (error) => error)
    assert.equal(result.code, 1)
    assert.deepEqual(requests, [['GET', '/~/host']])
    const summary = JSON.parse(result.stdout.slice(result.stdout.indexOf('{')))
    assert.equal(summary.verdict, 'fail')
    assert.ok(summary.report.startsWith(join(tmpdir(), 'harness-reliability-')))
    reportDirectory = summary.report.slice(0, -'/report.json'.length)
    const evidence = await readFile(`${reportDirectory}/events.jsonl`, 'utf8') + await readFile(summary.report, 'utf8')
    assert.ok(!evidence.includes('DO_NOT_LOG_TEST_SECRET'))
    assert.ok(!evidence.includes(cookiePath))
  } finally {
    await new Promise((resolve) => server.close(resolve))
    await rm(directory, { recursive: true })
    if (reportDirectory) await rm(reportDirectory, { recursive: true })
  }
})
