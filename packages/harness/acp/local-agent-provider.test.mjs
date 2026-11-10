import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { request as httpRequest } from 'node:http'
import { setTimeout as sleep } from 'node:timers/promises'
import { createProvider, decodeRequest } from './local-agent-provider.mjs'

const token = 'test-only-secret-'.repeat(4)
const agentPath = fileURLToPath(new URL('./fixtures/agent.mjs', import.meta.url))
const user = content => ({ role: 'user', content })
const assistant = content => ({ role: 'assistant', content })
const request = (text, extra = {}) => ({ model: 'local-acp', messages: [user(text)], ...extra })

async function fixture(t, options = {}) {
  const root = await mkdtemp(join(tmpdir(), 'harness-acp-provider-'))
  const trace = join(root, 'trace.jsonl')
  const state = join(root, 'state.json')
  const config = { repo: root, state, token, port: 0, command: [process.execPath, agentPath, trace, ...(options.agentOptions || [])], log: () => {}, stderr: 'ignore', ...options }
  const providers = []
  t.after(async () => {
    for (const provider of providers) await provider.close()
    await rm(root, { recursive: true, force: true })
  })
  const start = async () => {
    const provider = await createProvider(config)
    providers.push(provider)
    return provider
  }
  const provider = await start()
  const frames = async () => {
    try { return (await readFile(trace, 'utf8')).trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) } catch (error) {
      if (error.code === 'ENOENT') return []
      throw error
    }
  }
  const post = (body, { target = provider, headers = {}, ...init } = {}) => fetch(`${target.url}/v1/chat/completions`, {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body), ...init,
  })
  return { provider, start, post, frames, root, state, config }
}

async function waitFor(check) {
  for (let i = 0; i < 200; i++) { if (await check()) return; await sleep(10) }
  assert.fail('Timed out waiting for fixture state')
}

const shipTools = ['current_time', 'calculate'].map(name => ({ type: 'function', function: { name, description: `Ship ${name}`, parameters: { type: 'object', properties: {} } } }))
const toolResult = (message, content = 'ship result') => ({ role: 'tool', tool_call_id: message.tool_calls[0].id, content })
const relayBody = (messages, extra = {}) => request('', { messages, tools: shipTools, ...extra })
const health = async provider => (await (await fetch(provider.url + '/health', { headers: { authorization: `Bearer ${token}` } })).json())

test('MCP discovers the intersection of local ceiling and current conversation schemas', async t => {
  const f = await fixture(t, { harnessTools: ['current_time'] })
  const result = await (await f.post(relayBody([user('relay-discover')]))).json()
  const { catalog, schema } = JSON.parse(result.choices[0].message.content)
  assert.deepEqual(JSON.parse(catalog.content[0].text).map(tool => tool.name), ['current_time'])
  assert.deepEqual(JSON.parse(schema.content[0].text).inputSchema, shipTools[0].function.parameters)
  const server = (await f.frames()).find(frame => frame.method === 'session/new').params.mcpServers[0]
  const relayToken = server.env.find(item => item.name === 'HARNESS_TOOL_RELAY_TOKEN').value
  assert.notEqual(relayToken, token)
  assert.equal((await fetch(f.provider.url + '/cancel', { method: 'POST', headers: { authorization: `Bearer ${relayToken}` } })).status, 401)
  assert.equal((await fetch(f.provider.url + '/internal/harness-tools', { method: 'POST', headers: { authorization: `Bearer ${token}` } })).status, 401)
})

