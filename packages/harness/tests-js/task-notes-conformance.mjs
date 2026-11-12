// Local delegation keeps useful tools and returns to the caller without work records.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client, base, cookie } from './lib/ship-client.mjs'

assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
assert.ok(process.env.SOAK_EXPECT_SHIP?.startsWith('~'))
const identity = await fetch(`${base}/~/name`, { headers: { cookie }, redirect: 'error' })
assert.ok(identity.ok)
assert.equal((await identity.text()).trim().replace(/^"|"$/g, ''), process.env.SOAK_EXPECT_SHIP)
const client = new Client(), session = `notes-delegation-${randomUUID().slice(0, 8)}`
let started = false, calls = 0, childCalls = 0, failure
const server = createServer(async (req, res) => {
  try {
    calls++
    const raw = await readText(req)
    const body = JSON.parse(raw)
    const child = body.messages.some(m => m.role === 'system' && m.content.includes('You are a subagent'))
    let message
    if (child) {
      childCalls++
      assert.ok(body.tools.some(t => t.function.name === 'web_search'), 'Delegation retains granted research tools')
      assert.ok(body.tools.some(t => t.function.name === 'workspace'), 'Delegation retains scoped record tools')
      message = { role: 'assistant', content: '893' }
    } else {
      const result = body.messages.findLast(m => m.role === 'tool')
      if (result) {
        assert.match(result.content, /893/, 'The child answer returns through the normal tool result')
        message = { role: 'assistant', content: '47 × 19 = 893.' }
      } else message = { role: 'assistant', content: '', tool_calls: [{ id: 'arithmetic', type: 'function', function: {
        name: 'run_subagent', arguments: JSON.stringify({ prompt: 'Calculate 47 times 19. Return just the number.' }),
      } }] }
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: message.tool_calls ? 'tool_calls' : 'stop', message }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
  } catch (error) { failure = error; res.writeHead(500); res.end('Fixture assertion failed') }
})
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  await client.start(); started = true
  const read = action => client.call('harness/workspace', { action, args: {} })
  const before = { tasks: await read('tasks'), projects: await read('projects') }
  await client.call('session/new', { name: session })
  // Mid-turn growth estimates count the live tool catalog's ~26 kB of JSON as tokens;
  // a 32k window would compact on the ship's default route instead of this fixture.
  await client.call('harness/session/configure', { sessionId: session, config: {
    url: `http://127.0.0.1:${server.address().port}/completions`, model: 'notes-delegation-fixture',
    key: '', headers: [], tools: ['subagents', 'web', 'workspace'], system: 'Synthetic delegation fixture.', 'max-context': 100_000,
  } })
  await client.call('session/prompt', { sessionId: session, prompt: [{ type: 'text', text: 'Ask a helper to calculate 47 times 19 and tell me the answer.' }] })
  if (failure) throw failure
  const snapshot = await client.call('harness/session/snapshot', { sessionId: session })
  assert.equal(snapshot.entries.at(-1).body, '47 × 19 = 893.')
  assert.equal(calls, 3); assert.equal(childCalls, 1)
  assert.deepEqual(await read('tasks'), before.tasks)
  assert.deepEqual(await read('projects'), before.projects)
  console.log(JSON.stringify({ session, calls, result: 'Child retains granted tools and returns to the caller; no tasks, projects, claims, or membership changes.' }))
} finally {
  if (started) await client.close()
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
}
