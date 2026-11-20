// Opt-in practical acceptance: real configured models, two development ships,
// actual HTTP inputs, one user goal, a real future wake, and a file-backed hand.
// The runner never creates, assigns, updates, or completes workspace records.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdtemp, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie, readCookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

assert.equal(process.env.WORK_GOAL_REAL_MODELS, '1', 'Opt in to real provider use with WORK_GOAL_REAL_MODELS=1')
const peerURL = process.env.WORK_GOAL_PEER_URL
assert.ok(peerURL && process.env.WORK_GOAL_PEER_COOKIE && process.env.WORK_GOAL_HOME_SHIP && process.env.WORK_GOAL_PEER_SHIP)
for (const url of [base, peerURL]) assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(url).hostname), 'Use dedicated local development ships')
const peerCookie = await readCookie(process.env.WORK_GOAL_PEER_COOKIE)
const homeShip = process.env.WORK_GOAL_HOME_SHIP, peerShip = process.env.WORK_GOAL_PEER_SHIP
assert.notEqual(homeShip, peerShip, 'This is a two-ship test, not self-RPC')
const home = new Client(), peer = new Client({ url: peerURL, auth: peerCookie })
const marker = `supply-plan-${randomUUID().slice(0, 8)}`
const directory = await mkdtemp(join(tmpdir(), `${marker}-`))
const homeSession = `${marker}-coordinator`, peerSession = `peer--${homeShip}`
const hand = new HandClient(home, { hand: marker, worker: 'file-inbox' })
const reads = [], delivered = [], grants = [], cleanup = [], failures = []
const futureStarts = new Map()
let interrupted = false
const interrupt = () => { interrupted = true }
process.on('SIGINT', interrupt)
process.on('SIGTERM', interrupt)
let sourceBound = false, startedHome = false, startedPeer = false, ownsPeerSession = false
let project, tasks = [], jobs = [], models, initialGoal, finalSnapshot, sourceSnapshot, peerSnapshot
let peerBaseline = { usage: { prompt: 0, completion: 0 }, revision: 0 }
let connectivity
const delay = Number(process.env.WORK_GOAL_QUOTE_DELAY_MS || 600_000)
assert.ok(Number.isFinite(delay) && delay >= 60_000 && delay <= 600_000)
const availableAt = Math.ceil((Date.now() + delay) / 60_000) * 60_000
const requirements = [{ sku: 'notebooks', required: 72 }, { sku: 'pens', required: 144 }, { sku: 'badges', required: 60 }]
const inventory = [{ sku: 'notebooks', onHand: 17 }, { sku: 'pens', onHand: 28 }, { sku: 'badges', onHand: 7 }]
const provisional = [{ sku: 'notebooks', packSize: 5, packPriceCents: 1250 }, { sku: 'pens', packSize: 10, packPriceCents: 340 }, { sku: 'badges', packSize: 25, packPriceCents: 800 }]
const confirmed = provisional.map((row, i) => ({ ...row, packPriceCents: [1300, 375, 850][i] }))
const terms = { currency: 'USD', taxCents: 0, shippingCents: 900, freeShippingMinimumCents: 22000, budgetCents: 22000, partialPacksAllowed: false }
const oracle = confirmed.map(quote => {
  const required = requirements.find(row => row.sku === quote.sku).required
  const onHand = inventory.find(row => row.sku === quote.sku).onHand
  const packs = Math.ceil(Math.max(0, required - onHand) / quote.packSize)
  return { sku: quote.sku, packs, lineCents: packs * quote.packPriceCents, surplus: onHand + packs * quote.packSize - required }
})
const subtotal = oracle.reduce((sum, row) => sum + row.lineCents, 0)
const shipping = subtotal >= terms.freeShippingMinimumCents ? 0 : terms.shippingCents
const expected = { lines: oracle, subtotal, shipping, total: subtotal + shipping, overBudget: subtotal + shipping - terms.budgetCents }
const initialSubtotal = provisional.reduce((sum, row) => sum + oracle.find(line => line.sku === row.sku).packs * row.packPriceCents, 0)
const initialTotal = initialSubtotal + (initialSubtotal >= terms.freeShippingMinimumCents ? 0 : terms.shippingCents)
const server = createServer((req, res) => {
  const path = new URL(req.url, 'http://fixture').pathname
  const data = { '/requirements': requirements, '/inventory': inventory, '/provisional-quotes': provisional, '/terms': terms, '/confirmed-quotes': confirmed }[path]
  const status = !data ? 404 : path === '/confirmed-quotes' && Date.now() < availableAt ? 425 : 200
  reads.push({ path, at: Date.now(), status })
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  res.end(JSON.stringify(status === 200 ? data : { error: status === 425 ? 'Confirmed prices are not available yet' : 'Unknown source', availableAt: new Date(availableAt).toISOString() }))
})
async function page(client, action, args = {}) {
  const items = []; let offset = 0
  do {
    const result = await client.call('harness/workspace', { action, args: { ...args, offset, limit: 64 } })
    items.push(...result.items); offset = result.nextOffset
  } while (offset != null)
  return items
}
async function verifyIdentity(url, auth, expectedShip) {
  const response = await fetch(`${url}/~/name`, { headers: { cookie: auth }, redirect: 'error' })
  assert.ok(response.ok)
  assert.equal((await response.text()).trim().replace(/^"|"$/g, ''), expectedShip)
}
async function grant(client, other, retainedUsage = 0) {
  const before = await client.call('harness/peers')
  assert.ok(!before.owners.some(row => row.ship === other), 'Use test peers without mutual owner promotion; retain owner policy unchanged')
  const value = { ship: other, tools: ['workspace', 'peers', 'curl'], model: null, budget: retainedUsage + 100000, inflows: [] }
  await client.call('harness/peers/configure', { revision: before.revision, config: before.config, limits: before.limits, grants: [...before.grants.filter(row => row.ship !== other), value] })
  grants.push({ client, other, value, previous: before.grants.find(row => row.ship === other) })
}
async function verifyConnectivity(client, other) {
  const before = (await client.call('harness/peers/remote')).ships.find(row => row.ship === other)?.checkedAt
  await client.call('harness/peers/check', { ship: other })
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    assert.ok(!interrupted, 'Practical preflight interrupted')
    const row = (await client.call('harness/peers/remote')).ships.find(row => row.ship === other)
    if (row && row.checkedAt !== before) {
      assert.ok(row.allowed && row.grant.tools.includes('workspace'), 'Fresh discovery must show reciprocal Workspace access')
      return row
    }
    await sleep(1000)
  }
  throw new Error(`No fresh discovery response from ${other}; configured trust does not establish network reachability. No model work started.`)
}
async function deliver() {
  for (const effect of await hand.outbox()) {
    if (effect.status !== 'pending') continue
    const file = join(directory, `message-${delivered.length + 1}.md`)
    await hand.deliver(effect.effectId, async intent => {
      await writeFile(file, intent.text, { flag: 'wx', mode: 0o600 })
      assert.equal(await readFile(file, 'utf8'), intent.text)
      return file
    })
    delivered.push({ at: Date.now(), sessionId: effect.sessionId, effectId: effect.effectId, text: effect.text, file })
  }
}
try {
  await Promise.all([verifyIdentity(base, cookie, homeShip), verifyIdentity(peerURL, peerCookie, peerShip)])
  await home.start(); startedHome = true
  await peer.start(); startedPeer = true
  if ((await peer.call('session/list')).sessions.some(row => row.sessionId === peerSession)) {
    assert.ok(process.env.WORK_GOAL_PREVIOUS_REPORT, 'Preserve existing peer context: use a fresh pair or explicitly supply its previous practical report')
    const previous = JSON.parse(await readFile(process.env.WORK_GOAL_PREVIOUS_REPORT, 'utf8'))
    assert.equal(previous.homeShip, homeShip)
    assert.equal(previous.peerShip, peerShip)
    assert.match(previous.marker, /^supply-plan-[a-f0-9]{8}$/)
    assert.ok(previous.peerSnapshot, 'The previous report must retain the test-owned peer history')
    peerBaseline = await peer.call('harness/session/snapshot', { sessionId: peerSession })
    assert.ok(!['thinking', 'tools'].includes(peerBaseline.phase), 'Do not interrupt an active peer conversation')
    const inputs = snapshot => snapshot.entries.filter(row => row.role === 'user').map(({ id, inputId, body }) => ({ id, inputId, body }))
    assert.deepEqual(inputs(peerBaseline), inputs(previous.peerSnapshot), 'Refuse peer history containing any input outside the recorded practical run')
    assert.ok(inputs(peerBaseline).length, 'Require recorded test inputs, not an ambiguous empty snapshot')
  }
  const homeDefaults = await home.call('harness/defaults'), peerDefaults = await peer.call('harness/defaults')
  for (const config of [homeDefaults, peerDefaults]) assert.ok(config.url.startsWith('https://'), 'Real configured providers only; no scripted model endpoint')
  models = { home: process.env.WORK_GOAL_HOME_MODEL ?? homeDefaults.model, peer: peerDefaults.model }
  assert.ok(models.home.trim() && models.home.length <= 200, 'The test coordinator needs a nonempty model ID')
  await grant(home, peerShip); await grant(peer, homeShip, peerBaseline.usage.prompt + peerBaseline.usage.completion)
  const checks = await Promise.allSettled([verifyConnectivity(home, peerShip), verifyConnectivity(peer, homeShip)])
  const unreachable = checks.filter(row => row.status === 'rejected')
  if (unreachable.length) throw new Error(unreachable.map(row => row.reason.message).join('; '))
  connectivity = checks.map(row => row.value)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const inputURL = `http://127.0.0.1:${server.address().port}`
  await home.call('session/new', { name: homeSession })
  await home.call('harness/session/configure', { sessionId: homeSession, config: { ...homeDefaults, model: models.home, key: '', tools: ['workspace', 'peers', 'curl'], 'max-context': 48000 } })
  await hand.bind(homeSession, { sessionId: homeSession, address: `private-inbox:${marker}`, actors: ['organizer'] }); sourceBound = true
  initialGoal = `Please organize a supply plan for our community event as a project named "${marker}". Keep track of three deliverables: your initial stock-and-budget assessment, ${peerShip}'s independent verification of quantities and supplier terms, and your final confirmed-price recommendation. Work out the minimum whole packs needed after using current stock and send me a brief initial assessment. The confirmed supplier quote only becomes available at ${new Date(availableAt).toISOString()}; arrange your own one-time follow-up after then and send me the final order recommendation here without me coming back to prompt you. Use confirmed prices for the final answer. Show packs to buy, subtotal, shipping, grand total and whether our $220 budget covers it. Do not place any orders or contact suppliers. The sources are ${inputURL}/requirements, ${inputURL}/inventory, ${inputURL}/provisional-quotes, ${inputURL}/terms and the time-gated ${inputURL}/confirmed-quotes. You can share these test sources and this request with that peer. Take care of tracking and coordination yourself; I only need useful findings, not task IDs or management commands.`
  initialGoal += ' Send the initial assessment with its provisional total before the confirmed quote opens. Start the follow-up within two minutes after that release, and deliver the final recommendation within eight minutes after release.'
  await writeFile(join(directory, 'goal.txt'), initialGoal, { mode: 0o600 })
  console.log(JSON.stringify({ marker, directory, homeShip, peerShip, models, confirmedQuoteAt: new Date(availableAt).toISOString(), realModels: true }))
  ownsPeerSession = true
  await hand.observe(homeSession, { event: `${marker}-goal`, actor: 'organizer', text: initialGoal })
  const deadline = availableAt + 8 * 60_000
  let lastUpdate = 0
  while (Date.now() < deadline) {
    assert.ok(!interrupted, 'Practical run interrupted; retain evidence and clean up its execution')
    await deliver()
    const projects = (await page(home, 'projects', { includeArchived: true })).filter(row => row.title === marker)
    assert.ok(projects.length <= 1, 'The coordinator creates one project')
    project = projects[0]
    tasks = project ? await page(home, 'tasks', { project: project.id, includeArchived: true }) : []
    jobs = await hand.schedules(homeSession)
    for (const job of jobs) {
      if (['running', 'completed'].includes(job.execution) && !futureStarts.has(job.runSessionId)) futureStarts.set(job.runSessionId, Date.now())
    }
    assert.ok(jobs.length <= 2, 'The bounded goal must not grow an automatic scheduling tree')
    const source = await home.call('harness/session/snapshot', { sessionId: homeSession })
    const futureOutput = delivered.find(row => row.sessionId !== homeSession && row.at >= availableAt)
    if (Date.now() - lastUpdate >= 20_000) {
      console.log(JSON.stringify({ at: new Date().toISOString(), phase: source.phase, tasks: tasks.map(row => ({ title: row.title, status: row.status, claimant: row.claimant?.label })), schedules: jobs.map(row => ({ state: row.state, next: row.next })), delivered: delivered.length }))
      lastUpdate = Date.now()
    }
    if (futureOutput) break
    assert.ok(source.usage.prompt + source.usage.completion < 300000, 'The coordinator stays within the test token budget')
    if (source.phase === 'idle' && delivered.length && !jobs.length) throw new Error('Coordinator finished without arranging the requested future work')
    if (source.error) throw new Error(`Coordinator failed: ${source.error}`)
    await sleep(2000)
  }
  await deliver()
  assert.ok(project, 'The agent creates the project from the goal')
  assert.ok(tasks.length >= 3, 'The agent breaks the goal into discrete jobs')
  assert.ok(tasks.every(row => row.status === 'done'), 'All jobs in this bounded recommendation goal complete')
  assert.ok(tasks.some(row => row.claimant?.label === `Agent on ${peerShip}`), 'A real other ship claims and completes a home task')
  assert.ok(tasks.some(row => row.claimant?.label === homeSession && row.updated < availableAt), 'The coordinating agent completes its own present work')
  const initialOutput = delivered.find(row => row.sessionId === homeSession && row.at < availableAt)
  assert.ok(initialOutput, 'The user receives the initial assessment before the future quote opens')
  assert.ok(initialOutput.text.includes((initialTotal / 100).toFixed(2)), 'The initial assessment has the independently calculated provisional total')
  assert.ok(jobs.some(row => row.kind === 'prompt'), 'The agent schedules actual future work, not just a reminder')
  const output = delivered.findLast(row => row.sessionId !== homeSession && row.at >= availableAt)
  assert.ok(output, 'A scheduled agent delivers the final result without another user prompt')
  const futureStart = futureStarts.get(output.sessionId)
  assert.ok(futureStart >= availableAt && futureStart <= availableAt + 120_000, 'The future agent starts within the requested two-minute window')
  finalSnapshot = await home.call('harness/session/snapshot', { sessionId: output.sessionId })
  assert.equal(finalSnapshot.model, models.home, 'The scheduled worker uses the recorded coordinator model')
  assert.ok(tasks.some(row => row.claimant?.label === output.sessionId && row.updated >= availableAt), 'The future agent claims and completes its own task')
  const remote = await peer.call('harness/session/snapshot', { sessionId: peerSession })
  assert.ok(remote.usage.prompt + remote.usage.completion > peerBaseline.usage.prompt + peerBaseline.usage.completion, 'The remote agent performs fresh real inference')
  assert.ok(remote.entries.some(row => row.role === 'tool' && row.eventCount > peerBaseline.revision), 'The remote agent uses tools for this run')
  assert.ok(finalSnapshot.entries.some(row => row.role === 'tool'), 'The future agent performs work with tools')
  sourceSnapshot = await home.call('harness/session/snapshot', { sessionId: homeSession })
  assert.equal(sourceSnapshot.model, models.home, 'The coordinator uses the recorded model')
  const assignments = sourceSnapshot.entries.flatMap(row => row.calls || []).filter(call => call.name === 'ask_peer')
  assert.equal(assignments.length, 1, 'The coordinator delegates once, without resending an uncertain assignment')
  assert.ok(reads.some(row => row.path === '/confirmed-quotes' && row.status === 200 && row.at >= availableAt), 'The final answer uses an actually available later quote')
  for (const cents of [expected.subtotal, expected.shipping, expected.total, expected.overBudget]) {
    assert.ok(output.text.includes((cents / 100).toFixed(2)), `Final answer includes independently calculated $${(cents / 100).toFixed(2)}`)
  }
  for (const row of oracle) assert.match(output.text, new RegExp(`${row.sku}[^\\n]*\\b${row.packs}\\b`, 'i'), `Correct pack quantity for ${row.sku}`)
  assert.match(output.text, /over|exceed|short|not cover|insufficient/i, 'The recommendation identifies the budget shortfall')
  for (const message of delivered) {
    assert.doesNotMatch(message.text, /\/work\b|\/work confirm|Request status:/)
    for (const task of tasks) assert.ok(!message.text.includes(task.id), 'Internal task identifiers stay out of human messages')
  }
  assert.equal((await page(peer, 'projects', { includeArchived: true })).filter(row => row.title.includes(marker)).length, 0, 'The peer does not mirror the home project')
  console.log(JSON.stringify({ ok: true, marker, directory, expected, completedTasks: tasks.length, messages: delivered.map(row => row.file) }))
} catch (error) {
  failures.push(error.stack || String(error))
  process.exitCode = 1
  console.error(error.stack || error)
} finally {
  // Retain future-worker evidence even when an earlier acceptance check fails.
  if (!finalSnapshot) {
    const futureSession = delivered.findLast(row => row.sessionId !== homeSession)?.sessionId || jobs.findLast(row => row.runSessionId)?.runSessionId
    if (futureSession) {
      try { finalSnapshot = await home.call('harness/session/snapshot', { sessionId: futureSession }) }
      catch (error) { cleanup.push(`Future evidence snapshot: ${error.message}`) }
    }
  }
  for (const [client, sessionId, relevant] of [[home, homeSession, sourceBound], [peer, peerSession, ownsPeerSession]]) {
    if (!relevant) continue
    try {
      if (!(await client.call('session/list')).sessions.some(row => row.sessionId === sessionId)) continue
      const snapshot = await client.call('harness/session/snapshot', { sessionId })
      if (client === home) sourceSnapshot = snapshot
      else peerSnapshot = snapshot
    } catch (error) { cleanup.push(`Evidence snapshot: ${error.message}`) }
  }
  if (sourceBound) {
    try {
      for (const job of await hand.schedules(homeSession)) await hand.cancelSchedule(job.id)
      await hand.enable(homeSession, false)
      await home.call('session/cancel', { sessionId: homeSession })
      cleanup.push('Fixture schedules cancelled and source binding disabled; work records and receipts retained.')
    } catch (error) { cleanup.push(`Source cleanup: ${error.message}`); process.exitCode = 1 }
  }
  if (ownsPeerSession) {
    try {
      if ((await peer.call('session/list')).sessions.some(row => row.sessionId === peerSession)) await peer.call('session/cancel', { sessionId: peerSession })
    } catch (error) { cleanup.push(`Peer cleanup: ${error.message}`); process.exitCode = 1 }
  }
  for (const entry of grants.reverse()) {
    try {
      const current = await entry.client.call('harness/peers')
      const now = current.grants.find(row => row.ship === entry.other)
      assert.deepEqual(now, entry.value, 'Preserve concurrently edited trust; do not overwrite it during cleanup')
      const restored = current.grants.filter(row => row.ship !== entry.other)
      if (entry.previous) restored.push(entry.previous)
      await entry.client.call('harness/peers/configure', { revision: current.revision, config: current.config, limits: current.limits, grants: restored })
      cleanup.push(`Restored test grant for ${entry.other}`)
    } catch (error) { cleanup.push(`Trust cleanup: ${error.message}`); process.exitCode = 1 }
  }
  await writeFile(join(directory, 'report.json'), JSON.stringify({ ok: failures.length === 0 && !process.exitCode, marker, homeShip, peerShip, models, availableAt, connectivity, expected, reads, project, tasks, jobs, futureStarts: Object.fromEntries(futureStarts), delivered, failures, cleanup, peerBaseline, sourceSnapshot, peerSnapshot, finalSnapshot }, null, 2), { mode: 0o600 })
  if (startedHome) await home.close()
  if (startedPeer) await peer.close()
  server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
  console.log(`Evidence: ${directory}/report.json`)
  process.off('SIGINT', interrupt)
  process.off('SIGTERM', interrupt)
}
