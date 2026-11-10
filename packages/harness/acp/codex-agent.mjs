import { StdioAgent } from './stdio-agent.mjs'

// The provider's local session interface translates to Codex app-server RPC.
// Codex remains a local child process; no Codex listener is exposed remotely.
export class CodexAgent extends StdioAgent {
  constructor(command, options) {
    super(command, options)
    this.model = options.model || null
    this.sandbox = options.sandbox || 'read-only'
  }

  send(frame) {
    if (this.failure) throw this.failure
    this.child.stdin.write(`${JSON.stringify(frame)}\n`)
  }

  async request(method, params, timeoutMs) {
    if (method === 'initialize') {
      await super.request('initialize', { clientInfo: { name: 'harness-runner', version: '1' } }, timeoutMs)
      this.send({ method: 'initialized', params: {} })
      return { protocolVersion: 1, agentCapabilities: { loadSession: true } }
    }
    if (method === 'session/new' || method === 'session/load') {
      const mcp = Object.fromEntries(params.mcpServers.map(server => [server.name, {
        command: server.command, args: server.args,
        env: Object.fromEntries(server.env.map(({ name, value }) => [name, value])),
        required: true,
      }]))
      const result = await super.request(method === 'session/new' ? 'thread/start' : 'thread/resume', {
        ...(params.sessionId ? { threadId: params.sessionId } : {}),
        cwd: params.cwd, model: this.model, sandbox: this.sandbox,
        approvalPolicy: 'never', config: { mcp_servers: mcp },
      }, timeoutMs)
      if (!result.thread?.id) throw new Error('Codex returned no thread ID.')
      this.sessionId = result.thread.id
      return { sessionId: this.sessionId }
    }
    if (method !== 'session/prompt') throw new Error('Unsupported local session method.')
    if (this.turn) throw new Error('Codex already has an active turn.')
    let resolve, reject
    const completion = new Promise((yes, no) => { resolve = yes; reject = no })
    void completion.catch(() => {})
    this.turn = { resolve, reject, id: null }
    const timer = setTimeout(() => { this.fail(new Error('Codex turn timed out.')); void this.close() }, timeoutMs)
    try {
      const started = await super.request('turn/start', {
        threadId: this.sessionId,
        input: params.prompt.map(part => ({ type: 'text', text: part.text, text_elements: [] })),
      })
      if (this.turn) this.turn.id ??= started.turn?.id
      return await completion
    } catch (error) {
      // Observe the completion promise if failure happens before turn/start.
      void completion.catch(() => {})
      throw error
    } finally { clearTimeout(timer); this.turn = null }
  }

  notify(method, params) {
    if (method !== 'session/cancel' || !this.turn?.id) return
    void super.request('turn/interrupt', { threadId: params.sessionId, turnId: this.turn.id }, 3000).catch(() => {})
  }

  receive(frame) {
    if (frame.method && frame.id != null) {
      const denied = {
        'item/commandExecution/requestApproval': { decision: 'decline' },
        'item/fileChange/requestApproval': { decision: 'decline' },
        'item/permissions/requestApproval': { permissions: {}, scope: 'turn' },
        'mcpServer/elicitation/request': { action: 'decline', content: null },
        'item/tool/requestUserInput': { answers: {} },
      }[frame.method]
      this.send({ id: frame.id, ...(denied ? { result: denied } : { error: { code: -32601, message: 'Client method is not supported.' } }) })
      return
    }
    if (frame.method) {
      const params = frame.params
      if (!this.turn || params?.threadId !== this.sessionId) return
      if (frame.method === 'turn/started') this.turn.id ??= params.turn?.id
      const id = params.turnId || params.turn?.id
      if (!id || id !== this.turn.id) return
      if (frame.method === 'item/agentMessage/delta' && typeof params.delta === 'string') {
        this.onUpdate({ sessionId: this.sessionId, update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: params.delta } } })
      }
      if (frame.method === 'turn/completed') {
        if (params.turn.status === 'completed') this.turn.resolve({ stopReason: 'end_turn' })
        else this.turn.reject(new Error('Codex turn interrupted; inspect the agent locally.'))
      }
      return
    }
    super.receive({ ...frame, jsonrpc: '2.0' })
  }

  fail(error) {
    super.fail(error)
    this.turn?.reject(error)
  }
}