for (const mode of ['relay-once', 'relay-twice', 'relay-parallel']) {
  test(`MCP ${mode} resumes one ACP prompt through native Harness tool results`, async t => {
    const f = await fixture(t, { harnessTools: ['*'] })
    let messages = [user(mode)]
    const firstRequest = relayBody(messages)
    let response = await (await f.post(firstRequest)).json()
    assert.equal(response.choices[0].finish_reason, 'tool_calls')
    assert.equal(response.choices[0].message.content, 'Checking ship. ')
    let count = 0
    while (response.choices[0].finish_reason === 'tool_calls') {
      const message = response.choices[0].message
      assert.equal(message.tool_calls.length, 1)
      assert.equal(message.tool_calls[0].function.name, count === 0 ? 'current_time' : 'calculate')
      assert.equal((await health(f.provider)).waitingForTool, true)
      messages = [...messages, message, toolResult(message, `result-${++count}`)]
      response = await (await f.post(relayBody(messages))).json()
    }
    assert.equal(count, mode === 'relay-once' ? 1 : 2)
    assert.match(response.choices[0].message.content, /result-1/)
    assert.deepEqual(await (await f.post(relayBody(messages))).json(), response)
    assert.equal((await f.post(firstRequest)).status, 409)
    assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
    assert.equal((await health(f.provider)).needsInspection, false)
    assert.equal(JSON.parse(await readFile(f.state)).pending, null)
  })
}

test('tool-call SSE matches the persisted continuation, and invalid results do not consume the call', async t => {
  const f = await fixture(t, { harnessTools: ['current_time'] })
  const input = [user('relay-once')]
  const text = await (await f.post(relayBody(input, { stream: true }))).text()
  const frames = text.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)))
  assert.equal(frames.at(-1).choices[0].finish_reason, 'tool_calls')
  assert.ok(text.endsWith('data: [DONE]\n\n'))
  const persisted = JSON.parse(await readFile(f.state))
  const message = persisted.history.at(-1)
  assert.equal(frames.map(frame => frame.choices[0].delta.content || '').join(''), message.content)
  const call = frames.flatMap(frame => frame.choices[0].delta.tool_calls || [])[0]
  assert.equal(call.id, message.tool_calls[0].id)
  assert.equal((await f.post(relayBody([...persisted.history, { ...toolResult(message), tool_call_id: 'wrong' }]))).status, 409)
  assert.equal((await f.post(relayBody([user('changed'), message, toolResult(message)]))).status, 409)
  assert.equal((await f.post(relayBody(input))).status, 409)
  assert.equal((await health(f.provider)).waitingForTool, true)
  const response = await f.post(relayBody([...persisted.history, toolResult(message, 'error: permission revoked')]))
  assert.match((await response.json()).choices[0].message.content, /permission revoked/)
})

test('queued tools use the refreshed catalog and revoked tools never reach Harness', async t => {
  const f = await fixture(t, { harnessTools: ['*'] })
  const input = [user('relay-parallel')]
  const message = (await (await f.post(relayBody(input))).json()).choices[0].message
  const response = await (await f.post(relayBody([...input, message, toolResult(message)], { tool_choice: 'none' }))).json()
  assert.equal(response.choices[0].finish_reason, 'stop')
  assert.match(response.choices[0].message.content, /isError/)
  assert.match(response.choices[0].message.content, /not available|unavailable/)
  assert.equal(JSON.parse(await readFile(f.state)).receipts.filter(receipt => receipt.calls.length).length, 1)
})

for (const action of ['cancel', 'timeout', 'restart']) {
  test(`parked tool ${action} fences the conversation without replay`, async t => {
    const f = await fixture(t, { harnessTools: ['current_time'], ...(action === 'timeout' ? { toolTimeoutMs: 150 } : {}) })
    const input = [user('relay-once')]
    const message = (await (await f.post(relayBody(input))).json()).choices[0].message
    let target = f.provider
    if (action === 'cancel') assert.equal((await fetch(target.url + '/cancel', { method: 'POST', headers: { authorization: `Bearer ${token}` } })).status, 200)
    else if (action === 'timeout') await waitFor(async () => (await health(target)).needsInspection)
    else { await target.close(); target = await f.start() }
    assert.equal((await f.post(relayBody([...input, message, toolResult(message)]), { target })).status, 409)
    assert.equal((await f.post(relayBody(input), { target })).status, 409)
    assert.ok(JSON.parse(await readFile(f.state)).pending)
    assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
  })
}

for (const [name, outcome] of [['mcp__harness__list_tools', 'selected'], ['mcp__harness__call_tool', 'selected'], ['mcp__other__call_tool', 'cancelled']]) {
  test(`relay permission is scoped to exact wrapper name: ${name}`, async t => {
    const f = await fixture(t, { harnessTools: ['current_time'] })
    const response = await (await f.post(request(`permission:other:${name}`))).json()
    assert.equal(JSON.parse(response.choices[0].message.content).outcome.outcome, outcome)
  })
}

