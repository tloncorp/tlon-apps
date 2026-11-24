// Exercise the production browser ACP client against Eyre with another ship's
// cookie first. This is a transport test, not a browser/DOM automation test.
import assert from 'node:assert/strict'
import { AcpClient } from '../acp/browser-client.mjs'
import { base, cookie } from './lib/ship-client.mjs'

const fetchNative = globalThis.fetch
const destination = await fetchNative(`${base}/~/host`).then((response) => response.text()).then((ship) => ship.trim().slice(1))
const requests = [], inFlight = new Set()
globalThis.window = { ship: 'lux' }
globalThis.document = Object.defineProperties(new EventTarget(), {
  hidden: { value: false },
  cookie: { get() { throw new Error('Production client must not inspect cookies') } },
})
globalThis.fetch = (path, options = {}) => {
  if (options.body) requests.push(...JSON.parse(options.body))
  const request = fetchNative(new URL(path, base), {
    ...options, headers: { ...options.headers, cookie: `urbauth-~lux=unrelated-fixture-cookie; ${cookie}` },
  })
  inFlight.add(request)
  request.finally(() => inFlight.delete(request)).catch(() => {})
  return request
}
const client = new AcpClient()
let polling
const poll = client.poll.bind(client)
client.poll = () => (polling = poll())
try {
  await client.start()
  for (const method of ['session/list', 'harness/defaults', 'harness/tools', 'harness/mcp/servers', 'harness/search', 'harness/tlon']) {
    await client.call(method)
  }
  assert.equal(client.ship(), destination)
  assert.ok(requests.length > 6)
  // Channel acks are addressed to the channel, not a ship, and arrive on a timer.
  assert.ok(requests.filter((request) => request.action !== 'ack').every((request) => request.ship === destination))
  console.log('PASS production browser client: mixed localhost cookies and stale window.ship cannot redirect ACP; all settings reads succeed')
} finally {
  client.close()
  await polling
  await Promise.allSettled([...inFlight])
  globalThis.fetch = fetchNative
}
