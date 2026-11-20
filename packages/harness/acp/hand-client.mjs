// A hand uses the same ACP connection as any other client. It owns no model
// loop. Supply an initialized client with call(method, params).
export class DeliveryNotSent extends Error {}

export class HandClient {
  constructor(client, { hand, worker }) {
    if (!hand || !worker) throw new Error('A hand and stable worker identity are required')
    this.client = client
    this.hand = hand
    this.worker = worker
    this.attempts = new Map()
  }

  action(operation, params) { return this.client.call('harness/hand', { [operation]: params }) }
  bind(id, { address, sessionId, actors, enabled = true }) {
    return this.action('bind', { id, config: { hand: this.hand, address, sessionId, actors, enabled } })
  }
  register({ address, sessionId, actors, enabled = true }) {
    return this.action('register', { config: { hand: this.hand, address, sessionId, actors, enabled } })
  }
  enable(id, enabled) { return this.action('enable', { id, enabled }) }
  remove(id) { return this.action('remove', { id }) }
  observe(binding, { event, actor, text }) { return this.action('observe', { binding, event, actor, text }) }
  status(binding) { return this.action('status', { binding }) }
  // Schedules are owned by the head, not this transport. Their results use
  // the same addressed outbox and exclusive delivery receipts as replies.
  schedules(binding) { return this.client.call('harness/cron', { binding }) }
  schedule(binding, { id, actor, kind = 'prompt', ...args }) {
    return this.client.call('harness/cron/add', { id, binding, actor, kind, args })
  }
  cancelSchedule(id) { return this.client.call('harness/cron/cancel', { id }) }
  clearSchedule(id) { return this.client.call('harness/cron/clear', { id }) }
  publications(after = null, limit = 1) { return this.action('publications', { hand: this.hand, after, limit }) }
  async outbox() {
    const result = []
    let after = null
    do {
      const page = await this.publications(after)
      result.push(...page.records)
      after = page.next
    } while (after)
    return result
  }
  effect(effect) { return this.action('effect', { hand: this.hand, effect }) }
  async claim(effect) {
    const result = await this.action('claim', { hand: this.hand, effect, worker: this.worker })
    this.attempts.set(effect, result.attempt)
    return result
  }
  receipt(effect, status, external = '', attempt = this.attempts.get(effect)) {
    if (!Number.isSafeInteger(attempt)) throw new Error('Recover the effect and supply its attempt explicitly')
    return this.action('receipt-at', { hand: this.hand, effect, worker: this.worker, attempt, status, external })
  }
  retry(effect) { return this.action('retry', { hand: this.hand, effect }) }
  resolve(effect, { attempt, status, external = '', reason }) {
    return this.action('resolve', { hand: this.hand, effect, attempt, status, external, reason })
  }
  health() { return this.action('health', { hand: this.hand }) }
  archive(binding) { return this.action('archive', { binding }) }
  records(binding, after = null, limit = 1) { return this.action('records', { binding, after, limit }) }
  retire(binding, digest, location) { return this.action('retire', { binding, digest, location }) }

  async deliver(effect, publish) {
    const intent = await this.claim(effect)
    // A replayed claim might have published before its worker crashed. Only a
    // newly acquired claim is permission to start a fresh external operation.
    if (!intent.acquired) return { ...intent, needsReconciliation: true }
    let external
    try {
      external = await publish(intent)
      if (typeof external !== 'string') throw new Error('Publisher must return its external message id')
    } catch (error) {
      await this.receipt(effect, error instanceof DeliveryNotSent ? 'failed' : 'uncertain', '', intent.attempt)
      throw error
    }
    // If receipt transport fails, leave the claim intact. Do not classify a
    // successful publication as failed or invoke publish again on reconnect.
    return this.receipt(effect, 'delivered', external, intent.attempt)
  }
}
