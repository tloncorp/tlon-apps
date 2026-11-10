// Real two-ship Messenger + native hand tools, with a local deterministic LLM.
// Restores defaults/policy, cancels fixture schedules. Test messages and their
// delivery evidence remain. No paid providers or Groups code/config changes.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE, 'Set PEER_URL, PEER_COOKIE and TEST_NEST')
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), client = new Client()
const marker = `hand-tools-${randomUUID()}`, channel = marker, failures = [], receipts = [], schedules = []
let event = 0, defaults, policy, mode = 'unbound', sourceSid, scheduledSid, targetId, held, scheduledRequests = 0, unbound, broadened = false
const call = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const answer = (res, content, calls = []) => res.end(JSON.stringify({ choices: [{ finish_reason: calls.length ? 'tool_calls' : 'stop', message: {
  role: 'assistant', content, ...(calls.length ? { tool_calls: calls } : {}),
} }], usage: { prompt_tokens: 20, completion_tokens: 10 } }))
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw), lastUser = body.messages.findLastIndex((m) => m.role === 'user')
    const current = body.messages.slice(lastUser + 1).filter((m) => m.role === 'tool')
    receipts.push(...current)
    res.writeHead(200, { 'content-type': 'application/json' })
    if (mode === 'unbound') {
      if (!current.length) return answer(res, '', [call('unbound-read', 'tlon_read_history', {}), call('unbound-write', 'tlon_react', { message_id: 'forged', emoji: '👍' }), call('unbound-cron', 'cron_add', { schedule: '* * * * *', timezone: 'UTC', prompt: 'forged', runs: '1' })])
      for (const result of current) assert.match(result.content, /not granted/)
      return answer(res, 'UNBOUND_DENIED')
    }
    const scheduled = body.messages.some((m) => m.role === 'system' && /Scheduled work\nThis is a bounded run/.test(m.content))
    if (scheduled) {
      scheduledRequests++
      assert.ok(body.tools.some((t) => t.function.name === 'current_time'))
      assert.ok(!body.messages.some((m) => m.content?.includes('PRIVATE_SCHEDULING_CONTEXT')))
      assert.ok(!body.tools.some((t) => ['cron_add', 'run_subagent'].includes(t.function.name)))
      if (mode === 'cron-revoke') { held = res; return }
      if (!current.length) {
        if (!broadened) {
          const cfg = await client.call('harness/session/config', { sessionId: scheduledSid })
          await client.call('harness/session/configure', { sessionId: scheduledSid, config: { ...cfg, key: '', tools: [...cfg.tools, 'cron', 'subagents'] } })
          broadened = true
        }
        return answer(res, '', [call('forged-cron', 'cron_add', { schedule: '* * * * *', timezone: 'UTC', prompt: 'recursive', runs: '100' }), call('forged-child', 'run_subagent', { prompt: 'recursive' })])
      }
      for (const result of current) assert.match(result.content, /not granted/)
      return answer(res, `${marker}-scheduled-ok`)
    }
    if (mode.startsWith('cron')) {
      if (!current.length) return answer(res, '', [call(`add-${mode}`, 'cron_add', {
        schedule: '* * * * *', timezone: 'UTC', prompt: `${marker}-scheduled`, runs: mode === 'cron' ? '1' : '2',
      })])
      const job = JSON.parse(current[0].content)
      assert.equal(job.state, 'active'); assert.equal(job.timezone, 'UTC')
      if (!schedules.includes(job.id)) schedules.push(job.id)
      return answer(res, `${marker}-${mode}-recorded`)
    }
    if (!current.length) return answer(res, '', [call(`history-${mode}`, 'tlon_read_history', { channel: 'chat/~zod/forged', ship: '~zod' })])
    if (current.length === 1) {
      const history = JSON.parse(current[0].content)
      assert.ok(history.length <= 20)
      const target = history.findLast((m) => m.author === peer && m.text.includes(`${marker}-${mode.split('-')[0]}-react`))
      assert.ok(target, 'history must be from the bound chat, ignoring forged destination arguments')
      targetId = target.message_id
      return answer(res, '', [call(`reaction-${mode}`, mode.endsWith('unreact') ? 'tlon_unreact' : 'tlon_react', { message_id: targetId, emoji: '👍', ship: '~zod', channel: 'chat/~zod/forged' })])
    }
    assert.match(current.at(-1).content, /^accepted:/)
    return answer(res, `${marker}-${mode}-ok`)
  } catch (error) { failures.push(error); answer(res, 'FIXTURE_ERROR') }
})
async function scry(path, remote = false) {
  const res = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, {
    headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000),
  })
  assert.ok(res.ok, `scry ${path}: ${res.status}`); return res.json()
}
async function send(text, inChannel = false) {
  const da = (((BigInt(Date.now()) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const essay = { content: [{ inline: [...(inChannel ? [{ ship }] : []), text] }], author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null }
  const res = await fetch(`${peerUrl}/~/channel/${channel}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app: inChannel ? 'channels' : 'chat',
      mark: inChannel ? 'channel-action-1' : 'chat-dm-action-2', json: inChannel ? { channel: { nest, action: { post: { add: essay } } } }
        : { ship, diff: { id: `${peer}/${da}`, delta: { add: { time: null, essay } } } },
    }]), signal: AbortSignal.timeout(15000) })
  assert.ok(res.ok)
}
async function until(label, check, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (failures.length) throw new AggregateError(failures)
    const result = await check()
    if (result) { console.log(`PASS ${label}`); return result }
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
const page = (inChannel, remote = false) => scry(inChannel ? `channels/v4/${nest}/posts/newest/20/outline` : `chat/v4/dm/${remote ? ship : peer}/writs/newest/20/light`, remote)
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); await client.start()
  defaults = await client.call('harness/defaults'); policy = (await client.call('harness/tlon')).policy
  const config = { url: `http://127.0.0.1:${server.address().port}/completions`, model: 'fixture', key: '', headers: [], system: 'Fixture', 'max-context': 80000, tools: [] }
  ;({ sessionId: unbound } = await client.call('session/new', { name: 'Unbound hand tool fixture' }))
  await client.call('harness/session/configure', { sessionId: unbound, config: { ...config, tools: ['tlon-read', 'tlon-write', 'cron'] } })
  await client.call('session/prompt', { sessionId: unbound, prompt: [{ type: 'text', text: 'Unbound fixture' }] })
  assert.deepEqual(failures, []); console.log('PASS unbound sessions cannot borrow Tlon authority')
  await client.call('harness/defaults/configure', { config })
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, response: 'mentions', allowed: [], channels: [], trusted: [] })
  for (const next of ['dm-react', 'dm-unreact', 'channel-react', 'channel-unreact']) {
    mode = next; const inChannel = next.startsWith('channel')
    await send(`${marker}-${mode}`, inChannel)
    await until(`${mode} reply delivered`, async () => JSON.stringify(await page(inChannel, true)).includes(`${marker}-${mode}-ok`))
    await until(`${mode} Messenger state agrees with receipt`, async () => {
      const result = await page(inChannel), target = Object.values(result.writs || result.posts).find((m) => m.essay?.author === peer && JSON.stringify(m.essay.content).includes(`${marker}-${mode.split('-')[0]}-react`))
      return target && (mode.endsWith('unreact') ? !target.seal.reacts?.[ship] : !!target.seal.reacts?.[ship])
    })
  }
  // A trusted actor with zero resource grants has the same in-conversation
  // Tlon abilities as the owner, including scheduled work.
  await client.call('harness/tlon/configure', { enabled: true, owner: '~bud', response: 'mentions', allowed: [], channels: [], trusted: [{ ship: peer, tools: [] }] })
  // The job fires at the next minute. Too close to it, and it runs before the fixture
  // knows its conversation, and has finished by the time the test tries to clear it.
  const second = (Date.now() % 60000) / 1000
  if (second > 45) await sleep((61 - second) * 1000)
  mode = 'cron'; await send(`${marker}-cron PRIVATE_SCHEDULING_CONTEXT`)
  await until('schedule creation acknowledged', () => schedules.length === 1)
  const first = (await client.call('harness/cron')).find((j) => j.id === schedules[0]); sourceSid = first.sessionId; scheduledSid = first.runSessionId
  await assert.rejects(client.call('harness/cron/clear', { id: first.id }), /completed or cancelled/)
  await until('scheduled input completed and publication delivered', async () => {
    const job = (await client.call('harness/cron')).find((j) => j.id === schedules[0])
    return job?.state === 'complete' && job.remaining === 0 && job.execution === 'completed' && job.delivery === 'delivered'
  }, 95000)
  assert.ok(JSON.stringify(await page(false, true)).includes(`${marker}-scheduled-ok`))
  const finished = (await client.call('harness/cron')).find((j) => j.id === first.id)
  assert.equal(finished.clearable, true)
  const before = await client.call('harness/session/snapshot', { sessionId: first.runSessionId })
  const cleared = await client.call('harness/cron/clear', { id: first.id })
  assert.ok(!cleared.some((j) => j.id === first.id))
  // Clearing strips the run's grants, which counts as a revision; nothing else changes.
  const after = await client.call('harness/session/snapshot', { sessionId: first.runSessionId })
  assert.deepEqual({ ...after, revision: before.revision }, before)
  assert.deepEqual((await client.call('harness/session/config', { sessionId: first.runSessionId })).tools, [])
  const evidence = await client.call('harness/hand', { effect: { hand: 'tlon', effect: finished.lastInput } })
  assert.equal(evidence.status, 'delivered')
  const binding = await client.call('harness/hand', { status: { binding: first.runSessionId } })
  assert.equal(binding.enabled, false)
  await client.call('session/prompt', { sessionId: first.runSessionId, prompt: [{ type: 'text', text: 'Check that clearing the schedule did not broaden its tool authority.' }] })
  assert.ok(!(await client.call('harness/cron')).some((j) => j.runSessionId === first.runSessionId))
  console.log('PASS clearing finished schedule preserves transcript and delivery evidence, and disables its binding')
  mode = 'cron-revoke'; await send(`${marker}-cron-revoke PRIVATE_SCHEDULING_CONTEXT`)
  await until('second schedule acknowledged', () => schedules.length === 2)
  await until('scheduled inference is in flight', () => held, 95000)
  await client.call('harness/tlon/configure', { enabled: true, owner: '~bud', response: 'mentions', allowed: [], channels: [], trusted: [] })
  answer(held, `${marker}-MUST_NOT_PUBLISH`); held = null
  await until('source revocation pauses schedule', async () => (await client.call('harness/cron')).find((j) => j.id === schedules[1])?.state === 'paused')
  await sleep(2500)
  assert.ok(!JSON.stringify(await page(false, true)).includes(`${marker}-MUST_NOT_PUBLISH`))
  assert.deepEqual(failures, [])
  console.log(JSON.stringify({ ok: true, dmAndChannelReactions: true, boundedHistory: true, forgedDestinationsIgnored: true, cronPublished: true, noPrivateTranscriptInheritance: true, editedScheduleCeiling: broadened, recursiveSchedulingDenied: true, sourceRevocationFenced: true, scheduledRequests }))
} finally {
  if (held) answer(held, 'cancelled fixture')
  for (const id of schedules) await client.call('harness/cron/cancel', { id }).catch(() => {})
  if (unbound) await client.call('session/delete', { sessionId: unbound }).catch(() => {})
  if (defaults) await client.call('harness/defaults/configure', { config: { ...defaults, key: '' } })
  if (policy) await client.call('harness/tlon/configure', policy)
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