test('text JSON response, fixed cwd, minimal capabilities, and private journal', async t => {
  const f = await fixture(t)
  const response = await f.post(request('hello'))
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.choices[0].message.content, 'Reply: hello 🤖')
  assert.equal(body.choices[0].finish_reason, 'stop')
  const frames = await f.frames()
  assert.deepEqual(frames.find(frame => frame.method === 'initialize').params.clientCapabilities, {})
  assert.deepEqual(frames.find(frame => frame.method === 'session/new').params, { cwd: f.root, mcpServers: [] })
  assert.equal((await stat(f.state)).mode & 0o777, 0o600)
  assert.equal(JSON.parse(await readFile(f.state)).pending, null)
})

test('SSE streams text only, ignores thoughts and unrelated sessions, and terminates correctly', async t => {
  const f = await fixture(t)
  const response = await f.post(request('hello', { stream: true }))
  assert.equal(response.headers.get('content-type'), 'text/event-stream')
  const text = await response.text()
  assert.ok(text.endsWith('data: [DONE]\n\n'))
  const frames = text.split('\n').filter(line => line.startsWith('data: {')).map(line => JSON.parse(line.slice(6)))
  assert.equal(frames.map(frame => frame.choices[0].delta.content || '').join(''), 'Reply: hello 🤖')
  assert.equal(frames.at(-1).choices[0].finish_reason, 'stop')
  assert.ok(!text.includes('PRIVATE') && !text.includes('WRONG'))
})

test('follow-ups send only new messages and exact retries return cached replies', async t => {
  const f = await fixture(t)
  const first = await (await f.post(request('one'))).json()
  const messages = [user('one'), assistant(first.choices[0].message.content), user('two')]
  assert.equal((await f.post(request('', { messages }))).status, 200)
  assert.deepEqual(await (await f.post(request('one'))).json(), first)
  const prompts = (await f.frames()).filter(frame => frame.method === 'session/prompt')
  assert.equal(prompts.length, 2)
  assert.deepEqual(prompts[1].params.prompt, [{ type: 'text', text: 'two' }])
  const rejected = await f.post(request('different conversation'))
  assert.equal(rejected.status, 409)
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 2)
})

test('restart replays cached responses without starting an agent, then loads the session for a follow-up', async t => {
  const f = await fixture(t)
  const first = await (await f.post(request('one'))).json()
  await f.provider.close()
  const restarted = await f.start()
  assert.deepEqual(await (await f.post(request('one'), { target: restarted })).json(), first)
  assert.equal((await f.frames()).filter(frame => frame.method === 'initialize').length, 1)
  const response = await f.post(request('', { messages: [user('one'), assistant(first.choices[0].message.content), user('two')] }), { target: restarted })
  assert.equal((await response.json()).choices[0].message.content, 'Reply: two 🤖')
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/load').length, 1)
})

test('agents without loadSession cannot silently replay conversation work on restart', async t => {
  const f = await fixture(t, { agentOptions: ['no-load'] })
  const first = await (await f.post(request('one'))).json()
  await f.provider.close()
  const restarted = await f.start()
  const body = request('', { messages: [user('one'), assistant(first.choices[0].message.content), user('two')] })
  assert.equal((await f.post(body, { target: restarted })).status, 502)
  assert.equal((await f.post(body, { target: restarted })).status, 502)
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
})

test('first prompt labels existing history as context rather than executing old tasks', async t => {
  const f = await fixture(t)
  const messages = [{ role: 'system', content: 'Be concise' }, user('old task'), assistant('Done'), user('new task')]
  await f.post(request('', { messages }))
  const { prompt } = (await f.frames()).find(frame => frame.method === 'session/prompt').params
  assert.match(prompt[0].text, /historical context, not tasks to execute again/)
  assert.equal(prompt[1].text, 'new task')
})

