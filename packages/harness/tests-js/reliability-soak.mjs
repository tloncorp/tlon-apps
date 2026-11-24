// Sustained local-only acceptance test using the real browser ACP transport.
// Default: read-only application probes and disposable transport connections.
// SOAK_WORK=1 adds unique fixture conversations + a local provider/POST effect.
// No paid inference, public content, global settings changes or ship restarts.
// Ctrl-C stops the runner, reconciles its own sessions and writes a partial report.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { cpus, totalmem, platform, release } from 'node:os'
import { AcpClient } from '../acp/browser-client.mjs'
import { options, Metric, deadline, until, pause, journal, processMemory } from './lib/reliability.mjs'
import { fixture, faultModes } from './lib/reliability-fixture.mjs'

if (process.argv.includes('--help')) {
  console.log(`Required: HARNESS_HEAVY_TESTS=1 SHIP_URL=http://127.0.0.1 SHIP_COOKIE=/path/to/cookie SOAK_EXPECT_SHIP=~ship
Live test traffic remains in the ship event log after fixture cleanup. Monitor disk use.
Optional: SOAK_WORK=1 (creates/removes only unique fixture sessions)
SOAK_DURATION_MS=60000 (120000 with work; max 86400000), SOAK_INTERVAL_MS=5000,
SOAK_TURN_INTERVAL_MS=10000, SOAK_WORKERS=2 (max 4), SOAK_MAX_ROUNDS=256 (max 1024),
SOAK_DEADLINE_MS=30000, SOAK_MAX_READ_MS=<optional calibrated latency budget>,
SOAK_WORKER_PID=<optional local Urbit worker PID for RSS, not loom occupancy>.
The duration bounds the observation window, not startup/cleanup. A work round
may finish after the window. Reaching max rounds leaves read probes running.
Work mode must exercise all six fault modes to pass; a short run can fail for
insufficient coverage. Silent watch recovery uses the real 45s heartbeat guard.
Reports go to a new private temporary directory, printed before connecting.`)
  process.exit(0)
}

await import('./lib/heavy-test-opt-in.mjs')
const config = options(), log = await journal(), stop = new AbortController()
const runId = `soak-${randomUUID().slice(0, 8)}`, clients = new Set(), owned = []
const metrics = new Map(), transportCounts = {}, highWater = new Map(), modes = {}
const cleanupFailures = [], startedAt = new Date().toISOString(), started = performance.now()
const realFetch = globalThis.fetch, savedDocument = globalThis.document
const execute = promisify(execFile)
const provenance = { node: process.version, platform: platform(), release: release(),
  cpu: cpus()[0]?.model, logicalCpus: cpus().length, hostMemoryBytes: totalmem(),
  sourceRevision: null, worktreeDirty: null, installedRelease: 'not measured', compileCondition: 'not controlled; do not compile during timing runs' }
try {
  const cwd = new URL('../', import.meta.url)
  provenance.sourceRevision = (await execute('git', ['rev-parse', 'HEAD'], { cwd })).stdout.trim()
  provenance.worktreeDirty = Boolean((await execute('git', ['status', '--porcelain'], { cwd })).stdout.trim())
} catch { /* A packaged runner need not include Git metadata. */ }
let source, observer, processStart, firstRss, lastRss, peakRss = 0, interrupted = false, failure = null
let rounds = 0, probes = 0, workloadStart, workloadEnd, windowEnd
const cleanupRequests = new Set()
const metric = (name) => { if (!metrics.has(name)) metrics.set(name, new Metric()); return metrics.get(name) }
const interrupt = () => {
  interrupted = true
  stop.abort(new Error('Runner interrupted; accepted work requires reconciliation'))
}
process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt)
console.log(`Reliability run ${runId}: ${log.directory}`)
await log.write({ type: 'start', runId, config: { ...config, cookiePath: undefined }, provenance, limitations: [
  'Synthetic browser-transport clients, not rendered browser tabs',
  'HTTP/RPC wall time is not Arvo event CPU time; RSS is not loom occupancy',
  'No cold compilation, process restart or native Notes write injection in this workload',
] })

