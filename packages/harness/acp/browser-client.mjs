import { canonicalShip } from './people.mjs'
import { clientId } from './client-id.mjs'
import { EyreSubscription } from './eyre-subscription.mjs'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const changesSessions = new Set(['session/new', 'session/delete', 'session/prompt',
  'harness/session/rename', 'harness/session/fork', 'harness/session/configure'])

export function webConnection() {
  return `harness-web-${clientId()}`
}

export class AcpClient extends EventTarget {
  constructor(connection = webConnection()) {
    super()
    this.connection = connection
    this.channel = `harness-ui-${Date.now()}-${Math.floor(Math.random() * 1e6)}`
    this.nextId = 0
    this.eventId = 0
    this.pending = new Map()
    this.running = false
    this.ready = null
    this.lastError = null
    this.recovering = null
    this.receivedThrough = 0
    this.acknowledgedThrough = 0
    this.ackFlight = null
    this.ackTimer = null
    this.ackGeneration = 0
    this.ackError = null
    this.pollWake = null
    this.pollRequested = false
    this.host = null
    this.identity = null
    this.subscription = null
    this.streamRetryAt = 0
    this.queueClosed = false
    this.streamError = null
    // A slow ship is not a failed request. Abort only when this client closes.
    this.transport = new AbortController()
  }

  ship() {
    if (!this.host) throw new Error('The current ship has not been identified.')
    return this.host
  }

  async identify() {
    this.assertOpen()
    if (this.identity) return this.identity
    this.identity = (async () => {
      // Cookies are shared across ports. Eyre knows both this server's ship
      // and the authenticated identity; browser globals/cookie order do not.
      const read = async (path) => {
        const response = await fetch(path, { credentials: 'same-origin', cache: 'no-store', signal: this.transport.signal })
        if (!response.ok) throw new Error(`Could not identify this ship (HTTP ${response.status}).`)
        const ship = canonicalShip(await response.text())
        if (!ship) throw new Error('The server did not return a valid ship identity.')
        return ship
      }
      const [host, identity] = await Promise.all([read('/~/host'), read('/~/name')])
      if (host !== identity) throw new Error('Sign in to this ship, then reload Harness.')
      this.host = host.slice(1)
      return this.host
    })().catch((error) => { this.identity = null; this.host = null; throw error })
    return this.identity
  }

  async poke(json) {
    const ship = await this.identify()
    const response = await fetch(`/~/channel/${this.channel}`, {
      method: 'PUT', credentials: 'same-origin',
      signal: this.transport.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([{
        id: ++this.eventId, action: 'poke', ship, app: 'acp',
        mark: 'acp-action-1', json,
      }]),
    })
    if (!response.ok) throw new Error(`ACP transport returned HTTP ${response.status}`)
  }

  async start() {
    if (this.ready) return this.ready
    this.ready = (async () => {
      await this.poke({ open: { connection: this.connection } })
      this.assertOpen()
      this.running = true
      void this.poll()
      return this.call('initialize', { protocolVersion: 1, clientInfo: { name: 'harness-web', version: '0.2.0' } })
    })()
    this.ready.catch(() => {
      this.ready = null
      this.running = false
      this.subscription?.close()
      this.subscription = null
      clearTimeout(this.ackTimer)
      this.ackTimer = null
    })
    return this.ready
  }

  assertOpen() {
    if (this.transport.signal.aborted) throw new Error('Connection closed. Reload Harness to reconnect.')
  }

