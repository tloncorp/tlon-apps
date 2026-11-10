// Deterministic app-server protocol fixture. No model or repository changes.
import { createInterface } from 'node:readline'
import { appendFileSync } from 'node:fs'
const trace = process.argv[2]
const send = frame => process.stdout.write(`${JSON.stringify(frame)}\n`)
const notification = (method, params) => send({ method, params: { threadId: 'codex-fixture', ...params } })
for await (const line of createInterface({ input: process.stdin })) {
  const frame = JSON.parse(line)
  appendFileSync(trace, `${JSON.stringify(frame)}\n`)
  const { id, method, params } = frame
  if (method === 'initialize') send({ id, result: {} })
  if (method === 'thread/start' || method === 'thread/resume') send({ id, result: { thread: { id: 'codex-fixture' } } })
  if (method === 'turn/start') {
    notification('turn/started', { turn: { id: 'turn-1' } })
    send({ id, result: { turn: { id: 'turn-1' } } })
    if (params.input[0].text === 'hang') continue
    send({ id: 'approval', method: 'item/commandExecution/requestApproval', params: {} })
    notification('item/reasoning/summaryTextDelta', { turnId: 'turn-1', delta: 'PRIVATE THOUGHT' })
    notification('item/agentMessage/delta', { turnId: 'wrong-turn', delta: 'WRONG TURN' })
    notification('item/agentMessage/delta', { turnId: 'turn-1', delta: 'Codex reply' })
    notification('turn/completed', { turn: { id: 'turn-1', status: 'completed' } })
  }
  if (method === 'turn/interrupt') {
    send({ id, result: {} })
    notification('turn/completed', { turn: { id: 'turn-1', status: 'interrupted' } })
  }
}