// Forward only to the selected local origin. No payloads, cookies, user text or
// provider configuration are recorded; high-water counters detect RPC replay.
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
globalThis.fetch = (path, init = {}) => {
  const url = new URL(path, config.base)
  assert.equal(url.origin, config.base, 'Browser transport must stay on the selected local ship')
  const action = typeof init.body === 'string' ? JSON.parse(init.body)[0] : null
  const send = action?.json?.send
  if (send) {
    const frame = JSON.parse(send.payload)
    if (frame.id != null) {
      assert.ok(frame.id > (highWater.get(send.connection) || 0), 'The browser transport resent an RPC')
      highWater.set(send.connection, frame.id)
    }
  }
  const operation = send ? 'rpc-send' : action?.json?.ack ? 'acp-ack' : action?.action === 'ack' ? 'eyre-ack'
    : action?.action === 'subscribe' ? 'subscribe' : url.pathname.startsWith('/~/scry/') ? 'scry'
      : init.method === 'PUT' ? 'channel-control' : url.pathname.startsWith('/~/channel/') ? 'stream' : 'identity'
  transportCounts[operation] = (transportCounts[operation] || 0) + 1
  // Keep cleanup bounded even if the ship stops responding. Ordinary RPCs use
  // the real client's behavior; only the test's outer deadline stops the run.
  const promise = realFetch(url, { ...init, headers: { ...init.headers, cookie },
    ...(init.keepalive ? { signal: AbortSignal.timeout(5000) } : {}), redirect: 'error' })
  if (init.keepalive) {
    cleanupRequests.add(promise)
    promise.then(() => cleanupRequests.delete(promise), () => cleanupRequests.delete(promise))
  }
  return promise
}

let cookie
async function call(client, method, params = {}, signal = stop.signal, budget = config.deadlineMs) {
  const start = performance.now()
  try { return await deadline(client.call(method, params), budget, method, signal) }
  finally { metric(`rpc:${method}`).add(performance.now() - start) }
}
async function connect(signal = stop.signal, budget = config.deadlineMs) {
  const client = new AcpClient(); clients.add(client)
  try { await deadline(client.start(), budget, 'ACP initialization', signal); return client }
  catch (error) { client.close(); clients.delete(client); throw error }
}
function close(client) { client.close(); clients.delete(client) }
async function configure(client, sessionId, tools = ['curl']) {
  await call(client, 'harness/session/configure', { sessionId, config: {
    url: `${source.base}/model`, model: 'local-reliability-fixture', key: '', headers: [],
    system: 'Local deterministic reliability fixture. No external model or publication.',
    'max-context': 1_000_000, tools,
  } })
}
const snapshot = (sessionId) => call(observer, 'harness/session/snapshot', { sessionId })
const guard = () => { if (source?.failures.length) throw new AggregateError(source.failures, 'Local fixture invariants failed') }

