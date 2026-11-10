// Real ACP, native ingress, hand ledger and Iris; only a local model fixture.
// The test owns its named sessions. Hand audit records are retained on ship.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const client = new Client(), observer = new Client()
const tag = `commands-${randomUUID().slice(0, 8)}`
const hand = new HandClient(observer, { hand: tag, worker: 'fixture' })
const requests = [], sessions = []
let binding, url
const server = createServer(async (req, res) => {
  const body = await readText(req)
  requests.push({ res, body: JSON.parse(body) }) // Held until stopped/released.
})
const snapshot = (sessionId) => observer.call('harness/session/snapshot', { sessionId })
const prompt = (sessionId, text, via = client) => via.call('session/prompt', {
  sessionId, prompt: [{ type: 'text', text }],
})
async function until(label, check) {
  const start = Date.now()
  while (Date.now() - start < 15000) {
    const value = await check()
    if (value) return value
    await sleep(100)
  }
  throw Error(`Timed out: ${label}`)
}
async function make(name) {
  const { sessionId } = await client.call('session/new', { name })
  sessions.push(sessionId)
  await client.call('harness/session/configure', { sessionId, config: {
    url, model: 'fixture-model', key: '', headers: [], 'max-context': 123456,
    system: 'Keep my instructions.', tools: [],
  } })
  return sessionId
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  url = `http://127.0.0.1:${server.address().port}/completions`
  await Promise.all([client.start(), observer.start()])
  const sid = await make(tag)
  await until('ACP command advertisement', () => client.updates.some((u) =>
    u.params?.sessionId === sid && u.params.update.sessionUpdate === 'available_commands_update'))
  const ad = client.updates.find((u) => u.params?.update?.sessionUpdate === 'available_commands_update')
  assert.deepEqual(ad.params.update.availableCommands.map((c) => c.name), ['help', 'status', 'model', 'context', 'compact', 'memory', 'remember', 'forget', 'work', 'stop'])
  for (const [text, reply] of [
    ['/help', /\/model default/], ['/status', /Recorded tokens: 0 input, 0 output/],
    ['/model', /fixture-model/], ['/model vendor\/other', /Model set to:.*vendor\/other/],
    ['/context', /Context estimate: [\d.]+ tokens/], ['/compact later', /Usage: \/compact/],
    [`/memory ${tag}-project`, /No matching shared memories/], [`/remember ${tag}-project Keep it small.`, /Memory saved/],
    [`/remember ${tag}-project Keep it modular.`, /Memory saved/], [`/memory ${tag}-project`, /project: Keep it modular\./],
    ['/remember ../other bad', /Memory names/], [`/forget ${tag}-project extra`, /Usage:/],
    [`/forget ${tag}-project`, /Memory forgotten/], [`/memory ${tag}-project`, /No matching shared memories/],
    ['/model two names', /Usage:/], ['/unknown', /Unknown command/], ['/stop', /Stopped/],
  ]) {
    assert.equal((await prompt(sid, text)).stopReason, 'end_turn')
    assert.match((await snapshot(sid)).entries.at(-1).body, reply)
  }
  let config = await client.call('harness/session/config', { sessionId: sid })
  assert.equal(config.model, 'vendor/other')
  assert.equal(config.system, 'Keep my instructions.')
  assert.deepEqual(config.tools, [])
  assert.equal(config.url, url)
  assert.equal(requests.length, 0, 'commands never call a provider')
  assert.deepEqual((await snapshot(sid)).usage, { prompt: 0, completion: 0 })
  const defaults = await client.call('harness/defaults')
  await prompt(sid, '/model default')
  config = await client.call('harness/session/config', { sessionId: sid })
  for (const key of ['url', 'model', 'headers', 'max-context']) assert.deepEqual(config[key], defaults[key])
  assert.equal(config.system, 'Keep my instructions.')
  assert.deepEqual(config.tools, [])
  await client.call('harness/session/configure', { sessionId: sid, config: { ...config, url, key: '' } })

  await client.pokeAgent('harness', 'harness-action', { send: { sid, text: '/status' } })
  await until('native command reply', async () => (await snapshot(sid)).entries.at(-1).body.startsWith('Model:'))
  assert.equal(requests.length, 0)

  await client.pokeAgent('harness', 'harness-action', { send: { sid, text: `/remember ${tag}-native Note from native ingress.` } })
  await until('native note saved', async () => /Memory saved/.test((await snapshot(sid)).entries.at(-1).body))

  const running = prompt(sid, 'Hold this request about native ingress')
  running.catch(() => {})
  await until('inference started', () => requests.length === 1)
  assert.ok(requests[0].body.messages.some((m) => m.role === 'user' && m.content?.includes('native: Note from native ingress.')))
  const start = Date.now()
  const stopped = await prompt(sid, '/stop', observer)
  assert.equal(stopped.stopReason, 'end_turn')
  assert.equal((await running).stopReason, 'cancelled')
  const stopMs = Date.now() - start
  assert.equal((await snapshot(sid)).phase, 'idle')
  assert.equal(requests.length, 1)

  const handSid = await make(`${tag}-hand`)
  binding = handSid
  await hand.bind(binding, { address: 'fixture:dm/thread', sessionId: handSid, actors: ['alice'] })
  const observe = (event, text, actor = 'alice') => hand.observe(binding, { event, text, actor })
  const help = await observe('help', '/help')
  let pubs = await hand.outbox()
  assert.match(pubs.find((p) => p.inputId === help.inputId).text, /\/status/)
  const note = await observe('note', `/remember ${tag}-hand Shared hand note.`)
  assert.match((await hand.outbox()).find((p) => p.inputId === note.inputId).text, /Memory saved/)
  await prompt(sid, `/memory ${tag}-hand`)
  assert.match((await snapshot(sid)).entries.at(-1).body, /Shared hand note/)
  await assert.rejects(observe('forbidden-note', `/remember ${tag}-hand Intrusion.`, 'mallory'), /Actor/)
  await observe('work', 'Hold hand inference')
  await until('hand inference', () => requests.length === 2)
  await observe('queued', 'This must be cancelled, not started')
  await assert.rejects(observe('forbidden-stop', '/stop', 'mallory'), /Actor/)
  assert.equal((await snapshot(handSid)).phase, 'thinking')
  const stop = await observe('stop', '/stop')
  pubs = await hand.outbox()
  assert.equal(pubs.filter((p) => p.kind === 'cancelled').length, 1, 'running work publishes cancellation')
  const ledger = await hand.status(binding)
  assert.equal(ledger.observations.filter((o) => o.phase === 'cancelled').length, 2, 'running and queued work both terminate')
  assert.match(pubs.find((p) => p.inputId === stop.inputId).text, /Stopped/)
  assert.equal((await snapshot(handSid)).phase, 'idle')
  assert.equal(requests.length, 2)

  // A duplicate stop and a conflicting replay must not cancel newer work.
  await observe('new-work', 'Hold a new request')
  await until('new hand inference', () => requests.length === 3)
  assert.equal((await observe('stop', '/stop')).inputId, stop.inputId)
  await assert.rejects(observe('help', '/stop'), /different content/)
  assert.equal((await snapshot(handSid)).phase, 'thinking')
  await observe('final-stop', '/stop')
  const finished = await snapshot(handSid)
  for (const { res } of requests) res.end(JSON.stringify({ choices: [{ message: { role: 'assistant', content: 'LATE' }, finish_reason: 'stop' }] }))
  await sleep(500)
  assert.deepEqual(await snapshot(handSid), finished, 'late provider output is fenced')
  const events = await fetch(`${base}/~/scry/harness/events/${handSid}.json`, { headers: { cookie } }).then((r) => r.json())
  assert.equal(events.filter((e) => e.type === 'command-completed').length, 4)
  assert.equal(events.filter((e) => e.type === 'memory-set').length, 1)
  assert.equal(events.filter((e) => e.type === 'llm-requested').length, 2)
  console.log(JSON.stringify({ ok: true, stopMs, checks: ['ACP discovery', 'native + ACP commands',
    'bounded explicit notes', 'native + ACP + hand note parity', 'note actor authorization',
    'model-only authority', 'zero command inference', 'active prompt interruption', 'hand publications',
    'queued cancellation', 'actor authorization', 'deduplicated stop', 'conflicting replay', 'late result fencing'] }, null, 2))
} finally {
  if (sessions[0]) for (const name of ['project', 'native', 'hand']) await prompt(sessions[0], `/forget ${tag}-${name}`).catch(() => {})
  for (const sid of sessions) await client.call('session/cancel', { sessionId: sid }).catch(() => {})
  if (binding) {
    for (const pub of await hand.outbox()) {
      if (pub.status === 'pending') await hand.deliver(pub.effectId, async () => 'fixture-only')
    }
    await hand.enable(binding, false)
  }
  for (const sid of sessions.filter((sid) => sid !== binding)) await client.call('session/delete', { sessionId: sid })
  await Promise.allSettled([client.close(), observer.close()])
  server.closeAllConnections()
  await new Promise((resolve) => server.close(resolve))
}
