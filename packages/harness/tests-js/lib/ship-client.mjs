import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'

export const base = process.env.SHIP_URL || 'http://127.0.0.1'
const cookiePath = process.env.SHIP_COOKIE
if (!cookiePath) throw new Error('Set SHIP_COOKIE to an authenticated Netscape cookie file.')
export async function readCookie(path) {
  const line = (await readFile(path, 'utf8')).split('\n').find((row) => /\turbauth-~/.test(row))
  if (!line) throw new Error('Ship authentication cookie not found.')
  const fields = line.split('\t')
  return `${fields[5]}=${fields[6]}`
}
export const cookie = await readCookie(cookiePath)

export class Client {
  // .limit bounds one request; .deadline bounds a call, the caller's wait.
  constructor({ url = base, auth = cookie, limit = 15_000, deadline = 90_000 } = {}) {
    this.base = url
    this.cookie = auth
    this.limit = limit; this.deadline = deadline
    // Aborts the poll in flight when the client fails or closes.
    this.stopping = new AbortController()
    this.ship = auth.split('=')[0].slice('urbauth-~'.length)
    this.connection = `conformance-${randomUUID()}`
    this.channel = this.connection
    this.event = 0; this.rpc = 0; this.through = 0; this.acknowledged = 0
    this.pending = new Map(); this.updates = []; this.running = false
  }
  async poke(json) {
    return this.pokeAgent('acp', 'acp-action-1', json)
  }
  async pokeAgent(app, mark, json) {
    const response = await fetch(`${this.base}/~/channel/${this.channel}`, {
      method: 'PUT', headers: { cookie: this.cookie, 'content-type': 'application/json' },
      body: JSON.stringify([{ id: ++this.event, action: 'poke', ship: this.ship, app, mark, json }]),
      signal: AbortSignal.timeout(this.limit),
    })
    assert.ok(response.ok, `poke HTTP ${response.status}`)
  }
  async start() {
    await this.poke({ open: { connection: this.connection } })
    this.running = true
    this.polling = this.poll().catch((error) => {
      this.failure = error
      this.running = false
      for (const value of this.pending.values()) value.reject(error)
      this.pending.clear()
    })
    await this.call('initialize', { protocolVersion: 1, clientInfo: { name: 'harness-conformance', version: '1' } })
  }
  async call(method, params = {}) {
    if (this.failure) throw this.failure
    const id = ++this.rpc
    const result = new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        const error = new Error(`${method} timed out${this.silence()}`)
        // A ship silent for a whole call is down to this client, as a failed
        // poll is: polling stops and every call fails at once with this error.
        if (this.silentSince != null) {
          this.failure = error; this.running = false; this.stopping.abort()
          for (const value of this.pending.values()) value.reject(error)
          this.pending.clear()
        }
        reject(error)
      }, this.deadline)
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value) }, reject: (error) => { clearTimeout(timer); reject(error) } })
    })
    // Register rejection handling before transport can fail.
    const sent = this.poke({ send: { connection: this.connection, target: 'agent', payload: JSON.stringify({ jsonrpc: '2.0', id, method, params }) } })
    return Promise.all([sent, result]).then(([, value]) => value)
  }
  silence() {
    if (this.silentSince == null) return ''
    return `; the ship has not answered GET /~/scry/acp/v1/${this.connection}/client.json for ${((Date.now() - this.silentSince) / 1000).toFixed(1)} s`
  }
  async poll() {
    while (this.running) {
      // A ship busy with one long event answers late, not never: a request
      // that times out is asked again, and a call fails at its own deadline.
      const asked = Date.now()
      let body
      try {
        const response = await fetch(`${this.base}/~/scry/acp/v1/${this.connection}/client.json?_=${Date.now()}`, {
          headers: { cookie: this.cookie, 'cache-control': 'no-cache' },
          signal: AbortSignal.any([AbortSignal.timeout(this.limit), this.stopping.signal]),
        })
        assert.ok(response.ok, `queue HTTP ${response.status}`)
        body = await response.json()
      } catch (error) {
        if (this.stopping.signal.aborted) return
        if (error.name !== 'TimeoutError') throw error
        this.silentSince ??= asked
        continue
      }
      this.silentSince = null
      for (const message of body.messages || []) {
        if (Number(message.sequence) <= this.through) continue
        const frame = JSON.parse(message.payload)
        if (frame.id != null && ('result' in frame || 'error' in frame)) {
          const value = this.pending.get(Number(frame.id))
          this.pending.delete(Number(frame.id))
          if (value) frame.error ? value.reject(new Error(frame.error.message)) : value.resolve(frame.result)
        } else this.updates.push(frame)
        this.through = Number(message.sequence)
      }
      if (this.through > this.acknowledged) {
        const through = this.through, acked = Date.now()
        // Acknowledging the same position twice is harmless, so an ack that
        // times out is sent again on the next loop, as a poll is asked again.
        try {
          await this.poke({ ack: { connection: this.connection, target: 'client', through } })
        } catch (error) {
          if (this.stopping.signal.aborted) return
          if (error.name !== 'TimeoutError') throw error
          this.silentSince ??= acked
          continue
        }
        this.acknowledged = through
      }
      await sleep(100)
    }
  }
  async close() {
    this.running = false; this.stopping.abort()
    await this.polling
    for (const value of this.pending.values()) value.reject(new Error('Test client closed'))
    this.pending.clear()
    await this.poke({ close: { connection: this.connection, reason: 'conformance complete' } })
  }
}