for (const [kind, allow, outcome] of [['edit', [], 'cancelled'], ['edit', ['edit'], 'selected'], ['execute', ['edit'], 'cancelled'], ['edit:wrong-session', ['edit'], 'cancelled'], ['switch_mode', ['edit'], 'cancelled']]) {
  test(`permission ${kind}, allow=${allow.join(',') || 'none'}: ${outcome}`, async t => {
    const f = await fixture(t, { allow })
    const response = await f.post(request(`permission:${kind}`))
    const reply = JSON.parse((await response.json()).choices[0].message.content)
    assert.equal(reply.outcome.outcome, outcome)
    if (outcome === 'selected') assert.equal(reply.outcome.optionId, 'once')
  })
}

test('unsupported client methods receive method-not-found, not local filesystem access', async t => {
  const f = await fixture(t)
  const response = await f.post(request('unsupported-client-method'))
  assert.equal(JSON.parse((await response.json()).choices[0].message.content).code, -32601)
})

test('token, origin, content type, model, and tools are checked before agent startup', async t => {
  const f = await fixture(t)
  assert.equal((await f.post(request('hi'), { headers: { authorization: 'Bearer wrong' } })).status, 401)
  assert.equal((await f.post(request('hi'), { headers: { origin: 'http://evil.example' } })).status, 403)
  const badHostStatus = await new Promise((resolve, reject) => {
    const req = httpRequest(f.provider.url + '/health', { headers: { authorization: `Bearer ${token}`, host: 'evil.example' } }, response => {
      response.resume()
      resolve(response.statusCode)
    })
    req.on('error', reject)
    req.end()
  })
  assert.equal(badHostStatus, 403)
  assert.equal((await f.post(request('hi'), { headers: { 'content-type': 'text/plain' } })).status, 415)
  assert.equal((await f.post(request('hi', { model: 'different' }))).status, 400)
  assert.equal((await f.post(request('hi', { tools: [{ type: 'function' }] }))).status, 400)
  assert.equal((await f.post(request('hi'), { body: '{' })).status, 400)
  assert.equal((await f.post(request('x'.repeat(1024 * 1024)))).status, 413)
  assert.deepEqual(await f.frames(), [])
})

test('input validation rejects non-text, tool history, compaction, and empty prompts', () => {
  for (const body of [request(''), request('x', { stream: 'yes' }), request('x', { messages: [{ role: 'tool', content: 'output' }] }), request('x', { messages: [user([{ type: 'image_url', image_url: { url: 'x' } }])] }), request('x', { messages: [{ role: 'system', content: 'Produce a concise historical checkpoint, not an answer or tool request.' }, user('summarize')] })]) {
    assert.throws(() => decodeRequest(body))
  }
  assert.deepEqual(decodeRequest(request('', { tools: [], messages: [user([{ type: 'text', text: 'hello' }])] })), [user('hello')])
})

test('Harness always-present helper schemas are accepted but are not sent to ACP', async t => {
  const source = await readFile(new URL('../desk/lib/harness-tools.hoon', import.meta.url), 'utf8')
  const definitions = source.split('++  core-defs\n')[1].split('\n++  ')[0]
  const names = [...definitions.matchAll(/%[-^]\s+fun(?:-json)?\s+(?::\*\s+)?'([^']+)'/g)].map(match => match[1])
  assert.ok(names.length > 0)
  const tools = [...names, 'tlon_send_reply', 'harness_admin'].map(name => ({ type: 'function', function: { name } }))
  const f = await fixture(t)
  assert.equal((await f.post(request('hello', { tools }))).status, 200)
  const frames = await f.frames()
  assert.deepEqual(frames.find(frame => frame.method === 'session/new').params.mcpServers, [])
  assert.deepEqual(frames.find(frame => frame.method === 'session/prompt').params.prompt, [{ type: 'text', text: 'hello' }])
})

