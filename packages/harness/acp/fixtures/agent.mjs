// Deterministic ACP subprocess for provider tests. No model, shell, or repo edits.
import { createInterface } from 'node:readline'
import { appendFileSync } from 'node:fs'
import { spawn } from 'node:child_process'

const trace = process.argv[2]
const options = new Set(process.argv.slice(3))
const send = frame => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...frame })}\n`)
const result = (id, value) => send({ id, result: value })
const update = (sessionUpdate, content, sessionId = 'fixture-session') => send({ method: 'session/update', params: { sessionId, update: { sessionUpdate, content } } })
let pending, permission
let mcp, mcpId = 0
const mcpPending = new Map()
const mcpRequest = (method, params) => new Promise((resolve, reject) => {
  const id = ++mcpId
  mcpPending.set(id, { resolve, reject })
  mcp.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id, method, params })}\n`)
})
async function connectTools(servers) {
  if (!servers.length) return
  const server = servers[0]
  mcp = spawn(server.command, server.args, { env: { ...process.env, ...Object.fromEntries(server.env.map(({ name, value }) => [name, value])) }, stdio: ['pipe', 'pipe', 'inherit'] })
  createInterface({ input: mcp.stdout }).on('line', line => {
    const frame = JSON.parse(line)
    const request = mcpPending.get(frame.id)
    if (!request) return
    mcpPending.delete(frame.id)
    if (frame.error) request.reject(new Error(frame.error.message))
    else request.resolve(frame.result)
  })
  await mcpRequest('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } })
  await mcpRequest('tools/list', {})
}
async function useTools(id, text) {
  const call = (name, args) => mcpRequest('tools/call', { name, arguments: args })
  const catalog = await call('list_tools', {})
  const schema = await call('list_tools', { name: 'current_time' })
  if (text === 'relay-discover') return finish(id, JSON.stringify({ catalog, schema }))
  update('agent_message_chunk', { type: 'text', text: 'Checking ship. ' })
  const first = call('call_tool', { name: 'current_time', arguments: {} })
  if (text === 'relay-parallel') {
    const second = call('call_tool', { name: 'calculate', arguments: { operation: 'sum', values: [1, 1] } })
    finish(id, JSON.stringify(await Promise.all([first, second])))
  } else {
    const result = await first
    if (text === 'relay-twice') {
      const second = await call('call_tool', { name: 'calculate', arguments: { operation: 'sum', values: [1, 1] } })
      finish(id, JSON.stringify([result, second]))
    } else finish(id, JSON.stringify(result))
  }
}
const finish = (id, text, stopReason = 'end_turn') => {
  if (text) update('agent_message_chunk', { type: 'text', text })
  result(id, { stopReason })
}
for await (const line of createInterface({ input: process.stdin })) {
  const frame = JSON.parse(line)
  appendFileSync(trace, `${JSON.stringify(frame)}\n`)
  const { id, method, params } = frame
  if (method === 'initialize') {
    result(id, { protocolVersion: options.has('bad-version') ? 2 : 1, agentCapabilities: { loadSession: !options.has('no-load') } })
  } else if (method === 'session/new') {
    await connectTools(params.mcpServers)
    result(id, { sessionId: 'fixture-session' })
  } else if (method === 'session/load') {
    await connectTools(params.mcpServers)
    update('agent_message_chunk', { type: 'text', text: 'REPLAY MUST NOT LEAK' })
    result(id, {})
  } else if (method === 'session/prompt') {
    const text = params.prompt.at(-1).text.trimEnd()
    if (text.startsWith('relay-')) {
      pending = id
      void useTools(id, text).catch(error => finish(id, error.message))
    } else if (text === 'hang') pending = id
    else if (text === 'crash') process.exit(12)
    else if (text === 'bad-json') process.stdout.write('not json\n')
    else if (text === 'oversized-frame') process.stdout.write('x'.repeat(1024 * 1024 + 1))
    else if (text === 'oversized-reply') finish(id, 'x'.repeat(128 * 1024 + 1))
    else if (text === 'fail') send({ id, error: { code: -32000, message: 'secret-upstream-credential' } })
    else if (text === 'no-text') finish(id, '')
    else if (text === 'cutoff') finish(id, 'partial', 'max_turn_requests')
    else if (text.startsWith('permission:')) {
      permission = id
      send({ id: 'permission-1', method: 'session/request_permission', params: {
        sessionId: text.includes('wrong-session') ? 'another-session' : 'fixture-session',
        toolCall: { toolCallId: 'tool-1', kind: text.split(':')[1], title: 'Fixture action', name: text.split(':')[2] },
        options: [{ optionId: 'once', kind: 'allow_once', name: 'Allow once' }, { optionId: 'always', kind: 'allow_always', name: 'Always' }],
      } })
    } else if (text === 'unsupported-client-method') {
      permission = id
      send({ id: 'unsupported-1', method: 'fs/write_text_file', params: { path: '/not-written', content: 'no' } })
    } else {
      update('agent_message_chunk', { type: 'text', text: 'WRONG SESSION' }, 'another-session')
      update('agent_thought_chunk', { type: 'text', text: 'PRIVATE THOUGHT' })
      finish(id, `Reply: ${text} 🤖`)
    }
  } else if (method === 'session/cancel') {
    if (pending != null && !options.has('ignore-cancel')) { finish(pending, '', 'cancelled'); pending = null }
  } else if (id === 'permission-1' || id === 'unsupported-1') {
    finish(permission, JSON.stringify(frame.result || frame.error))
  }
}
