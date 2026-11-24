// Durable modification order across native and ACP edits; no inference.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { Client } from './lib/ship-client.mjs'

const client = new Client(), names = [], prefix = `ordering-${randomUUID().slice(0, 8)}`
let received, finish
const requestReceived = new Promise((resolve) => { received = resolve })
const server = createServer((req, res) => {
  req.resume()
  finish = () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'ORDERING_OK' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } })) }
  received()
})
const list = async () => (await client.call('session/list')).sessions.filter((item) => item.sessionId.startsWith(prefix))
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  for (const name of [`${prefix}-a`, `${prefix}-b`]) {
    await client.call('session/new', { name }); names.push(name)
  }
  let rows = await list()
  assert.deepEqual(rows.map((row) => row.sessionId), [...names].reverse())
  assert.ok(rows.every((row) => Number.isSafeInteger(row.modifiedAt) && row.modifiedAt > 0))
  await client.call('harness/session/snapshot', { sessionId: names[0] })
  assert.deepEqual(await list(), rows, 'inspection must not change modification order')
  await client.call('session/prompt', { sessionId: names[0], prompt: [{ type: 'text', text: '/memory' }] })
  rows = await list()
  assert.equal(rows[0].sessionId, names[0])
  const cfg = await client.call('harness/session/config', { sessionId: names[1] })
  await client.pokeAgent('harness', 'harness-action', { config: { ...cfg, sid: names[1], key: '', system: 'Native modification ordering fixture' } })
  rows = await list()
  assert.equal(rows[0].sessionId, names[1], 'native changes update the same durable index')
  await client.call('harness/session/configure', { sessionId: names[0], config: { ...cfg, key: '', headers: [], tools: [], url: `http://127.0.0.1:${server.address().port}/completions` } })
  const turn = client.call('session/prompt', { sessionId: names[0], prompt: [{ type: 'text', text: 'Exercise response modification time' }] })
  turn.catch(() => {})
  await Promise.race([requestReceived, turn.then(() => { throw new Error('Expected a provider request before completion') })])
  const waiting = (await list()).find((row) => row.sessionId === names[0]).modifiedAt
  finish()
  await turn
  assert.ok((await list()).find((row) => row.sessionId === names[0]).modifiedAt > waiting, 'provider completion updates modification time after admission')
  const renamed = `${prefix}-renamed`
  await client.call('harness/session/rename', { sessionId: names[0], name: renamed })
  names[0] = renamed
  rows = await list()
  assert.equal(rows[0].sessionId, renamed)
  await client.call('session/delete', { sessionId: renamed })
  names.shift()
  assert.deepEqual((await list()).map((row) => row.sessionId), names)
  console.log('PASS durable modification timestamps, descending order, read stability, native edits, provider completion, rename and deletion')
} finally {
  for (const sessionId of names) await client.call('session/delete', { sessionId })
  await client.close()
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
