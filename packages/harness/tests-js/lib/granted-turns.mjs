// Run a turn under a conversation's saved tool grants.
//
// A local owner turn has administrative provenance, and +execution-tools then
// replaces the saved grants with every configurable tool, so it cannot show that
// a grant limits anything. owner-grants-conformance.mjs pins that behaviour.
// Input from a non-Tlon hand has no such provenance (+origin in harness-admin),
// so these turns are limited by what the conversation was actually granted.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { HandClient } from '../../acp/hand-client.mjs'

export class GrantedTurns {
  constructor(client) {
    this.hand = new HandClient(client, { hand: `grants-${randomUUID().slice(0, 8)}`, worker: 'grants-fixture' })
    this.bindings = new Map()
    this.events = 0
  }
  async prompt(sessionId, text) {
    let binding = this.bindings.get(sessionId)
    if (!binding) {
      binding = `${this.hand.hand}-${this.bindings.size}`
      await this.hand.bind(binding, { address: `room/${binding}`, sessionId, actors: ['fixture'] })
      this.bindings.set(sessionId, binding)
    }
    const { inputId } = await this.hand.observe(binding, { event: `event-${++this.events}`, actor: 'fixture', text })
    const deadline = Date.now() + 90_000
    while (Date.now() < deadline) {
      const { phase } = (await this.hand.status(binding)).observations.find((entry) => entry.inputId === inputId)
      if (!['queued', 'running'].includes(phase)) {
        assert.equal(phase, 'completed', `hand turn for ${sessionId}`)
        return
      }
      await sleep(100)
    }
    throw new Error(`Hand turn for ${sessionId} did not finish`)
  }
  async close() {
    for (const effect of await this.hand.outbox()) {
      if (effect.status === 'pending') await this.hand.deliver(effect.effectId, async () => 'fixture-delivered')
    }
    for (const binding of this.bindings.values()) await this.hand.enable(binding, false)
  }
}
