import test from 'node:test'
import assert from 'node:assert/strict'
import { HandClient, DeliveryNotSent } from './hand-client.mjs'

function fixture({ acquired = true, receiptFails = false } = {}) {
  const calls = []
  const client = { call: async (method, params) => {
    calls.push({ method, params })
    if (params.claim) return { effectId: '0v1', acquired, attempt: 1, text: 'answer', address: 'opaque' }
    if (params['receipt-at'] && receiptFails) throw new Error('Connection lost')
    return params['receipt-at'] || {}
  } }
  return { calls, hand: new HandClient(client, { hand: 'example', worker: 'one' }) }
}

test('binding and observations use the ordinary ACP extension', async () => {
  const { hand, calls } = fixture()
  await hand.bind('b', { address: 'opaque', sessionId: 's', actors: ['alice'] })
  await hand.observe('b', { event: 'external-1', actor: 'alice', text: 'Hello' })
  assert.equal(calls[0].method, 'harness/hand')
  assert.equal(calls[0].params.bind.config.hand, 'example')
  assert.equal(calls[1].params.observe.event, 'external-1')
})
test('publication receives its stable effect identity and returns a receipt', async () => {
  const { hand, calls } = fixture()
  await hand.deliver('0v1', async (intent) => { assert.equal(intent.effectId, '0v1'); return 'message-9' })
  assert.equal(calls[1].params['receipt-at'].status, 'delivered')
  assert.equal(calls[1].params['receipt-at'].external, 'message-9')
})
test('a repeated claim never publishes again automatically', async () => {
  const { hand } = fixture({ acquired: false })
  const result = await hand.deliver('0v1', () => assert.fail('must not publish'))
  assert.equal(result.needsReconciliation, true)
})
test('unknown publication failure requires reconciliation', async () => {
  const { hand, calls } = fixture()
  await assert.rejects(hand.deliver('0v1', async () => { throw new Error('timeout') }))
  assert.equal(calls[1].params['receipt-at'].status, 'uncertain')
})
test('only a positively unsent effect is marked retryable', async () => {
  const { hand, calls } = fixture()
  await assert.rejects(hand.deliver('0v1', async () => { throw new DeliveryNotSent('rejected before send') }))
  assert.equal(calls[1].params['receipt-at'].status, 'failed')
})
test('lost receipt does not classify successful publication as failed', async () => {
  const { hand, calls } = fixture({ receiptFails: true })
  await assert.rejects(hand.deliver('0v1', async () => 'message-9'))
  assert.equal(calls.length, 2)
  assert.equal(calls[1].params['receipt-at'].status, 'delivered')
})

test('delivery keeps its own attempt even if another claim updates the cache', async () => {
  const { hand, calls } = fixture()
  await hand.deliver('0v1', async () => {
    hand.attempts.set('0v1', 3)
    return 'message-from-attempt-1'
  })
  assert.equal(calls[1].params['receipt-at'].attempt, 1)
})

test('reconnected workers must recover and supply an explicit attempt', async () => {
  const { hand, calls } = fixture()
  assert.throws(() => hand.receipt('0v1', 'delivered', 'message'), /Recover the effect/)
  await hand.receipt('0v1', 'delivered', 'message', 3)
  assert.equal(calls[0].params['receipt-at'].attempt, 3)
})

test('outbox follows bounded pages without losing the cursor', async () => {
  const calls = []
  const hand = new HandClient({ call: async (_, { publications }) => {
    calls.push(publications)
    return publications.after == null
      ? { records: [{ effectId: '0v1' }], next: '0v1' }
      : { records: [{ effectId: '0v2' }], next: null }
  } }, { hand: 'example', worker: 'one' })
  assert.deepEqual(await hand.outbox(), [{ effectId: '0v1' }, { effectId: '0v2' }])
  assert.deepEqual(calls.map(({ after, limit }) => [after, limit]), [[null, 1], ['0v1', 1]])
})

test('any hand uses the shared scheduler namespace and retains its source binding', async () => {
  const calls = []
  const hand = new HandClient({ call: async (method, params) => { calls.push({ method, params }); return {} } }, { hand: 'mail', worker: 'one' })
  await hand.schedule('mail-thread', { id: '0v1', actor: 'alice', schedule: '0 9 * * *', timezone: 'UTC', prompt: 'Check mail', runs: '3' })
  await hand.schedules('mail-thread')
  await hand.cancelSchedule('0v1')
  await hand.clearSchedule('0v1')
  assert.deepEqual(calls.map(({ method }) => method), ['harness/cron/add', 'harness/cron', 'harness/cron/cancel', 'harness/cron/clear'])
  assert.deepEqual(calls[0].params, { id: '0v1', binding: 'mail-thread', actor: 'alice', kind: 'prompt', args: { schedule: '0 9 * * *', timezone: 'UTC', prompt: 'Check mail', runs: '3' } })
  assert.deepEqual(calls[1].params, { binding: 'mail-thread' })
})