async function workRound(worker, round) {
  const mode = worker.number === 0 ? faultModes[round % faultModes.length] : 'normal'
  const token = `${runId}-${worker.number}-${round}`, record = source.begin(token, mode)
  const began = performance.now()
  await log.write({ type: 'turn-start', sessionId: worker.sessionId, round, mode, token })
  const originalConnection = worker.client.connection
  let retiredWatch
  const pending = call(worker.client, 'session/prompt', { sessionId: worker.sessionId,
    clientMessageId: token, prompt: [{ type: 'text', text: token }] })
  // Attach immediately: intentional detachment/provider failure can reject
  // while the observer is still checking the accepted work.
  const outcome = pending.then((result) => ({ result }), (error) => ({ error }))
  if (['watch-loss', 'client-detach', 'cancel-after-effect'].includes(mode)) {
    await until(() => { guard(); return record.effects === 1 }, config.deadlineMs, 'local effect accepted', stop.signal)
    await log.write({ type: 'fault-boundary', mode, sessionId: worker.sessionId, token, effectAccepted: true })
    if (mode === 'watch-loss') {
      const watch = worker.client.subscription
      assert.ok(watch?.connected, 'Watch-loss test requires a connected watch')
      retiredWatch = watch
      const response = await realFetch(`${config.base}/~/channel/${watch.channel}`, {
        method: 'PUT', headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify([{ action: 'delete' }]), signal: AbortSignal.timeout(5000), redirect: 'error',
      })
      assert.ok(response.ok, 'Only the fixture watch must be removed')
      // Deleting the server-side channel can be silent until the 45-second
      // heartbeat guard fires. Release the effect now: the safety scry must
      // deliver its result even before the lost watch is diagnosed.
    } else if (mode === 'client-detach') {
      close(worker.client)
      assert.ok((await outcome).error, 'Closing the originating client rejects its wait, not ship-side work')
      worker.client = await connect()
    } else {
      await call(observer, 'session/cancel', { sessionId: worker.sessionId })
      assert.equal((await outcome).result?.stopReason, 'cancelled')
      const cancelled = await snapshot(worker.sessionId)
      assert.equal(cancelled.phase, 'idle')
      assert.ok(cancelled.entries.some((entry) => entry.cancelled && entry.callId === token), 'Cancellation must retain the uncertain effect receipt')
      record.releaseEffect()
      await pause(500, stop.signal)
      assert.deepEqual(await snapshot(worker.sessionId), cancelled, 'A late effect reply must not revive cancelled work')
    }
    if (mode !== 'cancel-after-effect') record.releaseEffect()
  } else if (mode === 'revoke-before-dispatch') {
    await until(() => { guard(); return record.releaseModel }, config.deadlineMs, 'provider request held before tool dispatch', stop.signal)
    await log.write({ type: 'fault-boundary', mode, sessionId: worker.sessionId, token, effectAccepted: false })
    await configure(observer, worker.sessionId, [])
    record.releaseModel()
  }
  if (mode === 'client-detach') {
    await until(async () => (await snapshot(worker.sessionId)).entries.at(-1)?.body === `DONE_${token}`,
      config.deadlineMs, 'accepted work completes without the original client', stop.signal)
  } else {
    const finished = await outcome
    if (stop.signal.aborted) throw stop.signal.reason
    if (mode !== 'provider-failure') {
      if (finished.error) throw finished.error
      assert.equal(finished.result.stopReason, mode === 'cancel-after-effect' ? 'cancelled' : 'end_turn')
    }
  }
  const state = await snapshot(worker.sessionId)
  assert.ok(['idle', ...(mode === 'provider-failure' ? ['error'] : [])].includes(state.phase), `Unexpected terminal phase: ${state.phase}`)
  const noEffect = ['provider-failure', 'revoke-before-dispatch'].includes(mode)
  assert.equal(record.effects, noEffect ? 0 : 1, 'An uncertain transport outcome never authorizes another effect')
  assert.equal(record.modelRequests, ['provider-failure', 'cancel-after-effect'].includes(mode) ? 1 : 2)
  if (!['provider-failure', 'cancel-after-effect'].includes(mode)) assert.equal(state.entries.at(-1)?.body, `DONE_${token}`)
  const settledMs = performance.now() - began
  metric(`settlement:${mode}Ms`).add(settledMs)
  if (mode === 'revoke-before-dispatch') await configure(observer, worker.sessionId)
  if (mode === 'watch-loss') {
    await until(() => worker.client.subscription !== retiredWatch && worker.client.subscription?.connected,
      Math.max(70_000, config.deadlineMs), 'silent watch loss and reconnect', stop.signal)
    assert.equal(worker.client.connection, originalConnection, 'Watch recovery must preserve the ACP queue')
  }
  guard()
  modes[mode] = (modes[mode] || 0) + 1
  metric('scenarioMs').add(performance.now() - began)
  metric('providerRequestBytes').add(record.requestBytes)
  await log.write({ type: 'turn-pass', sessionId: worker.sessionId, round, mode, effects: record.effects,
    modelRequests: record.modelRequests, entries: state.entries.length, settlementMs: Math.round(settledMs), elapsedMs: Math.round(performance.now() - began) })
  source.end(token)
}

