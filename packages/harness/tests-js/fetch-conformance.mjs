// Real head/Iris dispatch to an isolated fixture. No global settings change.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'

const client = new Client(), effects = [], failures = []
const sessionId = `fetch-test-${randomUUID().slice(0, 8)}`
let url, created = false
const server = createServer(async (req, res) => {
  if (req.url !== '/model') {
    effects.push({ path: req.url, method: req.method, authorization: req.headers.authorization })
    if (req.url === '/redirect') { res.writeHead(302, { location: `${url}/sentinel` }); return res.end() }
    if (req.url === '/failed') return res.destroy()
    return res.end('GET_RECEIPT')
  }
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    const mode = body.messages[last].content.trim(), result = body.messages.slice(last + 1).find((m) => m.role === 'tool')
    assert.ok(['post', 'body', 'get', 'redirect', 'failed'].includes(mode))
    const tool = body.tools.find((t) => t.function.name === 'http_fetch')
    assert.deepEqual(Object.keys(tool.function.parameters.properties), ['url'])
    if (result && ['post', 'body'].includes(mode)) assert.match(result.content, /error|invalid|unsupported/i)
    if (result && mode === 'get') assert.match(result.content, /GET_RECEIPT/)
    const args = { url: `${url}/${['get', 'post', 'body'].includes(mode) ? 'effect' : mode}` }
    if (mode === 'post') args.method = 'POST'
    if (mode === 'body') args.body = '{"mutation":true}'
    const message = result ? { role: 'assistant', content: `DONE_${mode}` }
      : { role: 'assistant', content: '', tool_calls: [{ id: mode, type: 'function', function: { name: 'http_fetch', arguments: JSON.stringify(args) } }] }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: result ? 'stop' : 'tool_calls', message }] }))
  } catch (error) {
    failures.push(error)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] }))
  }
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
  await client.start()
  await client.call('session/new', { name: sessionId }); created = true
  await client.call('harness/session/configure', { sessionId, config: {
    url: `${url}/model`, model: 'fetch-fixture', key: '', headers: [],
    system: 'Test fixture', 'max-context': 100000, tools: ['web'],
  } })
  for (const mode of ['post', 'body', 'get', 'redirect', 'failed']) {
    await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: mode }] })
    if (failures.length) throw new AggregateError(failures)
    const snapshot = await client.call('harness/session/snapshot', { sessionId })
    assert.ok(snapshot.entries.some((e) => e.body === `DONE_${mode}`))
    if (['post', 'body'].includes(mode)) assert.equal(effects.length, 0, 'mutation arguments must never dispatch')
  }
  assert.deepEqual(effects.map((r) => [r.path, r.method]), [['/effect', 'GET'], ['/redirect', 'GET'], ['/failed', 'GET']])
  assert.ok(effects.every((r) => r.authorization === undefined))
  console.log('PASS native GET-only fetch, no mutation/body dispatch, no injected credentials, no redirect following and no transport retry')
} finally {
  if (created) {
    await client.call('session/cancel', { sessionId })
    await client.call('session/delete', { sessionId })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
