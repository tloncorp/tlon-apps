// Exercise owner recovery through the same ACP operations as the Work panel.
// The synthetic binding has no adapter route and can never publish to Tlon.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { Client } from './lib/ship-client.mjs'

const client = new Client(), run = promisify(execFile)
const sid = `work-test-${randomUUID().slice(0, 8)}`
let binding, effect, completed = false
const hand = (operation) => client.call('harness/hand', operation)
async function record() {
  let before
  do {
    const page = await client.call('harness/tlon/work', before ? { before } : {})
    assert.ok(page.records.length <= 16)
    const found = page.records.find((row) => row.id === effect)
    if (found) return found
    before = page.next
  } while (before)
  throw new Error('Synthetic publication is missing from the Work panel')
}
try {
  await client.start()
  await client.call('session/new', { name: sid })
  ;({ binding } = await hand({ register: { config: { hand: 'tlon', address: 'test-only:never-published', sessionId: sid, actors: ['fixture'], enabled: true } } }))
  ;({ inputId: effect } = await hand({ notify: { binding, event: 'literal', actor: 'fixture', text: 'Owner recovery fixture; no inference or destination delivery.' } }))
  assert.equal((await record()).status, 'completed')
  const claimed = await hand({ claim: { hand: 'tlon', effect, worker: 'fixture' } })
  assert.equal((await record()).status, 'sending')
  const uncertain = await hand({ resolve: { hand: 'tlon', effect, attempt: claimed.attempt, status: 'uncertain', external: '', reason: 'Fixture models a worker interruption after dispatch' } })
  const pending = await record()
  assert.equal(pending.status, 'uncertain'); assert.equal(pending.canRetry, false)
  assert.equal(pending.canResolve, true); assert.equal(pending.current, false)
  await assert.rejects(hand({ retry: { hand: 'tlon', effect } }), /uncertain|disabled|available/i)
  await assert.rejects(hand({ resolve: { hand: 'tlon', effect, attempt: claimed.attempt, status: 'abandoned', external: '', reason: 'Stale owner draft' } }), /stale/i)
  assert.equal((await record()).status, 'uncertain')
  await hand({ resolve: { hand: 'tlon', effect, attempt: uncertain.attempt, status: 'abandoned', external: '', reason: 'Fixture confirms no real destination exists; retain evidence without retry' } })
  assert.equal((await record()).status, 'abandoned')
  const snapshot = await client.call('harness/session/snapshot', { sessionId: sid })
  assert.deepEqual(snapshot.entries, [], 'literal notification and delivery recovery never infer or edit the transcript')
  completed = true
  console.log('PASS native owner Work projection, uncertain state, stale-attempt rejection, no blind retry and explicit abandonment')
} finally {
  if (binding) {
    // Preserve evidence before releasing only this fixture's binding/session.
    await hand({ enable: { id: binding, enabled: false } })
    if (completed) {
      const directory = await mkdtemp(join(tmpdir(), 'tlon-work-archive-'))
      await run(process.execPath, ['tests-js/archive-hand.mjs', binding, join(directory, 'binding.jsonl')], { env: process.env, timeout: 90000 })
      await client.call('session/delete', { sessionId: sid })
    }
  }
  await client.close()
}
