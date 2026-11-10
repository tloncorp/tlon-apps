// Head/transport latency with an immediate local model and one local HTTP tool.
// No paid provider, global settings changes, or external publication. Deletes
// only uniquely named fixture sessions; run separately from native compilation.
// SHIP_URL=http://ship SHIP_COOKIE=/path/to/cookie node tests-js/performance-turn-benchmark.mjs
import './lib/heavy-test-opt-in.mjs'
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { base, cookie } from './lib/ship-client.mjs'
import { AcpClient } from '../acp/browser-client.mjs'

const realFetch = globalThis.fetch
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
// This process owns one watch, so it can take the browser's stream slot.
Object.defineProperty(globalThis.navigator, 'locks', { value: {
  request: async (_name, _options, run) => run({}),
} })
const closing = []
globalThis.fetch = (path, options = {}) => {
  const promise = realFetch(new URL(path, base), { ...options, headers: { ...options.headers, cookie } })
  if (options.keepalive) closing.push(promise)
  return promise
}
const sizes = (process.env.BENCH_TURNS || '0,64,256').split(',').map(Number)
const repeats = Number(process.env.BENCH_REPEATS || 5)
const maxP95 = process.env.BENCH_MAX_P95_MS ? Number(process.env.BENCH_MAX_P95_MS) : null
const maxGrowth = process.env.BENCH_MAX_GROWTH ? Number(process.env.BENCH_MAX_GROWTH) : null
assert.ok(maxP95 === null || (Number.isFinite(maxP95) && maxP95 > 0))
assert.ok(maxGrowth === null || (Number.isFinite(maxGrowth) && maxGrowth >= 1))
assert.ok(sizes.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 1024))
assert.ok(Number.isSafeInteger(repeats) && repeats >= 1 && repeats <= 20)
const marker = `perf-turn-${randomUUID()}`, sessions = [], results = [], faults = []
let current, port
const server = createServer(async (req, res) => {
  try {
    assert.ok(current, 'fixture request must belong to an active measurement')
    if (req.url === '/tool') {
      current.toolAt = performance.now()
      res.writeHead(200, { 'content-type': 'text/plain' }); res.end('LOCAL_TOOL_OK')
      return
    }
    const raw = await readText(req)
    const body = JSON.parse(raw)
    const after = body.messages.slice(body.messages.findLastIndex((m) => m.role === 'user') + 1)
    const finished = after.some((m) => m.role === 'tool')
    if (!finished) { current.modelAt = performance.now(); current.requestBytes = Buffer.byteLength(raw) }
    else current.resultAt = performance.now()
    const message = finished
      ? { role: 'assistant', content: 'PERF_TURN_OK' }
      : { role: 'assistant', content: '', tool_calls: [{ id: `${marker}-${current.round}`, type: 'function', function: {
        name: 'http_fetch', arguments: JSON.stringify({ url: `http://127.0.0.1:${port}/tool` }),
      } }] }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: finished ? 'stop' : 'tool_calls', message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
  } catch (error) {
    faults.push(error)
    if (!res.headersSent) res.writeHead(500)
    res.end('Local fixture error')
  }
})
const ms = (end, start) => +(end - start).toFixed(2)
const stats = (values) => {
  const sorted = [...values].sort((a, b) => a - b)
  return { median: sorted[Math.floor(sorted.length / 2)], p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1) }
}
const client = new AcpClient()
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  port = server.address().port
  await client.start()
  for (const turns of sizes) {
    const { sessionId } = await client.call('session/new', { name: `${marker}-${turns}` })
    sessions.push(sessionId)
    await client.call('harness/session/configure', { sessionId, config: {
      url: `http://127.0.0.1:${port}/model`, model: 'local-performance-fixture',
      key: '', headers: [], system: 'Local deterministic latency fixture.', 'max-context': 80000, tools: ['web'],
    } })
    for (let i = 0; i < turns; i++) {
      const value = await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: '/memory' }] })
      assert.equal(value.stopReason, 'end_turn')
    }
    const samples = []
    for (let round = 0; round < repeats; round++) {
      current = { round, start: performance.now() }
      const result = await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'Run the local performance tool.' }] })
      const completed = performance.now()
      assert.equal(result.stopReason, 'end_turn')
      if (faults.length) throw new AggregateError(faults)
      assert.ok(current.modelAt && current.toolAt && current.resultAt, 'both model turns and the local tool must complete')
      samples.push({ admissionMs: ms(current.modelAt, current.start), toolDispatchMs: ms(current.toolAt, current.modelAt),
        toolResumeMs: ms(current.resultAt, current.toolAt), completionMs: ms(completed, current.resultAt),
        totalMs: ms(completed, current.start), requestBytes: current.requestBytes })
      current = null
    }
    const row = { priorCommandTurns: turns, repeats,
      ...Object.fromEntries(['admissionMs', 'toolDispatchMs', 'toolResumeMs', 'completionMs', 'totalMs'].map((key) => [key, stats(samples.map((s) => s[key]))])),
      requestBytes: samples.at(-1).requestBytes, ...(process.env.BENCH_RAW === '1' ? { samples } : {}),
    }
    results.push(row)
    console.error(JSON.stringify(row))
  }
  console.log(JSON.stringify({ workload: 'Immediate local model + one local HTTP tool, ordinary browser ACP transport',
    limitations: ['Client-observed wall time, not CPU-only', 'Final completion includes ACP polling',
      'Synthetic history and warm runtime; no external model latency or Tlon publication'], results }, null, 2))
  // Opt-in wall-time budgets must be calibrated on the same development
  // machine. Deterministic browser request budgets run in test:performance.
  for (const row of results) {
    if (maxP95 !== null) assert.ok(row.totalMs.p95 <= maxP95, `p95 ${row.totalMs.p95}ms exceeds ${maxP95}ms at ${row.priorCommandTurns} prior turns`)
    if (maxGrowth !== null) assert.ok(row.totalMs.median <= results[0].totalMs.median * maxGrowth,
      `Median growth at ${row.priorCommandTurns} prior turns exceeds ${maxGrowth}x the first workload`)
  }
} finally {
  for (const sessionId of sessions) await client.call('session/delete', { sessionId }).catch((error) => console.error(`Fixture cleanup ${sessionId}: ${error.message}`))
  client.close(); await Promise.allSettled(closing)
  server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
