// Original QuickJS/WASM executor through the real head and Spider, with a
// local deterministic model. No paid inference or unbounded compute loops.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), grants = new GrantedTurns(client), failures = [], effects = [], sessions = []
const prefix = `js-test-${randomUUID().slice(0, 8)}`
let url
const scripts = {
  constant: 'module.exports = () => "WASM_CONSTANT";',
  structured: 'module.exports = () => JSON.stringify({answer: 42, values: [1, 2, 3]});',
  bounded: 'module.exports = () => { let total = 0; for (let i = 0; i < 100; i++) total += i; return total; };',
  syntax: 'module.exports = () => { broken syntax;',
  runtime: 'module.exports = () => { throw new Error("WASM_FIXTURE_ERROR"); };',
  denied: 'module.exports = () => "MUST_NOT_EXECUTE";',
  granted: 'module.exports = () => "WASM_GRANTED";',
  guarded: 'module.exports = () => { while (true) {} };',
  oversized: `module.exports = () => "${'x'.repeat(65536)}";`,
}
const results = new Map()
const server = createServer(async (req, res) => {
  if (req.url !== '/model') {
    effects.push(req.url)
    res.writeHead(200, { 'content-type': 'text/plain' }); res.end('JS_HTTP_FIXTURE'); return
  }
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw), last = body.messages.findLastIndex(m => m.role === 'user')
    const mode = body.messages[last].content.trim()
    const result = body.messages.slice(last + 1).find(m => m.role === 'tool')
    assert.ok(mode in scripts, `Unknown fixture mode ${mode}`)
    const advertised = (body.tools || []).filter(t => t.function.name === 'run_js')
    assert.equal(advertised.length, mode === 'denied' ? 0 : 1)
    if (result) results.set(mode, result.content)
    const message = result ? { role: 'assistant', content: `DONE_${mode}` }
      : { role: 'assistant', content: '', tool_calls: [{ id: `call-${mode}`, type: 'function', function: { name: 'run_js', arguments: JSON.stringify({ code: scripts[mode] }) } }] }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: result ? 'stop' : 'tool_calls', message }] }))
  } catch (error) {
    failures.push(error)
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] }))
  }
})
async function create(mode) {
  const sessionId = `${prefix}-${mode}`
  await client.call('session/new', { name: sessionId }); sessions.push(sessionId)
  await client.call('harness/session/configure', { sessionId, config: {
    url: `${url}/model`, model: 'wasm-fixture', key: '', headers: [], system: 'Fixture',
    'max-context': 1000000, tools: mode === 'denied' ? [] : ['code'],
  } })
  return sessionId
}
const prompt = (sessionId, text) => client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text }] })
// Only these two depend on the grant: a local owner turn gets %code regardless.
const underGrant = new Set(['denied', 'granted'])
async function waitFor(effect) {
  const deadline = Date.now() + 20000
  while (!effects.includes(effect)) {
    if (Date.now() > deadline) throw new Error(`Missing executor effect: ${effect}`)
    if (failures.length) throw new AggregateError(failures)
    await sleep(100)
  }
}
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}`
  scripts.http = `module.exports = () => JSON.stringify(fetch_sync('${url}/http'));`
  for (const mode of ['cancel', 'timeout']) scripts[mode] = `module.exports = () => { fetch_sync('${url}/started-${mode}'); require('urbit_thread').sleep(60); fetch_sync('${url}/late-${mode}'); return 'LATE'; };`
  await client.start()
  assert.ok((await client.call('harness/tools')).includes('code'))
  const defaultTools = (await client.call('harness/defaults')).tools
  assert.ok(!defaultTools.includes('code'), 'Live defaults must remain opted out')
  for (const [mode, pattern] of [
    ['denied', /rejected/], ['granted', /WASM_GRANTED/], ['guarded', /unbounded loop/], ['oversized', /64 KiB/],
    ['constant', /WASM_CONSTANT/], ['structured', /"answer":42/], ['bounded', /4950/],
    ['syntax', /js error|error:/], ['runtime', /WASM_FIXTURE_ERROR/], ['http', /JS_HTTP_FIXTURE/],
  ]) {
    const sid = await create(mode)
    await (underGrant.has(mode) ? grants.prompt(sid, mode) : prompt(sid, mode))
    if (failures.length) throw new AggregateError(failures)
    assert.match(results.get(mode) || '', pattern, mode)
    console.log(`PASS JS ${mode}`)
  }
  const cancelled = await create('cancel')
  const running = prompt(cancelled, 'cancel')
  running.catch(() => {})
  await waitFor('/started-cancel')
  await client.call('session/cancel', { sessionId: cancelled })
  assert.equal((await running).stopReason, 'cancelled')
  assert.ok(!effects.includes('/late-cancel'))
  await prompt(cancelled, 'constant')
  assert.match(results.get('constant'), /WASM_CONSTANT/)
  console.log('PASS JS cancellation and conversation continuation')

  const timed = await create('timeout')
  await prompt(timed, 'timeout')
  assert.match(results.get('timeout') || '', /exceeded its time limit/)
  assert.ok(!effects.includes('/late-timeout'))
  if (failures.length) throw new AggregateError(failures)
  assert.deepEqual((await client.call('harness/defaults')).tools, defaultTools)
  console.log('PASS JS yielding watchdog and unchanged defaults')
} finally {
  await grants.close().catch(() => {})
  for (const sessionId of sessions) {
    await client.call('session/cancel', { sessionId })
    await client.call('session/delete', { sessionId })
  }
  await client.close()
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
}
