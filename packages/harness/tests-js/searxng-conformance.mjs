// Real ACP/head/Iris, local fake SearXNG. Restores shared provider selection;
// never reads or changes Brave credentials and never calls a real search API.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), grants = new GrantedTurns(client), sessions = [], failures = []
const query = 'site:example.org a & + % café 日本'
let original, url, mode, receipt, searches = 0
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    if (req.url === '/prefix/search') {
      searches++
      assert.equal(req.method, 'POST')
      assert.equal(req.headers['content-type'], 'application/x-www-form-urlencoded')
      assert.equal(req.headers['x-subscription-token'], undefined)
      const form = new URLSearchParams(raw)
      assert.equal(form.get('q'), query)
      assert.equal(form.get('format'), 'json')
      // A settings edit while Iris is waiting must not change response parsing.
      await client.call('harness/search/configure', { config: { provider: 'brave', 'instance-url': `${url}/prefix` } })
      res.writeHead(mode === 'forbidden' ? 403 : 200, { 'content-type': 'application/json' })
      res.end(mode === 'forbidden' ? 'PRIVATE_ERROR_BODY' : JSON.stringify({ results: [
        { title: 'Fixture', url: 'https://result.example', content: 'SearXNG excerpt', private: 'DO_NOT_COPY' },
      ] }))
      return
    }
    assert.equal(req.url, '/completions')
    const body = JSON.parse(raw)
    receipt = body.messages.find((m) => m.role === 'tool')?.content
    const calls = receipt ? [] : [{ id: 'search', type: 'function', function: { name: 'web_search', arguments: JSON.stringify({ query, url: 'http://must-not-use.invalid', provider: 'brave' }) } }]
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
      role: 'assistant', content: calls.length ? '' : 'SEARCH_OK', ...(calls.length ? { tool_calls: calls } : {}),
    } }], usage: { prompt_tokens: 20, completion_tokens: 10 } }))
  } catch (error) { failures.push(error); res.writeHead(500); res.end('fixture assertion failed') }
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
  await client.start()
  original = await client.call('harness/search')
  await assert.rejects(client.call('harness/search/configure', { config: { provider: 'searxng', 'instance-url': '' } }), /instance URL/)
  for (const next of ['success', 'forbidden', 'denied']) {
    mode = next; receipt = undefined
    const before = searches
    await client.call('harness/search/configure', { config: { provider: 'searxng', 'instance-url': `${url}/prefix/` } })
    const { sessionId } = await client.call('session/new', { name: `search-${randomUUID()}` })
    sessions.push(sessionId)
    await client.call('harness/session/configure', { sessionId, config: {
      url: `${url}/completions`, model: 'fixture', key: '', headers: [], system: 'Fixture', 'max-context': 80000, tools: mode === 'denied' ? [] : ['web'],
    } })
    await grants.prompt(sessionId, 'Search.')
    assert.equal(searches - before, mode === 'denied' ? 0 : 1)
    if (mode === 'success') { assert.match(receipt, /SearXNG excerpt/); assert.match(receipt, /https:\/\/result.example/); assert.ok(!receipt.includes('DO_NOT_COPY')) }
    if (mode === 'forbidden') { assert.match(receipt, /search.formats/); assert.ok(!receipt.includes('PRIVATE_ERROR_BODY')) }
    if (mode === 'denied') assert.match(receipt, /not granted/)
  }
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ ok: true, unicodeFormRoundtrip: true, providerChangeInFlight: true, jsonDisabledFeedback: true, webGrantEnforced: true }))
} finally {
  await grants.close().catch(() => {})
  if (original) await client.call('harness/search/configure', { config: original })
  for (const sessionId of sessions) await client.call('session/delete', { sessionId }).catch(() => {})
  await client.close(); server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  if (failures.length) throw new AggregateError(failures, 'Fixture assertions failed')
}
