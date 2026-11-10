// Local-only real Eyre/ACP watch, disconnect, fallback and resubscription.
// Creates temporary transport channels, but no sessions, prompts or settings.
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { AcpClient } from '../acp/browser-client.mjs'
import { base, cookie } from './lib/ship-client.mjs'

assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Use a local development ship')
assert.ok(globalThis.navigator?.locks, 'This test needs navigator.locks, which Node 22 lacks; v26 is known to work')
const realFetch = globalThis.fetch
globalThis.document = Object.assign(new EventTarget(), { hidden: false })
const sends = [], cleanup = []
let polls = 0, holdSend = false, releaseSend, sentHttp
globalThis.fetch = (path, options = {}) => {
  if (path.startsWith('/~/scry/')) polls++
  const action = options.body ? JSON.parse(options.body)[0] : null
  if (action?.json?.send) sends.push(JSON.parse(action.json.send.payload))
  const response = realFetch(new URL(path, base), { ...options, headers: { ...options.headers, cookie } })
  if (options.keepalive) cleanup.push(response)
  if (holdSend && action?.json?.send) {
    sentHttp = response
    return new Promise((resolve, reject) => { releaseSend = () => response.then(resolve, reject) })
  }
  return response
}
const until = async (description, check) => {
  for (let i = 0; i < 1300; i++) { if (check()) return; await sleep(50) }
  throw new Error(`Timed out in local test: ${description}`)
}
const client = new AcpClient()
try {
  await client.start()
  await until('watch connected', () => client.subscription?.connected)
  await sleep(1200) // Let startup's pre-subscription poll settle.
  const idle = polls
  await sleep(1500)
  assert.equal(polls, idle, 'healthy idle delivery needs no rapid queue scries')

  holdSend = true
  const result = await client.call('session/list')
  assert.ok(Array.isArray(result.sessions))
  assert.ok(releaseSend, 'reply arrived while its send HTTP completion was held')
  holdSend = false; releaseSend(); await sentHttp
  const connection = client.connection, through = client.receivedThrough

  // Destroy only this watch channel, leaving the durable ACP queue intact.
  const watch = client.subscription
  const removed = await realFetch(new URL(`/~/channel/${watch.channel}`, base), {
    method: 'PUT', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify([{ action: 'delete' }]),
  })
  assert.ok(removed.ok)
  await until('watch disconnected', () => client.subscription !== watch)
  const beforeFallback = polls
  assert.ok(Array.isArray((await client.call('session/list')).sessions))
  assert.ok(polls > beforeFallback, 'polling supplies replies while the watch is down')
  assert.equal(client.connection, connection)
  assert.ok(client.receivedThrough > through)
  await until('watch reconnected', () => client.subscription?.connected)
  assert.equal(client.connection, connection, 'watch recovery never replaces a healthy ACP queue')
  assert.equal(sends.filter((frame) => frame.method === 'session/list').length, 2, 'neither read was resent')
  assert.equal(new Set(sends.map((frame) => frame.id)).size, sends.length)
  console.log('PASS push delivery, idle read budget, slow send completion, watch loss, polling fallback, resubscription and no RPC replay')
} finally {
  releaseSend?.()
  client.close()
  await Promise.allSettled(cleanup)
  globalThis.fetch = realFetch
}
