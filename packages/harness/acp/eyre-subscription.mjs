import { clientId } from './client-id.mjs'

// HTTP connections are shared by every tab on the origin. Keep room for RPC
// sends and queue reads; tabs without a stream continue using durable polling.
async function withStreamSlot(run, signal, slot = 0) {
  const locks = globalThis.navigator?.locks
  if (!locks || slot === 2) throw new Error('Using queue reads while event streams are busy')
  return locks.request(`harness-event-stream-${slot}`, { ifAvailable: true }, (lock) => {
    signal.throwIfAborted()
    return lock ? run() : withStreamSlot(run, signal, slot + 1)
  })
}

// A separate, disposable Eyre channel contains only this watch's events, not
// the command channel's poke acknowledgements. ACP remains the durable queue.
export class EyreSubscription {
  constructor({ ship, connection, app = 'acp', path, isReady = (value) => Array.isArray(value?.messages), onUpdate, onDisconnect }) {
    this.ship = ship
    this.connection = connection
    this.app = app
    this.path = path || `/v1/${connection}/client`
    this.isReady = isReady
    this.onUpdate = onUpdate
    this.onDisconnect = onDisconnect
    this.channel = `harness-events-${clientId()}`
    this.controller = new AbortController()
    this.connected = false
    // Eyre starts event IDs at zero (ACP message sequences start at one).
    this.through = -1
    this.acknowledged = -1
    this.ackFlight = null
    this.ackTimer = null
    this.heartbeatTimer = null
    this.started = false
  }

  async send(actions) {
    const response = await fetch(`/~/channel/${this.channel}`, {
      method: 'PUT', credentials: 'same-origin', signal: this.controller.signal,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify(actions),
    })
    if (!response.ok) throw new Error(`Eyre subscription returned HTTP ${response.status}`)
  }

  async run() {
    const hidden = () => {
      if (document.hidden) this.fail(new Error('Event stream paused in a background tab'))
    }
    try {
      if (globalThis.document?.hidden) throw new Error('Event stream paused in a background tab')
      globalThis.document?.addEventListener('visibilitychange', hidden)
      await withStreamSlot(() => this.readStream(), this.controller.signal)
    } catch (error) {
      if (!this.controller.signal.aborted) this.fail(error)
    } finally {
      globalThis.document?.removeEventListener('visibilitychange', hidden)
    }
  }

  async readStream() {
    try {
      this.started = true
      await this.send([{ id: 1, action: 'subscribe', ship: this.ship, app: this.app, path: this.path }])
      if (this.controller.signal.aborted) return
      const response = await fetch(`/~/channel/${this.channel}`, {
        credentials: 'same-origin', cache: 'no-store', signal: this.controller.signal,
        headers: { accept: 'text/event-stream' },
      })
      if (!response.ok || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
        throw new Error('Eyre event stream unavailable')
      }
      const reader = response.body.getReader()
      this.reader = reader
      const decoder = new TextDecoder()
      let buffer = ''
      try {
        while (!this.controller.signal.aborted) {
          const { done, value } = await reader.read()
          if (done) throw new Error('Eyre event stream ended')
          // Eyre emits a heartbeat every 20 seconds. A silently lost watch
          // falls back to queue reads; this never times out or resends an RPC.
          clearTimeout(this.heartbeatTimer)
          this.heartbeatTimer = setTimeout(() => this.fail(new Error('Eyre heartbeat missing')), 45_000)
          buffer = (buffer + decoder.decode(value, { stream: true })).replaceAll('\r\n', '\n')
          let boundary
          while ((boundary = buffer.indexOf('\n\n')) !== -1) {
            this.receive(buffer.slice(0, boundary))
            buffer = buffer.slice(boundary + 2)
          }
          if (buffer.length > 8 * 1024 * 1024) throw new Error('Eyre event exceeds receive budget')
        }
      } finally { await reader.cancel().catch(() => {}) }
    } catch (error) {
      if (!this.controller.signal.aborted) this.fail(error)
    }
  }

  receive(event) {
    if (this.controller.signal.aborted) return
    const lines = event.split('\n')
    const data = lines.filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trimStart()).join('\n')
    if (!data) return // Eyre heartbeat/comment.
    const id = Number(lines.find((line) => line.startsWith('id:'))?.slice(3).trim())
    if (!Number.isSafeInteger(id) || id < 0) throw new Error('Invalid Eyre event cursor')
    if (id <= this.through) return
    const frame = JSON.parse(data)
    if (frame.id === 1) {
      if (frame.response === 'quit' || (frame.response === 'subscribe' && frame.err)) throw new Error('ACP subscription unavailable')
      if (frame.response === 'diff') {
        this.onUpdate(frame.json)
        if (this.isReady(frame.json)) this.connected = true
      }
    }
    this.through = id
    this.queueAck()
  }

  queueAck() {
    if (this.ackTimer || this.ackFlight || this.controller.signal.aborted || this.through <= this.acknowledged) return
    this.ackTimer = setTimeout(() => { this.ackTimer = null; this.ack() }, 250)
  }

  ack() {
    const through = this.through
    this.ackFlight = this.send([{ action: 'ack', 'event-id': through }]).then(() => {
      this.acknowledged = through
    }).catch((error) => {
      if (!this.controller.signal.aborted) this.fail(error)
    }).finally(() => { this.ackFlight = null; this.queueAck() })
  }

  fail(error) {
    if (this.controller.signal.aborted) return
    this.close()
    this.onDisconnect(error)
  }

  close() {
    if (this.controller.signal.aborted) return
    this.connected = false
    clearTimeout(this.ackTimer)
    clearTimeout(this.heartbeatTimer)
    this.controller.abort()
    void this.reader?.cancel().catch(() => {})
    if (!this.started) return
    // Delete only this disposable watch channel, never the ACP connection.
    void fetch(`/~/channel/${this.channel}`, {
      method: 'PUT', credentials: 'same-origin', keepalive: true,
      headers: { 'content-type': 'application/json' }, body: JSON.stringify([{ action: 'delete' }]),
    }).catch(() => {})
  }
}
