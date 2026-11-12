// Live native + ACP hand checks. Never posts into a real external channel.
// Only uniquely named sessions/bindings created by this run are removed.
// Uses provider credentials already on the ship, or with CONTROLLED_MODEL=1 a
// deterministic local provider, restoring the defaults afterward.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { createServer } from 'node:http'
import { text as readText } from 'node:stream/consumers'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient, DeliveryNotSent } from '../acp/hand-client.mjs'

const suffix = randomUUID().slice(0, 8)
const first = new Client(), second = new Client()
const chat = new HandClient(first, { hand: `chat-${suffix}`, worker: 'chat-worker' })
const mail = new HandClient(second, { hand: `mail-${suffix}`, worker: 'mail-worker' })
const competitor = new HandClient(second, { hand: chat.hand, worker: 'other-worker' })
const sessions = [], bindings = []
const archiveDir = await mkdtemp(join(tmpdir(), 'harness-hand-tests-'))
const snapshot = (sid) => first.call('harness/session/snapshot', { sessionId: sid })

const controlled = process.env.CONTROLLED_MODEL === '1'
const failures = [], heldEssays = []
let fixture, originalDefaults
const reply = (res, message) => res.end(JSON.stringify({ choices: [{ finish_reason: message.tool_calls ? 'tool_calls' : 'stop', message: { role: 'assistant', ...message } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }))
const listFiles = (res) => reply(res, { content: '', tool_calls: [{ id: 'list-files', type: 'function', function: { name: 'list_desk_files', arguments: JSON.stringify({ path: '/harness/sur' }) } }] })
// Answers only what the observations ask for. "cedar" comes from the conversation
// it is sent, so a queued turn can only answer if it really sees the earlier one.
async function respond(req, res) {
  try {
    const { messages } = JSON.parse(await readText(req))
    const last = messages.findLastIndex((message) => message.role === 'user')
    const asked = messages[last].content, done = messages.slice(last + 1).filter((message) => message.role === 'tool')
    res.writeHead(200, { 'content-type': 'application/json' })
    if (asked.includes('essay')) {
      if (!done.length) return listFiles(res)
      heldEssays.push(res); return
    }
    if (asked.includes('Remember the word cedar')) {
      if (!done.length) return listFiles(res)
      assert.match(done[0].content, /hoon/, 'the granted tool result reached the provider')
      return reply(res, { content: 'cedar, and one file is listed.' })
    }
    if (asked.includes('What word did I ask')) {
      const earlier = messages.slice(0, last).some((message) => message.role === 'user' && message.content.includes('Remember the word cedar'))
      return reply(res, { content: earlier ? 'cedar' : 'I was not told one.' })
    }
    const exact = asked.match(/Reply with exactly (\w+)\./)
    reply(res, { content: exact ? exact[1] : 'UNEXPECTED_PROMPT' })
  } catch (error) { failures.push(error); reply(res, { content: 'FIXTURE_ERROR' }) }
}

async function until(fn, label) {
  const deadline = Date.now() + 90_000
  while (Date.now() < deadline) {
    const result = await fn()
    if (result) return result
    await sleep(150)
  }
  throw new Error(`Timed out: ${label}`)
}

try {
  await Promise.all([first.start(), second.start()])
  if (controlled) {
    fixture = createServer(respond)
    await new Promise((resolve) => fixture.listen(0, '127.0.0.1', resolve))
    originalDefaults = await first.call('harness/defaults')
    await first.call('harness/defaults/configure', { config: { ...originalDefaults, url: `http://127.0.0.1:${fixture.address().port}/completions`, model: 'fixture', key: '', headers: [] } })
  }
  for (const hand of [chat, mail]) {
    const name = `hand-test-${suffix}-${sessions.length}`
    const { sessionId } = await first.call('session/new', { name })
    sessions.push(sessionId)
    const config = await first.call('harness/session/config', { sessionId })
    await first.call('harness/session/configure', { sessionId, config: {
      ...config, key: '', tools: hand === chat ? [{ clay: '/harness/sur' }] : [],
    } })
    await hand.bind(name, { address: `opaque:${hand.hand}/thread-7`, sessionId, actors: ['alice'] })
    bindings.push([hand, name])
  }
  const [one, two] = sessions
  await assert.rejects(chat.observe(one, { event: 'forbidden', actor: 'mallory', text: 'Do something' }), /Actor/)
  const observation = { event: 'message-1', actor: 'alice', text: 'Remember the word cedar. Use list_desk_files with path /harness/sur, then reply briefly including cedar and one filename.' }
  const start = Date.now()
  const admitted = await chat.observe(one, observation)
  const admissionMs = Date.now() - start
  assert.ok(admissionMs < 5000, `admission took ${admissionMs}ms`)
  assert.equal((await chat.observe(one, observation)).inputId, admitted.inputId)
  await assert.rejects(chat.observe(one, { ...observation, text: 'different' }), /different content/)
  await Promise.all([
    chat.observe(one, { event: 'message-2', actor: 'alice', text: 'What word did I ask you to remember? Reply with just that word.' }),
    mail.observe(two, { event: 'mail-1', actor: 'alice', text: 'Reply with exactly MAIL_OK.' }),
  ])
  await first.pokeAgent('harness', 'harness-hand', {
    id: `native-${suffix}`, action: { observe: { binding: one, event: 'native-1', actor: 'alice', text: 'Reply with exactly NATIVE_OK.' } },
  })
  const chatOutput = await until(async () => {
    const outputs = await chat.outbox()
    return outputs.length === 3 && outputs
  }, 'three serialized chat replies, including native admission')
  const mailOutput = await until(async () => {
    const outputs = await mail.outbox()
    return outputs.length === 1 && outputs
  }, 'independent mail reply')
  assert.ok(chatOutput.every((effect) => effect.hand === chat.hand && effect.address === `opaque:${chat.hand}/thread-7` && effect.kind === 'reply'))
  assert.ok(mailOutput.every((effect) => effect.hand === mail.hand && effect.text.includes('MAIL_OK')))
  assert.ok(chatOutput.some((effect) => effect.text.includes('NATIVE_OK')))
  const history = await snapshot(one)
  assert.equal(history.entries.filter((entry) => entry.role === 'user').length, 3, 'no duplicate admission')
  assert.ok(history.entries.some((entry) => entry.role === 'tool'), 'the head performed a tool call')
  const ordered = history.entries.filter((entry) => ['user', 'assistant'].includes(entry.role) && !entry.calls?.length)
  assert.deepEqual(ordered.map((entry) => entry.role), ['user', 'assistant', 'user', 'assistant', 'user', 'assistant'])
  assert.match(ordered[3].body, /cedar/i, 'queued turn sees earlier completed context')
  const native = await fetch(`${base}/~/scry/harness/hands/${one}.json`, { headers: { cookie } }).then((response) => response.json())
  assert.deepEqual(native, await chat.status(one), 'native and ACP hand projections agree')

  // A failed delivery is retried independently; not one head event is added.
  const effect = chatOutput[0].effectId
  await assert.rejects(chat.deliver(effect, async () => { throw new DeliveryNotSent('not sent') }))
  await chat.retry(effect)
  const claimed = await chat.claim(effect)
  assert.equal(claimed.acquired, true)
  assert.equal((await chat.claim(effect)).acquired, false)
  await assert.rejects(competitor.claim(effect), /not available/)
  await chat.receipt(effect, 'uncertain')
  await assert.rejects(chat.retry(effect), /uncertain/)
  await chat.receipt(effect, 'delivered', 'reconciled-message')
  const terminal = await chat.effect(effect)
  assert.equal(terminal.receipts.length, 6)
  assert.deepEqual(await chat.receipt(effect, 'delivered', 'reconciled-message'), terminal)
  assert.equal((await snapshot(one)).revision, history.revision)
  const published = []
  for (const output of chatOutput.slice(1)) await chat.deliver(output.effectId, async (intent) => { published.push(intent.text); return `chat-${published.length}` })
  for (const output of mailOutput) await mail.deliver(output.effectId, async (intent) => { published.push(intent.text); return `mail-${published.length}` })
  assert.equal(published.length, 3)
  assert.deepEqual(await chat.outbox(), [])
  assert.deepEqual(await mail.outbox(), [])

  // A new ACP client can recover the same durable effect receipt.
  const resumed = new HandClient(second, { hand: chat.hand, worker: chat.worker })
  assert.deepEqual(await resumed.effect(effect), terminal)
  await chat.enable(one, false)
  await assert.rejects(chat.observe(one, { event: 'disabled', actor: 'alice', text: 'No' }), /disabled/)
  await chat.enable(one, true)
  await assert.rejects(first.call('harness/session/rename', { sessionId: one, name: `${one}-renamed` }), /bindings/)

  // Cancellation is session-wide, including work waiting in the hand queue.
  const running = await chat.observe(one, { event: 'cancel-active', actor: 'alice',
    text: 'Use list_desk_files with path /harness/sur, then write a long, detailed essay about the files.' })
  if (controlled) await until(() => heldEssays.length, 'the essay request reached the provider')
  const queued = await chat.observe(one, { event: 'cancel-queued', actor: 'alice', text: 'This must not execute.' })
  const blocked = await fetch(`${base}/harness-api/webhook/${one}`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'This must not splice into a hand turn.' }),
    signal: AbortSignal.timeout(15_000),
  })
  assert.equal(blocked.status, 409, 'webhook cannot change an active hand turn')
  await first.call('session/cancel', { sessionId: one })
  const cancelled = await chat.status(one)
  for (const input of [running, queued]) {
    assert.equal(cancelled.observations.find((obs) => obs.inputId === input.inputId).phase, 'cancelled')
  }
  const cancellationOutput = await chat.outbox()
  assert.equal(cancellationOutput.length, 1, 'queued cancellation does not fabricate a publication')
  assert.equal(cancellationOutput[0].kind, 'cancelled')
  assert.deepEqual(failures, [])
  await chat.deliver(cancellationOutput[0].effectId, async () => 'cancellation-notice')
  await first.call('session/delete', { sessionId: one })
  sessions.splice(sessions.indexOf(one), 1)
  assert.equal((await chat.status(one)).enabled, false)
  assert.deepEqual(await resumed.effect(effect), terminal, 'deletion retains delivery evidence')
  console.log(JSON.stringify({ ok: true, admissionMs, elapsedMs: Date.now() - start,
    checks: ['actor grants', 'deduplicated admission', 'native/ACP parity', 'queued turn continuity', 'independent hands', 'exclusive claims', 'uncertain delivery', 'receipt recovery', 'delivery retry without inference', 'bound-session lifecycle', 'active and queued cancellation', 'webhook isolation'] }, null, 2))
} finally {
  // Cleanup errors are reported, not hidden: unresolved deliveries must not be
  // silently discarded just to make a failing test look tidy.
  for (const [hand, binding] of bindings) {
    try {
      await hand.enable(binding, false)
      const descriptor = await hand.archive(binding)
      const records = []
      let after = null
      do {
        const page = await hand.records(binding, after)
        assert.equal(page.digest, descriptor.digest)
        records.push(...page.records); after = page.next
      } while (after)
      assert.equal(records.length, descriptor.records)
      const path = join(archiveDir, `${binding}.json`)
      await writeFile(path, JSON.stringify({ ...descriptor, records }), { mode: 0o600, flag: 'wx' })
      await hand.retire(binding, descriptor.digest, path)
    } catch (error) { console.error(`Retained test binding ${binding}: ${error.message}`) }
  }
  for (const sessionId of sessions) {
    try { await first.call('session/delete', { sessionId }) } catch (error) { console.error(`Retained test session ${sessionId}: ${error.message}`) }
  }
  if (originalDefaults) await first.call('harness/defaults/configure', { config: { ...originalDefaults, key: '' } })
  await Promise.allSettled([first.close(), second.close()])
  if (fixture) { fixture.closeAllConnections(); await new Promise((resolve) => fixture.close(resolve)) }
}
