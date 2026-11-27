// Real ACP, Iris and the hosted Spider thread; only a local model fixture.
// The hosted token-usage read counts each answered request's tokens once.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client, base, cookie } from './lib/ship-client.mjs'

const client = new Client()
const server = createServer(async (req, res) => {
  await readText(req)
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify({
    choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'Counted.' } }],
    usage: { prompt_tokens: 30, completion_tokens: 12 },
  }))
})
async function hosted(thread) {
  const response = await fetch(`${base}/spider/harness/json/${thread}/json.json`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: '{}', signal: AbortSignal.timeout(20_000),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.status, 200)
  return result.body
}
let sid
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const url = `http://127.0.0.1:${server.address().port}/completions`
  await client.start()

  assert.equal((await hosted('hosted-capabilities')).tokenUsage, true)
  const before = await hosted('hosted-token-usage')
  const today = new Date().toISOString().slice(0, 10)
  assert.equal(before.startDate, `${today.slice(0, 8)}01`)
  assert.equal(before.endDate, today)
  assert.equal(before.keyAttribution, 'unavailable')
  assert.deepEqual(before.byProvider, [])
  assert.equal(before.cacheStatus, undefined, 'the count is never partial')
  assert.ok(Math.abs(before.updatedAt - Date.now()) < 60_000)

  ;({ sessionId: sid } = await client.call('session/new', { name: `usage-${randomUUID().slice(0, 8)}` }))
  await client.call('harness/session/configure', { sessionId: sid, config: {
    url, model: 'fixture-model', key: '', headers: [], 'max-context': 123456,
    system: 'Answer briefly.', tools: [],
  } })
  const done = await client.call('session/prompt', { sessionId: sid, prompt: [{ type: 'text', text: 'Count this.' }] })
  assert.equal(done.stopReason, 'end_turn')

  const after = await hosted('hosted-token-usage')
  const { input, output, cacheRead, cacheWrite, totalTokens } = before.totals
  assert.deepEqual(after.totals, {
    input: input + 30, output: output + 12, cacheRead, cacheWrite, totalTokens: totalTokens + 42,
  })
  console.log('Hosted token usage counts an answered request once: PASS')
} finally {
  try { if (sid) await client.call('session/delete', { sessionId: sid }).catch(() => {}) }
  finally {
    await client.close()
    server.close()
  }
}
