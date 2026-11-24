// Opt-in real device-route smoke test. Uses saved credentials, creates only
// temporary sessions, and never changes defaults or credentials. TOOLS_SMOKE=1
// also exercises MCP discovery and Brave search with their existing grants.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { PROVIDERS } from '../acp/providers.mjs'

assert.equal(process.env.OPENAI_DEVICE_SMOKE, '1', 'Set OPENAI_DEVICE_SMOKE=1 to make a real device-authenticated model request')
const client = new Client(), sessions = []
const prompt = (sessionId) => client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: 'Reply with exactly DEVICE_ROUTE_OK.' }] })
try {
  await client.start()
  const status = await client.call('harness/status', { provider: 'openai' })
  assert.equal(status['has-device-login'], true, 'A saved OpenAI device login is required')
  const defaults = await client.call('harness/defaults')
  async function make(url, tools = []) {
    const { sessionId } = await client.call('session/new', { name: `auth-check-${randomUUID().slice(0, 8)}` })
    sessions.push(sessionId)
    await client.call('harness/session/configure', { sessionId, config: {
      ...defaults, url, model: process.env.SMOKE_MODEL || PROVIDERS.openai.deviceModel,
      key: '', headers: [], tools, system: 'Follow the requested response format.', 'max-context': 80000,
    } })
    return sessionId
  }
  // When only device auth exists, an API-configured session must fail locally,
  // not forward the device token to the API or silently switch authentication.
  if (!status['has-api-key']) {
    const sid = await make(PROVIDERS.openai.endpoint)
    await assert.rejects(prompt(sid), /API key is selected but no OpenAI API key/)
    const response = await fetch(`${base}/~/scry/harness/events/${encodeURIComponent(sid)}.json`, { headers: { cookie } })
    assert.ok(response.ok)
    const events = await response.json()
    assert.ok(!events.some((event) => event.type === 'llm-requested'), 'missing API auth must not dispatch inference')
  }
  const sid = await make(PROVIDERS.openai.deviceEndpoint)
  const started = Date.now()
  assert.equal((await prompt(sid)).stopReason, 'end_turn')
  const snapshot = await client.call('harness/session/snapshot', { sessionId: sid })
  assert.equal(snapshot.phase, 'idle')
  assert.match(snapshot.entries.at(-1).body, /DEVICE_ROUTE_OK/)
  console.log(JSON.stringify({ ok: true, auth: 'device', elapsedMs: Date.now() - started,
    missingApiRejectedLocally: !status['has-api-key'], usage: snapshot.usage }, null, 2))
  if (process.env.TOOLS_SMOKE === '1') {
    const brave = await client.call('harness/status', { provider: 'brave' })
    for (const [family, name, question] of [
      ['mcp', 'list_mcp_servers', 'Discover which MCP servers are available using the appropriate tool. Report only their count; do not ask me for server IDs.'],
      ['web', 'web_search', 'Search the web for Urbit documentation about nouns using web_search. Give one sentence with a source link.'],
    ]) {
      if (family === 'web' && !brave['has-key']) continue
      const grants = family === 'mcp' ? (await client.call('harness/mcp/servers')).map((server) => ({ mcp: server.id })) : [family]
      if (!grants.length) continue
      const sid = await make(PROVIDERS.openai.deviceEndpoint, grants)
      await client.call('session/prompt', { sessionId: sid, prompt: [{ type: 'text', text: question }] })
      const response = await fetch(`${base}/~/scry/harness/events/${encodeURIComponent(sid)}.json`, { headers: { cookie } })
      const events = await response.json()
      assert.ok(events.some((event) => event.type === 'tool' && event.name === name), `${name} must actually run`)
      const completed = events.find((event) => event.type === 'tool' && event.name === name)
      if (family === 'web') assert.match(completed.body, /Web search results/)
      console.log(JSON.stringify({ ok: true, auth: 'device', tool: name }))
    }
  }
} finally {
  for (const sessionId of sessions) {
    await client.call('session/cancel', { sessionId }).catch(() => {})
    await client.call('session/delete', { sessionId }).catch(() => {})
  }
  await client.close()
}
