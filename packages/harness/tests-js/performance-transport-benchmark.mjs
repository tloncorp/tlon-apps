// Controlled local transport delays; no ship, credentials or network access.
// BENCH_BASE=<previous-commit> node tests-js/performance-transport-benchmark.mjs
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'
import { AcpClient } from '../acp/browser-client.mjs'

const source = execFileSync('git', ['show', `${process.env.BENCH_BASE || 'HEAD'}:acp/browser-client.mjs`], { encoding: 'utf8' })
  .replaceAll("'./people.mjs'", JSON.stringify(new URL('../acp/people.mjs', import.meta.url).href))
  .replaceAll("'./client-id.mjs'", JSON.stringify(new URL('../acp/client-id.mjs', import.meta.url).href))
  .replaceAll("'./eyre-subscription.mjs'", JSON.stringify(new URL('../acp/eyre-subscription.mjs', import.meta.url).href))
const baseline = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).AcpClient
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
const actualFetch = globalThis.fetch
const delayMs = 250
try {
  for (const [label, Client] of [['baseline', baseline], ['current', AcpClient]]) {
    const client = new Client('local-benchmark')
    const sends = []
    client.poke = () => { const sent = sleep(delayMs); sends.push(sent); return sent }
    const start = performance.now()
    const response = client.call('session/list')
    await sleep(10)
    client.receive({ id: 1, result: { sessions: [] } })
    await response
    const readyReplyMs = Math.round(performance.now() - start)
    await Promise.all(sends)
    client.close()

    const polling = new Client('local-ack-benchmark')
    let polls = 0
    const acknowledgements = []
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ messages: [
      { sequence: ++polls, payload: JSON.stringify({ id: polls, result: {} }) },
    ] }) })
    polling.poke = () => { const ack = sleep(delayMs); acknowledgements.push(ack); return ack }
    let readyAt
    polling.pending.set(2, { resolve: () => { readyAt = performance.now() } })
    polling.waitForPoll = async () => { if (polls >= 2) polling.running = false; else await sleep(10) }
    polling.running = true
    const begin = performance.now()
    await polling.poll()
    const nextReplyDuringAckMs = Math.round(readyAt - begin)
    assert.ok(Number.isFinite(nextReplyDuringAckMs))
    await Promise.all(acknowledgements)
    polling.close()
    console.log(JSON.stringify({ label, injectedHttpDelayMs: delayMs, readyReplyMs, nextReplyDuringAckMs }))
  }
} finally { globalThis.fetch = actualFetch }