async function probeLoop() {
  const methods = [
    ['harness/defaults', {}], ['harness/workspace', { action: 'artifacts', args: { offset: 0, limit: 1 } }],
    ['harness/search/status', {}],
  ]
  let prior = performance.now()
  do {
    const began = performance.now()
    metric('probeGapMs').add(began - prior); prior = began
    // A small native HTTP probe helps distinguish ACP trouble from a ship-wide
    // delay. It measures response wall time, not the duration of an Arvo event.
    const start = performance.now()
    const response = await realFetch(`${config.base}/~/host`, { signal: AbortSignal.any([stop.signal, AbortSignal.timeout(config.deadlineMs)]), redirect: 'error' })
    assert.equal(response.status, 200)
    assert.equal((await response.text()).trim(), config.expectedShip)
    metric('hostHttpMs').add(performance.now() - start)
    for (const [method, params] of methods) await call(observer, method, params)
    const elapsed = performance.now() - began
    metric('readBatchMs').add(elapsed); probes++
    if (config.maxReadMs) assert.ok(elapsed <= config.maxReadMs, `Read batch ${Math.round(elapsed)}ms exceeded the configured ${config.maxReadMs}ms budget`)
    if (config.workerPid) {
      const memory = await processMemory(config.workerPid, processStart)
      processStart ??= memory.startTime; firstRss ??= memory.rssBytes; lastRss = memory.rssBytes; peakRss = Math.max(peakRss, lastRss)
    }
    guard()
    await log.write({ type: 'probe', number: probes, elapsedMs: Math.round(elapsed), transportCounts: { ...transportCounts },
      clients: [...clients].map((client) => ({ connected: Boolean(client.subscription?.connected), pending: client.pending.size,
        received: client.receivedThrough, acknowledged: client.acknowledgedThrough })), ...(lastRss ? { workerRssBytes: lastRss } : {}) })
    if (probes % 6 === 0) console.log(`Running: ${probes} read batches, ${rounds} work rounds; max read ${Math.round(metric('readBatchMs').max)}ms`)
    await pause(Math.max(config.intervalMs - (performance.now() - began), 1), stop.signal)
  } while (performance.now() < windowEnd)
}

