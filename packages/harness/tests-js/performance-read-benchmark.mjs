// Read-only ACP timings using the actual browser transport. No prompts, config
// writes, or onboarding creation. Each temporary connection is closed afterward.
// SHIP_URL=http://ship SHIP_COOKIE=/path/to/cookie node tests-js/performance-read-benchmark.mjs
// Optional BENCH_BASE=HEAD compares the previous transport against this worktree.
import './lib/heavy-test-opt-in.mjs'
import { readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const base = process.env.SHIP_URL
if (!base || !process.env.SHIP_COOKIE) throw new Error('Set SHIP_URL and SHIP_COOKIE.')
const row = (await readFile(process.env.SHIP_COOKIE, 'utf8')).split('\n').find((line) => /\turbauth-~/.test(line))
if (!row) throw new Error('Authenticated Netscape cookie required.')
const fields = row.split('\t'), cookie = `${fields[5]}=${fields[6]}`
const actualFetch = globalThis.fetch
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
// This process owns one watch, so it can take the browser's stream slot.
Object.defineProperty(globalThis.navigator, 'locks', { value: {
  request: async (_name, _options, run) => run({}),
} })
let events = [], closing = []
globalThis.fetch = async (path, options = {}) => {
  const action = options.body ? JSON.parse(options.body)[0] : null
  const op = action?.json ? Object.keys(action.json)[0] : action?.action ? `eyre-${action.action}`
    : path.startsWith('/~/scry/') ? 'poll' : path.startsWith('/~/channel/') ? 'stream' : 'identity'
  events.push(op)
  const request = actualFetch(new URL(path, base), { ...options, headers: {
    ...options.headers, cookie, ...(process.env.SHIP_HOST ? { host: process.env.SHIP_HOST } : {}),
  } })
  if (options.keepalive) closing.push(request)
  return request
}

const methods = ['harness/status', 'session/list', 'harness/peers', 'harness/tlon']
const counts = (events) => events.reduce((out, name) => ({ ...out, [name]: (out[name] || 0) + 1 }), {})
const current = (await import('../acp/browser-client.mjs')).AcpClient
const clients = [['current', current]]
if (process.env.BENCH_BASE) {
  const source = execFileSync('git', ['show', `${process.env.BENCH_BASE}:acp/browser-client.mjs`], { encoding: 'utf8' })
    .replaceAll("'./people.mjs'", JSON.stringify(new URL('../acp/people.mjs', import.meta.url).href))
    .replaceAll("'./client-id.mjs'", JSON.stringify(new URL('../acp/client-id.mjs', import.meta.url).href))
    .replaceAll("'./eyre-subscription.mjs'", JSON.stringify(new URL('../acp/eyre-subscription.mjs', import.meta.url).href))
  const previous = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).AcpClient
  clients.unshift(['baseline', previous])
}
for (let pass = 1; pass <= 2; pass++) {
  for (const [label, Client] of pass === 1 ? clients : [...clients].reverse()) {
    const client = new Client()
    events = []; closing = []
    try {
      const start = performance.now()
      await client.start()
      const startupMs = Math.round(performance.now() - start)
      // The initial Settings reads share one ACP connection and run together.
      // Keep this distinct from sequential RPC timings and model-catalog I/O.
      const settingsStart = performance.now()
      await Promise.all([
        client.call('harness/defaults'), client.call('harness/tools'),
        client.call('harness/mcp/servers'), client.call('harness/status', { provider: 'openai' }),
      ])
      const settingsMs = Math.round(performance.now() - settingsStart)
      const timings = Object.fromEntries(methods.map((method) => [method, []]))
      for (let round = 0; round < 3; round++) for (const method of methods) {
        const start = performance.now()
        await client.call(method)
        timings[method].push(Math.round(performance.now() - start))
      }
      // Let the last real acknowledgement finish before counting idle traffic.
      await sleep(1000)
      const offset = events.length
      await sleep(3000)
      console.log(JSON.stringify({ pass, label, startupMs, settingsMs, timings, subscribed: Boolean(client.subscription?.connected), streamError: client.streamError || null, idle3s: counts(events.slice(offset)), total: counts(events) }))
    } finally {
      client.close()
      await Promise.allSettled(closing)
    }
  }
}
