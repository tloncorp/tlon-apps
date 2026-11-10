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
  constructor({ url = base, auth = cookie } = {}) {
    this.base = url
    this.cookie = auth
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
      signal: AbortSignal.timeout(15_000),
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
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)) }, 90_000)
      this.pending.set(id, { resolve: (value) => { clearTimeout(timer); resolve(value) }, reject: (error) => { clearTimeout(timer); reject(error) } })
    })
    // Register rejection handling before transport can fail.
    const sent = this.poke({ send: { connection: this.connection, target: 'agent', payload: JSON.stringify({ jsonrpc: '2.0', id, method, params }) } })
    return Promise.all([sent, result]).then(([, value]) => value)
  }
  async poll() {
    while (this.running) {
      const response = await fetch(`${this.base}/~/scry/acp/v1/${this.connection}/client.json?_=${Date.now()}`, {
        headers: { cookie: this.cookie, 'cache-control': 'no-cache' }, signal: AbortSignal.timeout(15_000),
      })
      assert.ok(response.ok, `queue HTTP ${response.status}`)
      for (const message of (await response.json()).messages || []) {
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
        const through = this.through
        await this.poke({ ack: { connection: this.connection, target: 'client', through } })
        this.acknowledged = through
      }
      await sleep(100)
    }
  }
  async close() {
    this.running = false
    await this.polling
    for (const value of this.pending.values()) value.reject(new Error('Test client closed'))
    this.pending.clear()
    await this.poke({ close: { connection: this.connection, reason: 'conformance complete' } })
  }
}