  async call(method, params = {}) {
    this.assertOpen()
    const id = ++this.nextId
    const frame = { jsonrpc: '2.0', id, method, params }
    const result = new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject, frame })
    })
    // A reply or connection closure can arrive before the HTTP poke finishes.
    result.catch(() => {})
    // Normally wake after admission to avoid an empty read per outgoing call.
    // A slow HTTP completion gets an earlier poll hint, not a request timeout.
    const wake = setTimeout(() => { if (this.pending.has(id)) this.wakePoll() }, this.subscription?.connected ? 1000 : 180)
    result.then(() => clearTimeout(wake), () => clearTimeout(wake))
    void this.poke({ send: { connection: this.connection, target: 'agent', payload: JSON.stringify(frame) } }).then(() => {
      if (!this.subscription?.connected) this.wakePoll()
    }).catch((error) => {
      const pending = this.pending.get(id)
      this.pending.delete(id)
      pending?.reject(error)
    })
    return result
  }

  async notify(method, params = {}) {
    const frame = { jsonrpc: '2.0', method, params }
    await this.poke({ send: { connection: this.connection, target: 'agent', payload: JSON.stringify(frame) } })
    if (!this.subscription?.connected) this.wakePoll()
  }

  async recover() {
    if (this.recovering) return this.recovering
    this.queueClosed = false
    ++this.ackGeneration
    clearTimeout(this.ackTimer)
    this.ackTimer = null
    this.ackFlight = null
    this.ackError = null
    this.subscription?.close()
    this.subscription = null
    this.streamRetryAt = 0
    // A late ACK/send must never target a recreated queue whose sequence has
    // restarted. Fresh identity also avoids the head's old admission cursor.
    this.connection = webConnection()
    this.recovering = (async () => {
      await this.poke({ open: { connection: this.connection } })
      this.receivedThrough = 0
      this.acknowledgedThrough = 0
      // A missing queue is not proof that a mutation was never admitted.
      for (const [id, pending] of this.pending) {
        pending.reject(new Error('Connection restored. Check the conversation before repeating your action.'))
        this.pending.delete(id)
      }
    })().finally(() => { this.recovering = null })
    return this.recovering
  }

  async poll() {
    while (this.running) {
      this.startStreaming()
      try {
        if (this.queueClosed) { await this.recover(); continue }
        const response = await fetch(`/~/scry/acp/v1/${this.connection}/client.json?_=${Date.now()}`, {
          credentials: 'same-origin',
          cache: 'no-store',
          signal: this.transport.signal,
        })
        if (!this.running) return
        if (response.status === 404) {
          await this.recover()
          await sleep(100)
          continue
        }
        if (!response.ok) throw new Error(`ACP poll returned HTTP ${response.status}`)
        if (response.ok) {
          const update = await response.json()
          const messages = Array.isArray(update?.messages) ? update.messages : []
          const through = this.receiveBatch(messages)
          this.acknowledge(through)
        }
        if (this.lastError && !this.ackError) {
          this.lastError = null
          this.dispatchEvent(new Event('transport-ready'))
        }
      } catch (error) {
        if (!this.running) return
        if (error.message !== this.lastError) {
          this.lastError = error.message
          this.dispatchEvent(new CustomEvent('transport-error', { detail: error }))
        }
      }
      if (this.running) await this.waitForPoll(this.pollDelay())
    }
  }

  pollDelay() {
    if (this.subscription?.connected) return this.pending.size || this.ackError ? 1000 : document.hidden ? 30_000 : 15_000
    return document.hidden ? 1500 : this.pending.size ? 180 : 900
  }

  startStreaming() {
    if (!this.running || !this.host || this.subscription || Date.now() < this.streamRetryAt) return
    const subscription = new EyreSubscription({
      ship: this.ship(), connection: this.connection,
      onUpdate: (update) => {
        if (!this.running || this.subscription !== subscription) return
        this.streamError = null
        if (Array.isArray(update?.messages)) { this.receiveBatch(update.messages); this.queueAcknowledgement() }
        if (update?.connection?.open === false) { this.queueClosed = true; this.wakePoll() }
      },
      onDisconnect: (error) => {
        if (this.subscription !== subscription) return
        this.streamError = error.message
        this.subscription = null
        this.streamRetryAt = Date.now() + 10_000
        // Losing a watch does not prove any RPC failed. Poll the durable queue
        // while reconnecting, without replaying commands or clearing cursors.
        this.wakePoll()
      },
    })
    this.subscription = subscription
    void subscription.run()
  }

  acknowledge(through = this.receivedThrough) {
    if (this.ackFlight || through <= this.acknowledgedThrough || !this.running) return
    const generation = this.ackGeneration
    // One cumulative ACK at a time; polling and ready RPC replies keep moving.
    this.ackFlight = this.poke({ ack: { connection: this.connection, target: 'client', through } }).then(() => {
      if (generation !== this.ackGeneration || !this.running) return
      this.acknowledgedThrough = through
      this.ackError = null
    }).catch((error) => {
      if (generation !== this.ackGeneration || !this.running) return
      this.ackError = error
      this.wakePoll()
      if (error.message !== this.lastError) {
        this.lastError = error.message
        this.dispatchEvent(new CustomEvent('transport-error', { detail: error }))
      }
    }).finally(() => {
      if (generation !== this.ackGeneration) return
      this.ackFlight = null
      // Failure retries at the normal poll cadence, never in a tight loop.
      if (!this.ackError) {
        if (this.subscription?.connected) this.queueAcknowledgement()
        else this.acknowledge()
      }
    })
  }

  queueAcknowledgement() {
    if (this.ackTimer || this.ackFlight || this.ackError || !this.running || this.receivedThrough <= this.acknowledgedThrough) return
    this.ackTimer = setTimeout(() => { this.ackTimer = null; this.acknowledge() }, 250)
  }

  wakePoll() {
    this.pollRequested = true
    this.pollWake?.()
  }

  waitForPoll(ms) {
    if (this.pollRequested) {
      this.pollRequested = false
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const finish = () => {
        clearTimeout(timer)
        this.pollWake = null
        this.pollRequested = false
        resolve()
      }
      const timer = setTimeout(finish, ms)
      this.pollWake = finish
    })
  }

  close() {
    if (this.transport.signal.aborted) return
    const wasRunning = this.running
    this.running = false
    clearTimeout(this.ackTimer)
    this.ackTimer = null
    this.subscription?.close()
    this.subscription = null
    ++this.ackGeneration
    this.ackFlight = null
    this.wakePoll()
    this.ready = null
    this.transport.abort()
    for (const pending of this.pending.values()) {
      pending.reject(new Error('Connection closed. Check the conversation before repeating your action.'))
    }
    this.pending.clear()
    if (!wasRunning || !this.host) return
    void fetch(`/~/channel/${this.channel}`, {
      method: 'PUT', credentials: 'same-origin', keepalive: true,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([{
        id: ++this.eventId, action: 'poke', ship: this.ship(), app: 'acp',
        mark: 'acp-action-1', json: { close: { connection: this.connection, reason: 'browser closed' } },
      }]),
    }).catch(() => {})
  }

  receiveBatch(messages) {
    for (const message of messages) {
      const sequence = Number(message.sequence) || 0
      if (sequence <= this.receivedThrough) continue
      // A watch and a simultaneous scry may finish out of order. Never ACK
      // past an unseen frame; the durable queue fills the gap on the next poll.
      if (sequence !== this.receivedThrough + 1) { this.wakePoll(); continue }
      this.receive(JSON.parse(message.payload))
      this.receivedThrough = sequence
    }
    return this.receivedThrough
  }

  receive(frame) {
    if (frame.id != null && ('result' in frame || 'error' in frame)) {
      const pending = this.pending.get(Number(frame.id))
      if (!pending) return
      this.pending.delete(Number(frame.id))
      if (frame.error) pending.reject(new Error(frame.error.message || 'ACP request failed'))
      else {
        pending.resolve(frame.result)
        if (changesSessions.has(pending.frame?.method)) this.dispatchEvent(new Event('harness/sessions/changed'))
      }
      return
    }
    if (frame.method) this.dispatchEvent(new CustomEvent(frame.method, { detail: frame.params }))
  }
}

export const acp = new AcpClient()
if (typeof window !== 'undefined') window.addEventListener('pagehide', (event) => {
  if (!event.persisted) acp.close()
})
