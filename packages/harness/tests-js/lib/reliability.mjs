// Bounded, dependency-free primitives shared by the local reliability runner.
import { appendFile, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export function options(env = process.env) {
  const integer = (name, fallback, min, max) => {
    const value = Number(env[name] ?? fallback)
    if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer from ${min} to ${max}`)
    return value
  }
  if (!env.SHIP_URL || !env.SHIP_COOKIE || !env.SOAK_EXPECT_SHIP) throw new Error('Set SHIP_URL, SHIP_COOKIE and SOAK_EXPECT_SHIP (the local test ship identity).')
  const url = new URL(env.SHIP_URL)
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)
    || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('SHIP_URL must be a loopback HTTP(S) origin, without credentials or a path')
  if (!/^~[a-z-]+$/.test(env.SOAK_EXPECT_SHIP)) throw new Error('SOAK_EXPECT_SHIP must be a ~ship identity')
  if (env.SOAK_WORK && !['0', '1'].includes(env.SOAK_WORK)) throw new Error('SOAK_WORK must be 0 or 1')
  return {
    base: url.origin, cookiePath: env.SHIP_COOKIE, expectedShip: env.SOAK_EXPECT_SHIP,
    work: env.SOAK_WORK === '1', durationMs: integer('SOAK_DURATION_MS', env.SOAK_WORK === '1' ? 120_000 : 60_000, 1000, 86_400_000),
    intervalMs: integer('SOAK_INTERVAL_MS', 5000, 1000, 60_000),
    turnIntervalMs: integer('SOAK_TURN_INTERVAL_MS', 10_000, 1000, 3_600_000),
    workers: integer('SOAK_WORKERS', 2, 1, 4), maxRounds: integer('SOAK_MAX_ROUNDS', 256, 1, 1024),
    deadlineMs: integer('SOAK_DEADLINE_MS', 30_000, 1000, 120_000),
    maxReadMs: env.SOAK_MAX_READ_MS ? integer('SOAK_MAX_READ_MS', 0, 1, 120_000) : null,
    workerPid: env.SOAK_WORKER_PID ? integer('SOAK_WORKER_PID', 0, 1, 2 ** 31 - 1) : null,
  }
}

export class Metric {
  constructor(capacity = 512) {
    if (!Number.isSafeInteger(capacity) || capacity < 1) throw new Error('Positive metric capacity required')
    this.capacity = capacity; this.values = []; this.count = 0; this.sum = 0; this.max = 0
  }
  add(value) {
    if (!Number.isFinite(value) || value < 0) throw new Error('Invalid measurement')
    this.values[this.count % this.capacity] = value
    this.count++; this.sum += value; this.max = Math.max(this.max, value)
  }
  summary() {
    const sorted = [...this.values].sort((a, b) => a - b)
    const round = (n) => n == null ? null : Math.round(n * 100) / 100
    return { count: this.count, mean: round(this.count ? this.sum / this.count : null), max: round(this.count ? this.max : null),
      recentSamples: sorted.length, recentMedian: round(sorted[Math.floor(sorted.length / 2)]),
      recentP95: round(sorted[Math.ceil(sorted.length * 0.95) - 1]) }
  }
}

// A test deadline is not evidence that a ship-side write failed. The caller
// must stop issuing work and reconcile known fixture identities in cleanup.
export async function deadline(promise, ms, label, signal) {
  let timer, onAbort
  try {
    return await Promise.race([promise, new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Test deadline: ${label}; inspect accepted work before repeating it`)), ms)
      onAbort = () => reject(signal.reason || new Error('Test interrupted'))
      if (signal?.aborted) onAbort()
      else signal?.addEventListener('abort', onAbort, { once: true })
    })])
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort) }
}

export async function until(check, ms, label, signal) {
  const end = performance.now() + ms
  while (performance.now() < end) {
    const result = await deadline(Promise.resolve().then(check), Math.max(1, end - performance.now()), label, signal)
    if (result) return result
    await pause(Math.min(100, Math.max(1, end - performance.now())), signal)
  }
  throw new Error(`Test deadline: ${label}`)
}

export async function pause(ms, signal) {
  let timer
  try { await deadline(new Promise((resolve) => { timer = setTimeout(resolve, ms) }), ms + 1000, 'pause', signal) }
  finally { clearTimeout(timer) }
}

export async function journal() {
  const directory = await mkdtemp(join(tmpdir(), 'harness-reliability-'))
  const path = join(directory, 'events.jsonl')
  await writeFile(path, '', { flag: 'wx', mode: 0o600 })
  let pending = Promise.resolve()
  return {
    directory,
    write(event) {
      pending = pending.then(() => appendFile(path, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`))
      return pending
    },
    async finish(report) {
      await pending
      await writeFile(join(directory, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 })
    },
  }
}

export function parseProcess(stat, status) {
  // comm can contain spaces and ')'; starttime is field 22 after the final ')'.
  const tail = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)
  const rss = /^VmRSS:\s+(\d+)\s+kB$/m.exec(status)
  if (tail.length < 20 || !/^\d+$/.test(tail[19]) || !rss) throw new Error('Cannot read Linux process memory')
  return { startTime: tail[19], rssBytes: Number(rss[1]) * 1024 }
}

export async function processMemory(pid, expectedStart) {
  const [stat, status] = await Promise.all([readFile(`/proc/${pid}/stat`, 'utf8'), readFile(`/proc/${pid}/status`, 'utf8')])
  const value = parseProcess(stat, status)
  if (expectedStart && value.startTime !== expectedStart) throw new Error('Observed process changed; refusing to attribute another process to the ship')
  return value
}
