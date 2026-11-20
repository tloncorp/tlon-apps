// Pins how saved tool grants apply to a conversation by who is driving it, with a
// local provider and MCP fixture. Only temporary sessions and a uniquely named
// server registration change; the original registry is restored in finally.
//
// A local owner turn ignores the conversation's saved grants: +execution-tools
// replaces them with +owner-tools. If that policy changes, this is the test that
// should be rewritten; the scope tests run under non-owner hand turns regardless.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), grants = new GrantedTurns(client), sessions = [], failures = []
const fixture = `owner-grants-${randomUUID()}`
const families = ['list_desk_scopes', 'web_search', 'curl', 'run_js', 'list_mcp_servers', 'write_skill', 'run_subagent']
let original, turn, delegate = false
const call = (id, name, args = {}) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const server = createServer(async (req, res) => {
  try {
    const body = JSON.parse(await readText(req))
    const names = body.tools.map((entry) => entry.function.name), child = body.messages.some((m) => m.role === 'system' && m.content.includes('You are a subagent'))
    const receipts = body.messages.filter((m) => m.role === 'tool')
    if (child) turn.child = names
    else turn.names = names
    if (receipts.length) (child ? turn.childReceipts = receipts : turn.receipts = receipts)
    const calls = receipts.length ? [] : delegate && !child ? [call('delegate', 'run_subagent', { prompt: 'Report.' })]
      : [call('scopes', 'list_desk_scopes'), call('outside', 'list_desk_files', { path: '/base/sys' }), call('servers', 'list_mcp_servers')]
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
      role: 'assistant', content: calls.length ? '' : 'DONE', ...(calls.length ? { tool_calls: calls } : {}),
    } }], usage: { prompt_tokens: 20, completion_tokens: 10 } }))
  } catch (error) { failures.push(error); res.writeHead(500); res.end('fixture assertion failed') }
})
const conversation = async (name, tools) => {
  const { sessionId } = await client.call('session/new', { name: `${fixture}-${name}` })
  sessions.push(sessionId)
  await client.call('harness/session/configure', { sessionId, config: {
    url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture', key: '', headers: [],
    system: 'Fixture', 'max-context': 80000, tools,
  } })
  return sessionId
}
const receipt = (receipts, id) => receipts.find((entry) => entry.tool_call_id === id).content
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  original = await client.call('harness/mcp/servers')
  await client.call('harness/mcp/configure', { servers: [...original, {
    id: fixture, name: 'Owner grant fixture', url: `http://127.0.0.1:${server.address().port}/mcp`, headers: [], enabled: true,
  }] })

  // The owner's saved grant is empty, yet every configurable family is available
  // and Clay and MCP are unscoped. The saved value is left as the owner wrote it.
  turn = {}
  const owner = await conversation('owner', [])
  await client.call('session/prompt', { sessionId: owner, prompt: [{ type: 'text', text: 'Run the fixture.' }] })
  for (const name of [...families, 'harness_admin']) assert.ok(turn.names.includes(name), `owner turn advertises ${name}`)
  assert.deepEqual(JSON.parse(receipt(turn.receipts, 'scopes')), ['/'])
  assert.doesNotMatch(receipt(turn.receipts, 'outside'), /not granted/)
  assert.ok(JSON.parse(receipt(turn.receipts, 'servers')).some((entry) => entry.id === fixture))
  assert.deepEqual((await client.call('harness/session/config', { sessionId: owner })).tools, [])

  // The same empty grant is a real limit when a non-owner hand drives the turn.
  turn = {}
  const handed = await conversation('hand', [])
  await grants.prompt(handed, 'Run the fixture.')
  for (const name of [...families, 'harness_admin']) assert.ok(!turn.names.includes(name), `hand turn hides ${name}`)
  for (const id of ['scopes', 'outside', 'servers']) assert.match(receipt(turn.receipts, id), /not granted/)

  // Delegation inherits what the owner turn could use, not its saved grant, so a
  // child of this empty-grant owner conversation is unscoped too, without admin.
  turn = {}; delegate = true
  const parent = await conversation('parent', [])
  sessions.push(`${parent}--1--delegate`)
  await client.call('session/prompt', { sessionId: parent, prompt: [{ type: 'text', text: 'Delegate.' }] })
  assert.ok(turn.child.includes('run_js'), 'child inherits owner tools')
  assert.ok(!turn.child.includes('run_subagent'))
  assert.ok(!turn.child.includes('harness_admin'))
  assert.deepEqual(JSON.parse(receipt(turn.childReceipts, 'scopes')), ['/'])

  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ ok: true, ownerIgnoresSavedGrants: true, ownerAdmin: true, handObeysSavedGrants: true, childInheritsOwnerTools: true }))
} finally {
  await grants.close().catch(() => {})
  if (original) await client.call('harness/mcp/configure', { servers: original })
  for (const sessionId of sessions) await client.call('session/delete', { sessionId }).catch(() => {})
  await client.close(); server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
  if (failures.length) throw new AggregateError(failures, 'Fixture assertions failed')
}
