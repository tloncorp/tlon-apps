// Local provider only; temporary session, no credentials or defaults changed.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { Client } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), grants = new GrantedTurns(client), failures = []
let sid, receipts = []
const cases = [
  ['scopes', 'list_desk_scopes', {}],
  ['read', 'read_desk_file', { path: '/harness/lib/harness-tools/hoon' }],
  ['list', 'list_desk_files', { path: '/harness/lib' }],
  ['sibling', 'read_desk_file', { path: '/harness/library/private/hoon' }],
  ['parent', 'list_desk_files', { path: '/harness' }],
  ['other', 'read_desk_file', { path: '/base/lib/test/hoon' }],
]
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw)
    receipts = body.messages.filter((m) => m.role === 'tool')
    let calls = receipts.length ? [] : cases.map(([id, name, args]) => ({
      id, type: 'function', function: { name, arguments: JSON.stringify(args) },
    }))
    const listing = receipts.filter((entry) => entry.tool_call_id === 'list' || entry.tool_call_id.startsWith('list-')).at(-1)
    if (listing) {
      const { nextOffset } = JSON.parse(listing.content)
      if (nextOffset !== null) calls = [{ id: `list-${nextOffset}`, type: 'function', function: {
        name: 'list_desk_files', arguments: JSON.stringify({ path: '/harness/lib', offset: nextOffset }),
      } }]
    }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
      role: 'assistant', content: calls.length ? '' : 'CLAY_OK', ...(calls.length ? { tool_calls: calls } : {}),
    } }], usage: { prompt_tokens: 20, completion_tokens: 10 } }))
  } catch (error) { failures.push(error); res.writeHead(500); res.end('fixture assertion failed') }
})
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  ;({ sessionId: sid } = await client.call('session/new', { name: 'Clay scope fixture' }))
  await client.call('harness/session/configure', { sessionId: sid, config: {
    url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture', key: '', headers: [],
    system: 'Fixture', 'max-context': 80000, tools: [{ clay: '/harness/lib' }],
  } })
  await grants.prompt(sid, 'Run the fixture.')
  const result = (id) => receipts.find((r) => r.tool_call_id === id)?.content
  assert.deepEqual(JSON.parse(result('scopes')), ['/harness/lib'])
  const file = JSON.parse(result('read'))
  assert.match(file.text, /Capability catalog/)
  assert.ok(file.revision)
  const paths = receipts.filter((entry) => entry.tool_call_id === 'list' || entry.tool_call_id.startsWith('list-'))
    .flatMap((entry) => JSON.parse(entry.content).items)
  assert.ok(paths.some((path) => path.includes('harness-tools')))
  for (const id of ['sibling', 'parent', 'other']) assert.match(result(id), /not granted/)
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ ok: true, rawSource: true, scopedListing: true, parentSiblingOtherDeskDenied: true }))
} finally {
  await grants.close().catch(() => {})
  if (sid) await client.call('session/delete', { sessionId: sid }).catch(() => {})
  await client.close(); server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