test('in-flight calls reject concurrent prompts; HTTP disconnect cancels and fences retries across restart', async t => {
  const f = await fixture(t)
  const abort = new AbortController()
  const response = await f.post(request('hang', { stream: true }), { signal: abort.signal })
  await waitFor(async () => (await f.frames()).some(frame => frame.method === 'session/prompt'))
  assert.equal((await f.post(request('hang'))).status, 409)
  abort.abort()
  await response.text().catch(() => {})
  await waitFor(async () => (await f.frames()).some(frame => frame.method === 'session/cancel'))
  await f.provider.close()
  const restarted = await f.start()
  assert.equal((await f.post(request('hang'), { target: restarted })).status, 409)
  assert.equal((await f.post(request('another task'), { target: restarted })).status, 409)
  assert.equal((await f.frames()).filter(frame => frame.method === 'session/prompt').length, 1)
})

test('deadline cancels the ACP turn without treating partial work as success', async t => {
  const f = await fixture(t, { timeoutMs: 150 })
  const response = await f.post(request('hang'))
  assert.equal(response.status, 502)
  assert.ok(JSON.parse(await readFile(f.state)).pending)
  assert.ok((await f.frames()).some(frame => frame.method === 'session/cancel'))
})

for (const failure of ['crash', 'bad-json', 'oversized-frame', 'oversized-reply', 'fail', 'no-text', 'cutoff']) {
  test(`agent failure (${failure}) fences the session, with no automatic replay`, async t => {
    const f = await fixture(t)
    const response = await f.post(request(failure, { stream: true }))
    const text = await response.text()
    assert.match(text, /local_agent_error/)
    assert.ok(!text.includes('[DONE]') && !text.includes('secret-upstream-credential'))
    assert.equal((await f.post(request(failure))).status, 409)
    assert.ok(JSON.parse(await readFile(f.state)).pending)
  })
}

test('exclusive state lock, configuration identity, and uncertain journal survive restarts', async t => {
  const f = await fixture(t)
  await assert.rejects(createProvider(f.config), /locked/)
  await f.provider.close()
  await assert.rejects(createProvider({ ...f.config, allow: ['edit'] }), /does not match/)
  const state = JSON.parse(await readFile(f.state))
  state.sessionId = 'fixture-session'
  state.pending = { hash: 'a'.repeat(64), at: new Date().toISOString() }
  await writeFile(f.state, JSON.stringify(state))
  const restarted = await f.start()
  assert.equal((await f.post(request('hello'), { target: restarted })).status, 409)
  assert.deepEqual(await f.frames(), [])
})

test('authenticated health and model discovery never start the coding agent', async t => {
  const f = await fixture(t)
  for (const route of ['/health', '/v1/models']) {
    assert.equal((await fetch(f.provider.url + route)).status, 401)
    assert.equal((await fetch(f.provider.url + route, { headers: { authorization: `Bearer ${token}` } })).status, 200)
  }
  assert.deepEqual(await f.frames(), [])
})

test('shutdown while reading an HTTP request does not start an agent or release the lock early', async t => {
  const f = await fixture(t)
  const req = httpRequest(f.provider.url + '/v1/chat/completions', { method: 'POST', headers: {
    authorization: `Bearer ${token}`, 'content-type': 'application/json', 'content-length': '1000',
  } })
  req.on('error', () => {})
  req.write('{')
  await waitFor(async () => (await (await fetch(f.provider.url + '/health', { headers: { authorization: `Bearer ${token}` } })).json()).busy)
  await f.provider.close()
  req.destroy()
  assert.deepEqual(await f.frames(), [])
  assert.equal(JSON.parse(await readFile(f.state)).pending, null)
  await f.start()
})

test('an unresponsive agent is terminated after cancellation grace', async t => {
  const f = await fixture(t, { agentOptions: ['ignore-cancel'], timeoutMs: 150 })
  const response = await f.post(request('hang'))
  assert.equal(response.status, 502)
  assert.ok(JSON.parse(await readFile(f.state)).pending)
  assert.equal((await f.post(request('hang'))).status, 409)
})

test('malformed saved state is rejected without agent execution', async t => {
  const f = await fixture(t)
  await f.provider.close()
  const state = JSON.parse(await readFile(f.state))
  state.receipts = [{}]
  await writeFile(f.state, JSON.stringify(state))
  await assert.rejects(f.start(), /does not match/)
  assert.deepEqual(await f.frames(), [])
})
