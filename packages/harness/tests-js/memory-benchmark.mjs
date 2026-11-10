// Run against a disposable ship with the current desk and test source committed.
// PIER=/path/to/pier HARNESS_HEAVY_TESTS=1 node tests-js/memory-benchmark.mjs
// Measures native recall and rendering after seeding, across separate events.
import './lib/heavy-test-opt-in.mjs'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
const run = promisify(execFile), pier = process.env.PIER
assert.ok(pier, 'Set PIER to a disposable test ship')
const sizes = (process.env.MEMORY_BENCH_SIZES || '1024,8192,32768').split(',').map(Number)
assert.ok(sizes.every((n) => Number.isSafeInteger(n) && n >= 1 && n <= 32768))
const ud = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
const timestamp = () => {
  const d = new Date()
  return `~${d.getUTCFullYear()}.${d.getUTCMonth() + 1}.${d.getUTCDate()}..${[d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()].map((n) => String(n).padStart(2, '0')).join('.')}`
}
for (const count of sizes) {
  const samples = []
  for (let sample = 0; sample < 3; sample++) {
    const { stdout } = await run(new URL('../scripts/click', import.meta.url).pathname, ['-k', '-p', pier, `(measure ${ud(count)} 100)`,
      `/~zod/harness/${timestamp()}/tests-integration/harness-memory-benchmark/hoon`], { timeout: 60000, maxBuffer: 1024 * 1024 })
    const found = stdout.match(/%noun ([\d.]+) ([\d.]+) ([\d.]+) ([0-9a-fx.]+) ([\d.]+) ([\d.]+)/)
    assert.ok(found, 'Native benchmark failed; inspect the ship log')
    const values = found.slice(1).map((x) => Number(x.replaceAll('.', '')))
    assert.equal(values[0], count); assert.equal(values[1], 100)
    assert.equal(values[4], 64); assert.equal(values[5], 64)
    samples.push(values[2])
  }
  samples.sort((a, b) => a - b)
  console.log(JSON.stringify({ records: count, queriesPerSample: 100, samplesMs: samples,
    candidatesPerRecall: 64, medianMsPerRecall: samples[1] / 100, includesTimerWake: true }))
}
