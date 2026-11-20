// Actual head/Iris effects against a local fixture, with no paid inference.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), grants = new GrantedTurns(client), effects = [], failures = []
const sessionId = `curl-test-${randomUUID().slice(0, 8)}`
let url, created = false
const server = createServer(async (req, res) => {
  const raw = await readText(req)
  if (req.url !== '/model') {
    effects.push({ path: req.url, method: req.method, auth: req.headers.authorization, custom: req.headers['x-explicit'], body: raw })
    if (req.url === '/redirect') { res.writeHead(307, { location: `${url}/sentinel` }); return res.end() }
    if (req.url === '/failed') return res.destroy()
    res.setHeader('x-receipt', 'CURL_HEADER')
    return res.end('CURL_BODY')
  }
  try {
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    const mode = body.messages[last].content.trim(), result = body.messages.slice(last + 1).find((m) => m.role === 'tool')
    assert.ok(['denied', 'patch', 'delete', 'invalid', 'redirect', 'follow', 'failed'].includes(mode))
    const tool = body.tools.find((t) => t.function.name === 'curl')
    assert.equal(Boolean(tool), mode !== 'denied')
    if (tool) assert.equal(tool.function.parameters.properties.headers.type, 'object')
    if (result && ['denied', 'invalid'].includes(mode)) assert.match(result.content, /rejected|error/i)
    if (result && ['patch', 'delete', 'follow'].includes(mode)) {
      assert.match(result.content, /CURL_BODY/); assert.match(result.content, /x-receipt: CURL_HEADER/i)
    }
    const args = { url: `${url}/${['redirect', 'follow'].includes(mode) ? 'redirect' : mode === 'failed' ? 'failed' : 'effect'}`, method: mode === 'delete' ? 'DELETE' : 'PATCH', headers: { Authorization: 'Bearer EXPLICIT_FIXTURE', 'X-Explicit': 'yes' }, body: 'payload' }
    if (mode === 'invalid') args.headers = { 'Bad Header': 'x' }
    if (mode === 'follow') args.redirects = 1
    const message = result ? { role: 'assistant', content: `DONE_${mode}` }
      : { role: 'assistant', content: '', tool_calls: [{ id: mode, type: 'function', function: { name: 'curl', arguments: JSON.stringify(args) } }] }
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
  for (const mode of ['denied', 'patch', 'delete', 'invalid', 'redirect', 'follow', 'failed']) {
    await client.call('harness/session/configure', { sessionId, config: {
      url: `${url}/model`, model: 'curl-fixture', key: '', headers: [], system: 'Fixture',
      'max-context': 100000, tools: mode === 'denied' ? ['web'] : ['curl'],
    } })
    const before = effects.length
    await grants.prompt(sessionId, mode)
    if (failures.length) throw new AggregateError(failures)
    const snapshot = await client.call('harness/session/snapshot', { sessionId })
    assert.ok(snapshot.entries.some((e) => e.body === `DONE_${mode}`))
    assert.equal(effects.length - before, ['denied', 'invalid'].includes(mode) ? 0 : mode === 'follow' ? 2 : 1)
  }
  assert.deepEqual(effects.map((r) => [r.path, r.method]), [['/effect', 'PATCH'], ['/effect', 'DELETE'], ['/redirect', 'PATCH'], ['/redirect', 'PATCH'], ['/sentinel', 'PATCH'], ['/failed', 'PATCH']])
  assert.ok(effects.every((r) => r.auth === 'Bearer EXPLICIT_FIXTURE' && r.custom === 'yes' && r.body === 'payload'))
  console.log('PASS curl separate grant, native mutation methods, explicit headers/body, response headers, opt-in redirects and no retries')
} finally {
  await grants.close().catch(() => {})
  if (created) {
    await client.call('session/cancel', { sessionId })
    await client.call('session/delete', { sessionId })
  }
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