try {
  const fields = (await readFile(config.cookiePath, 'utf8')).split('\n').find((row) => /\turbauth-~/.test(row))?.split('\t')
  assert.ok(fields?.[5] && fields?.[6], 'Authenticated Netscape cookie required')
  cookie = `${fields[5]}=${fields[6]}`
  // Validate the actual destination BEFORE creating even a test ACP queue.
  for (const path of ['/~/host', '/~/name']) {
    const response = await realFetch(`${config.base}${path}`, { headers: { cookie }, signal: AbortSignal.timeout(5000), redirect: 'error' })
    assert.equal(response.status, 200)
    assert.equal((await response.text()).trim(), config.expectedShip, 'Wrong local ship or authentication identity')
  }
  observer = await connect()
  const workers = []
  if (config.work) source = await fixture()
  for (let number = 0; number < config.workers; number++) {
    const client = await connect()
    if (config.work) {
      const sessionId = `${runId}-${number}`
      owned.push(sessionId)
      await log.write({ type: 'fixture-intent', sessionId }) // Persist identity before the possibly uncertain create.
      const created = await call(observer, 'session/new', { name: sessionId })
      assert.equal(created.sessionId, sessionId)
      await configure(observer, sessionId)
      workers.push({ number, client, sessionId })
    }
  }
  // The browser client allows two event streams per origin; the rest use queue reads.
  await until(() => [...clients].filter((client) => client.subscription?.connected).length >= Math.min(clients.size, 2), config.deadlineMs, 'client watches connected', stop.signal)
  workloadStart = performance.now(); windowEnd = workloadStart + config.durationMs
  const workLoop = async () => {
    while (performance.now() < windowEnd && rounds < config.maxRounds) {
      const began = performance.now()
      const turns = workers.map((worker) => workRound(worker, rounds))
      const settled = await Promise.allSettled(turns)
      const rejected = settled.find((entry) => entry.status === 'rejected')
      if (rejected) throw rejected.reason
      rounds++
      await pause(Math.max(1, config.turnIntervalMs - (performance.now() - began)), stop.signal)
    }
  }
  const runs = [probeLoop(), ...(config.work ? [workLoop()] : [])].map((run) => run.catch((error) => { stop.abort(error); throw error }))
  const settled = await Promise.allSettled(runs)
  const rejected = settled.find((entry) => entry.status === 'rejected')
  if (rejected) throw rejected.reason
  guard()
  if (config.work) assert.ok(faultModes.every((mode) => modes[mode]), 'Observation window ended before all fault modes ran; increase SOAK_DURATION_MS or SOAK_MAX_ROUNDS')
} catch (error) {
  failure = error
  console.error(`Reliability run did not pass: ${error.message}`)
  await log.write({ type: 'failure', message: error.message })
} finally {
  workloadEnd = performance.now()
  // Stop all original clients first, including RPCs whose test deadline fired.
  // No mutation is replayed. A fresh observer reconciles only known fixture IDs.
  for (const client of clients) client.close()
  clients.clear()
  if (source) await source.close()
  if (owned.length) {
    let cleaner
    try {
      cleaner = await connect(null, 5000)
      for (const sessionId of owned) {
        try {
          await call(cleaner, 'session/cancel', { sessionId }, null, 5000)
          const state = await call(cleaner, 'harness/session/snapshot', { sessionId }, null, 5000)
          assert.ok(['idle', 'error'].includes(state.phase), 'Cannot remove unsettled fixture work')
          await call(cleaner, 'session/delete', { sessionId }, null, 5000)
          await log.write({ type: 'fixture-removed', sessionId })
        } catch (error) { cleanupFailures.push({ sessionId, message: error.message }) }
      }
    } catch (error) { for (const sessionId of owned) cleanupFailures.push({ sessionId, message: error.message }) }
    finally { if (cleaner) close(cleaner) }
  }
  await Promise.allSettled([...cleanupRequests])
  globalThis.fetch = realFetch; globalThis.document = savedDocument
  process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt)
  const report = { runId, startedAt, finishedAt: new Date().toISOString(), provenance,
    verdict: interrupted ? 'interrupted' : failure || cleanupFailures.length ? 'fail' : 'pass',
    requestedDurationMs: config.durationMs, observedDurationMs: workloadStart ? Math.round(workloadEnd - workloadStart) : 0,
    totalElapsedMs: Math.round(performance.now() - started), work: config.work, probes, rounds, modes,
    allFaultModesExercised: config.work && faultModes.every((mode) => modes[mode]),
    metrics: Object.fromEntries([...metrics].map(([key, value]) => [key, value.summary()])), transportCounts,
    ...(source ? { fixture: source.counts() } : {}),
    processMemory: config.workerPid ? { pid: config.workerPid, firstRssBytes: firstRss, lastRssBytes: lastRss, peakRssBytes: peakRss } : null,
    cleanupFailures, ...(failure ? { failure: failure.message } : {}),
    limitations: ['Latency percentiles cover the most recent 512 samples; counts, means and maxima cover the whole run',
      'HTTP/RPC wall time does not isolate Arvo event CPU time; process RSS is not loom usage',
      'Real browser transport in Node, not browser rendering or a full browser-tab soak',
      'Local synthetic inference/effects; no Notes writes, schedules, ship restarts or cold compilation exercised'],
  }
  await log.finish(report)
  console.log(JSON.stringify({ verdict: report.verdict, report: `${log.directory}/report.json`, probes, rounds, modes, cleanupFailures }, null, 2))
  if (report.verdict !== 'pass') process.exitCode = interrupted ? 130 : 1
}
