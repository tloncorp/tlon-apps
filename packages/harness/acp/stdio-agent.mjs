import { spawn } from 'node:child_process'

// ACP v1 over a local process's NDJSON streams. This client offers no filesystem
// or terminal methods: the agent uses its own tools and local permission rules.
export class StdioAgent {
  constructor(command, { cwd, onUpdate, onPermission, stderr = 'inherit' }) {
    this.pending = new Map()
    this.nextId = 0
    this.onUpdate = onUpdate
    this.onPermission = onPermission
    this.buffer = Buffer.alloc(0)
    const env = { ...process.env }
    delete env.HARNESS_ACP_TOKEN
    delete env.HARNESS_RUNNER_KEY
    this.child = spawn(command[0], command.slice(1), {
      cwd, env, stdio: ['pipe', 'pipe', stderr], detached: true, shell: false,
    })
    this.exited = new Promise(resolve => this.child.once('close', resolve))
    this.child.on('error', () => this.fail(new Error('Cannot launch ACP agent; check the configured executable.')))
    this.child.on('exit', () => this.fail(new Error('ACP agent exited.')))
    this.child.stdin.on('error', () => this.fail(new Error('ACP agent input closed.')))
    this.child.stdout.on('data', chunk => {
      try {
        this.buffer = Buffer.concat([this.buffer, chunk])
        let end
        while ((end = this.buffer.indexOf(10)) !== -1) {
          if (end > 1024 * 1024) throw new Error('ACP frame exceeds 1 MiB.')
          const line = this.buffer.subarray(0, end).toString('utf8').trim()
          this.buffer = this.buffer.subarray(end + 1)
          if (line) this.receive(JSON.parse(line))
        }
        if (this.buffer.length > 1024 * 1024) throw new Error('ACP frame exceeds 1 MiB.')
      } catch {
        this.fail(new Error('Invalid or oversized ACP output.'))
        void this.close()
      }
    })
  }

  send(frame) {
    if (this.failure) throw this.failure
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', ...frame })}\n`)
  }

  notify(method, params) { this.send({ method, params }) }

  request(method, params, timeoutMs = 30_000) {
    if (this.failure) return Promise.reject(this.failure)
    const id = ++this.nextId
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.fail(new Error(`ACP ${method} timed out.`))
        void this.close()
      }, timeoutMs)
      this.pending.set(id, {
        resolve: value => { clearTimeout(timer); resolve(value) },
        reject: error => { clearTimeout(timer); reject(error) },
      })
      try { this.send({ id, method, params }) } catch (error) { this.fail(error) }
    })
  }

  receive(frame) {
    if (frame.jsonrpc !== '2.0') throw new Error('Expected JSON-RPC 2.0.')
    if (frame.method && frame.id != null) {
      if (frame.method === 'session/request_permission') {
        this.send({ id: frame.id, result: this.onPermission(frame.params) })
      } else {
        this.send({ id: frame.id, error: { code: -32601, message: 'Client method is not supported.' } })
      }
    } else if (frame.method === 'session/update') {
      this.onUpdate(frame.params)
    } else if (frame.id != null) {
      const pending = this.pending.get(frame.id)
      if (!pending) return
      this.pending.delete(frame.id)
      // Agent error text can contain local paths or credentials. Keep it local.
      if (frame.error) pending.reject(new Error('ACP request failed; inspect the agent locally.'))
      else if ('result' in frame) pending.resolve(frame.result)
      else pending.reject(new Error('ACP response has no result.'))
    }
  }

  fail(error) {
    this.failure ??= error
    for (const pending of this.pending.values()) pending.reject(this.failure)
    this.pending.clear()
  }

  async close() {
    if (this.closing) return this.closing
    this.closing = (async () => {
      this.fail(new Error('ACP agent connection closed.'))
      const kill = signal => {
        if (!this.child.pid) return
        try { process.kill(-this.child.pid, signal) } catch (error) {
          if (error.code !== 'ESRCH') throw error
        }
      }
      kill('SIGTERM')
      const timer = setTimeout(() => kill('SIGKILL'), 1000)
      try { await this.exited } finally { clearTimeout(timer) }
    })()
    return this.closing
  }
}
