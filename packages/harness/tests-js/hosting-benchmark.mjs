// Reproducible hosted-ship workload, with no model calls or external effects.
// Creates and deletes only its own uniquely named conversations. Latencies are
// client-observed, including transport; they are not CPU-only reducer timings.
import './lib/heavy-test-opt-in.mjs'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Client, base, cookie } from './lib/ship-client.mjs'

const client = new Client(), sessions = [], samples = []
const run = promisify(execFile)
async function memory() {
  if (!process.env.BENCH_PIER) return null
  // Query the running ship. /mass performs GC, so collect outside latency
  // samples and report marked memory separately from the reserved loom.
  const { stdout } = await run('click', ['-b', process.env.VERE_BINARY || '/usr/local/bin/urbit', '-c', process.env.BENCH_PIER, '[1 %peel /mass]'])
  const value = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const atom = stdout.match(new RegExp(`\\[${escaped} (0x[0-9a-f]+|[0-9]+|'[^']*'|%[a-z][a-z0-9-]*) 0\\]`))?.[1]
    assert.ok(atom, `Missing memory measurement: ${label}`)
    if (/^(0x|[0-9])/.test(atom)) return Number(atom)
    const bytes = Buffer.from(atom[0] === '%' ? atom.slice(1) : atom.slice(1, -1))
    return [...bytes].reduceRight((n, byte) => n * 256 + byte, 0)
  }
  return { head: value('%harness'), adapter: value('%harness-tlon'),
    marked: value("'total marked'"), reservedLoom: value('%loom') }
}
const sizes = (process.env.BENCH_TURNS || '0,32,128,512').split(',').map(Number)
assert.ok(sizes.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 4096))
const timed = async (fn) => {
  const at = performance.now(), value = await fn()
  return { ms: +(performance.now() - at).toFixed(3), value }
}
function distribution(values) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return { count: sorted.length, median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1], max: sorted.at(-1) }
}
async function read(path) {
  const response = await fetch(`${base}/~/scry/harness/${path}.json`, { headers: { cookie }, signal: AbortSignal.timeout(30_000) })
  assert.ok(response.ok, `scry HTTP ${response.status}`)
  const text = await response.text()
  return { bytes: Buffer.byteLength(text), json: JSON.parse(text) }
}
try {
  await client.start()
  const initialMemory = await memory()
  for (const turns of sizes) {
    const { sessionId } = await client.call('session/new', { name: `hosting-bench-${randomUUID().slice(0, 8)}` })
    sessions.push(sessionId)
    await client.call('harness/session/configure', { sessionId, config: {
      url: 'http://127.0.0.1:1/never-dispatch', model: 'no-inference-benchmark',
      key: '', headers: [], system: 'Benchmark fixture', 'max-context': 80000, tools: [],
    } })
    const commandMs = [], snapshotMs = [], snapshotBytes = []
    for (let i = 0; i < turns; i++) {
      const result = await timed(() => client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: '/memory' }] }))
      assert.equal(result.value.stopReason, 'end_turn')
      commandMs.push(result.ms)
      if ((i + 1) % 64 === 0) console.error(`Workload ${turns}: ${i + 1} commands settled`)
    }
    const { revision } = (await read(`snapshot/${sessionId}`)).json
    for (let i = 0; i < 10; i++) {
      const snap = await timed(() => read(`snapshot/${sessionId}`))
      assert.equal(snap.value.json.revision, revision)
      snapshotMs.push(snap.ms); snapshotBytes.push(snap.value.bytes)
    }
    const unchanged = await timed(() => client.call('harness/session/snapshot', { sessionId, since: revision }))
    assert.equal(unchanged.value.entries, null)
    const stop = await timed(() => client.call('session/cancel', { sessionId }))
    const row = { turns, revision, commandMs, snapshotMs, snapshotBytes,
      unchangedMs: unchanged.ms, unchangedBytes: Buffer.byteLength(JSON.stringify(unchanged.value)),
      idleStopMs: stop.ms, memory: await memory() }
    samples.push(row)
    console.error(`Measured ${turns} turns / ${row.revision} events / ${snapshotBytes[0]} snapshot bytes`)
  }
  console.log(JSON.stringify({ version: 1, workload: 'Repeated /memory, no inference, empty tool grants',
    initialMemory,
    units: { latency: 'client-observed milliseconds', payload: 'UTF-8 JSON bytes' },
    limitations: ['ACP observations include a 100ms polling interval', 'Native snapshot includes replay, JSON projection and HTTP',
      'Idle stop is not in-flight stop latency',
      'Memory includes shared code and prior retained sessions; samples accumulate this run’s conversations',
      'Whole-ship marked memory includes other agents and caches; /mass performs GC outside latency samples'],
    samples: process.env.BENCH_RAW === '1' ? samples : samples.map(({ commandMs, snapshotMs, snapshotBytes, ...row }) => ({ ...row,
      commandMs: distribution(commandMs), snapshotMs: distribution(snapshotMs), snapshotBytes: snapshotBytes[0],
    })) }, null, 2))
} finally {
  for (const sessionId of sessions) await client.call('session/delete', { sessionId })
  await client.close()
}
