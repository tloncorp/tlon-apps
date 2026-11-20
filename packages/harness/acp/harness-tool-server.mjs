#!/usr/bin/env node
// The ACP agent launches this stdio MCP facade. Its token can only discover
// or enqueue tools for the provider's active turn; it is not a ship login.
import { randomUUID } from 'node:crypto'

const url = process.env.HARNESS_TOOL_RELAY_URL
const token = process.env.HARNESS_TOOL_RELAY_TOKEN
if (!url || !token || !/^http:\/\/127\.0\.0\.1:\d+\/internal\/harness-tools$/.test(url)) {
  throw new Error('This tool server must be launched by the local ACP provider.')
}
const tools = [
  { name: 'list_tools', description: 'List Harness tools available to this conversation. Supply an exact name to retrieve its input schema before calling it.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, additionalProperties: false }, annotations: { readOnlyHint: true } },
  { name: 'call_tool', description: 'Invoke a discovered Harness tool with arguments matching its input schema. Harness checks current permissions. Never automatically repeat an uncertain mutation.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, arguments: { type: 'object' } }, required: ['name', 'arguments'], additionalProperties: false } },
]
const send = frame => process.stdout.write(`${JSON.stringify({ jsonrpc: '2.0', ...frame })}\n`)
const pending = new Map()
const seen = new Set()
let buffer = Buffer.alloc(0), initialized = false

async function handle(frame) {
  if (frame.method === 'notifications/cancelled') { pending.get(frame.params?.requestId)?.abort(); return }
  if (frame.id == null) return
  if (seen.has(frame.id) || seen.size >= 4096 || pending.size >= 32) {
    send({ id: frame.id, error: { code: -32600, message: 'Duplicate request or tool server capacity reached.' } })
    return
  }
  seen.add(frame.id)
  const controller = new AbortController()
  pending.set(frame.id, controller)
  try {
    let result
    if (frame.method === 'initialize') {
      initialized = true
      result = { protocolVersion: '2025-11-25', capabilities: { tools: {} }, serverInfo: { name: 'harness-tools', version: '1' } }
    } else if (!initialized) throw new Error('Initialize the tool server first.')
    else if (frame.method === 'ping') result = {}
    else if (frame.method === 'tools/list') result = { tools }
    else if (frame.method === 'tools/call') {
      const { name, arguments: args = {} } = frame.params || {}
      if (!tools.some(tool => tool.name === name) || !args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Unknown tool or invalid arguments.')
      const response = await fetch(url, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ method: name, params: args, id: randomUUID() }), signal: controller.signal,
      })
      if (!response.ok) throw new Error('Harness tool relay is unavailable. Inspect the turn; do not replay the call.')
      result = await response.json()
    } else {
      send({ id: frame.id, error: { code: -32601, message: 'Method not supported.' } })
      return
    }
    send({ id: frame.id, result })
  } catch (error) {
    if (frame.method === 'tools/call') send({ id: frame.id, result: { isError: true, content: [{ type: 'text', text: error.message }] } })
    else send({ id: frame.id, error: { code: -32602, message: error.message } })
  } finally { pending.delete(frame.id) }
}

process.stdin.on('data', chunk => {
  try {
    buffer = Buffer.concat([buffer, chunk])
    let end
    while ((end = buffer.indexOf(10)) !== -1) {
      if (end > 1024 * 1024) throw new Error('Oversized frame.')
      const line = buffer.subarray(0, end).toString('utf8').trim()
      buffer = buffer.subarray(end + 1)
      if (!line) continue
      const frame = JSON.parse(line)
      if (!frame || frame.jsonrpc !== '2.0') throw new Error('Invalid frame.')
      void handle(frame)
    }
    if (buffer.length > 1024 * 1024) throw new Error('Oversized frame.')
  } catch {
    send({ id: null, error: { code: -32700, message: 'Invalid JSON-RPC frame.' } })
    process.stdin.destroy()
    for (const controller of pending.values()) controller.abort()
  }
})
process.stdin.on('end', () => { for (const controller of pending.values()) controller.abort() })
