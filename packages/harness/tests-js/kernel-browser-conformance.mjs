// Two local fake ships, a scripted model, and a loopback Kernel MCP fixture.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { text as readText } from 'node:stream/consumers'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, readCookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

const peerUrl = process.env.PEER_URL
for (const url of [base, peerUrl]) {
  assert.equal(new URL(url).hostname, '127.0.0.1', 'Use the disposable loopback test ships')
}
const bot = new Client()
const peer = new Client({ url: peerUrl, auth: await readCookie(process.env.PEER_COOKIE) })
assert.notEqual(bot.ship, peer.ship)
const marker = `kernel-browser-${randomUUID()}`
const browser = 'kernel-browser', other = 'browser-test-unrelated'
const create = 'browser_session_create', execute = 'kernel_playwright_execute', release = 'browser_session_release'
const screenshot = 'kernel_computer_screenshot'
const prepare = 'browser_session_live_view', secureEntry = 'browser_secure_entry'
const approveLogin = 'browser_approve_login', requestPayment = 'browser_request_payment'
const connectWallet = 'browser_connect_wallet', walletConnect = 'wallet_connect', walletStatus = 'payment_status'
const walletId = randomUUID()
const fixtureHandle = `opaque-${randomUUID()}`, fixtureKey = randomUUID()
const viewerToken = `fixture.${'A'.repeat(43)}`
const resultPath = `/credential-result/${viewerToken}`
const privateResult = 'PRIVATE_RESULT_VALUE'
const calls = [], failures = []
let origin, sessionId, state = 'idle', previous, completed = false, polls = 0, resumed = 0
let walletConnected = false, walletPolls = 0, walletResumed = 0
let secondHandChecked = false, revocation
let screenshots = 0

const tool = (id, name, args = {}) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } })
const list = (id, name) => tool(id, 'list_mcp_tools', { server: browser, ...(name && { name }) })
const invoke = (id, name, args = {}) => tool(id, 'call_mcp_tool', { server: browser, name, arguments: JSON.stringify(args) })
const result = (receipt) => {
  assert.ok(receipt.startsWith('HTTP 200\n\n'))
  const payload = receipt.slice('HTTP 200\n\n'.length)
  const envelope = payload.startsWith('{') ? JSON.parse(payload) : payload.split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => JSON.parse(line.slice(5)))
    .find(({ id }) => id === 1)
  assert.ok(envelope, 'Missing MCP response envelope')
  const { result, error } = envelope
  assert.ok(result && !error && !result.isError)
  return result
}
const browse = [
  { id: 'discover', call: tool('discover', 'list_mcp_servers'), check: (value) => {
    assert.ok(JSON.parse(value).some(({ id }) => id === browser))
  } },
  { id: 'list', call: list('list'), check: (value) => {
    assert.deepEqual(result(value).tools.map(({ name }) => name).sort(), [create, release, screenshot, execute])
  } },
  { id: 'schema', call: list('schema', execute), check: (value) => {
    const [schema] = result(value).tools
    assert.equal(schema.name, execute)
    assert.deepEqual(schema.inputSchema.required, ['session_id', 'code'])
  } },
  { id: 'create', call: invoke('create', create), check: (value) => {
    sessionId = result(value).structuredContent.session_id
    assert.equal(sessionId, fixtureHandle)
  } },
  { id: 'navigate', call: () => invoke('navigate', execute, {
    session_id: sessionId, code: "await page.goto('https://example.test/'); return await page.locator('h1').innerText();",
  }), check: (value) => assert.match(result(value).content[0].text, /Ready to continue/) },
  { id: 'screenshot', call: () => invoke('screenshot', screenshot, { session_id: sessionId }),
    check: (value) => assert.match(value, /Screenshot image input is unavailable on this route/) },
  { id: 'malformed-screenshot', call: () => invoke('malformed-screenshot', screenshot, { session_id: sessionId }),
    check: (value) => assert.equal(value, 'error: Invalid browser screenshot reply.') },
  { id: 'secure-entry', call: () => tool('secure-entry', secureEntry, { session_id: sessionId, markers: ['login-password'] }),
    check: (value) => {
      assert.equal(completed, true, 'The model waits for the owner result')
      assert.match(value, /^Secure entry filled/)
      resumed++
    } },
  { id: 'click', call: () => invoke('click', execute, {
    session_id: sessionId, code: "await page.getByRole('button', { name: 'Continue' }).click(); return await page.locator('h1').innerText();",
  }), check: (value) => assert.match(result(value).content[0].text, /Action complete/) },
  { id: 'release', call: () => invoke('release', release, { session_id: sessionId }),
    check: (value) => assert.equal(result(value).structuredContent.released, true) },
]

function model(body) {
  const user = body.messages.findLastIndex(({ role }) => role === 'user')
  const receipts = new Map(body.messages.slice(user + 1).filter(({ role }) => role === 'tool')
    .map(({ tool_call_id, content }) => [tool_call_id, content]))
  if (body.messages[user]?.content.includes(`${marker}-owner`)) {
    const step = browse[receipts.size]
    if (receipts.size) {
      const last = browse[receipts.size - 1]
      last.check(receipts.get(last.id))
    }
    return step ? [typeof step.call === 'function' ? step.call() : step.call] : []
  }
  if (body.messages[user]?.content.includes(`${marker}-connect`)) {
    if (!receipts.size) return [tool('connect', connectWallet)]
    assert.equal(walletConnected, true)
    assert.match(receipts.get('connect'), /^Stripe Link is connected.*separate payment approval/)
    walletResumed++
    return []
  }
  if (body.messages[user]?.content.includes(`${marker}-proxy`)) {
    if (!receipts.size) return [tool('proxy-entry', secureEntry, { session_id: sessionId, markers: ['login-password'] })]
    assert.match(receipts.get('proxy-entry'), /direct Kernel HTTP endpoint/)
    return []
  }
  if (body.messages[user]?.content.includes(`${marker}-open`)) {
    if (!receipts.size) return [invoke('open', create)]
    assert.equal(result(receipts.get('open')).structuredContent.session_id, sessionId)
    return []
  }
  if (body.messages[user]?.content.includes(`${marker}-revoke-`)) {
    assert.equal(receipts.size, 0, 'The former owner turn must not resume')
    return [tool('revoke-form', secureEntry, { session_id: sessionId, markers: ['login-password'] })]
  }
  const secondHand = body.messages[user]?.content.includes(`${marker}-second-hand`)
  if (secondHand || body.messages[user]?.content.includes(`${marker}-trusted-browser`)) {
    const names = (body.tools ?? []).map(({ function: fn }) => fn.name)
    for (const name of [secureEntry, approveLogin, requestPayment, connectWallet]) {
      assert.ok(!names.includes(name), `${name} is hidden from the model`)
    }
    if (!receipts.size) {
      return [
        tool('discover', 'list_mcp_servers'),
        list('browser-list'),
        invoke('new-session', create),
        invoke('use-known-session', execute, { session_id: sessionId, code: 'return await page.title();' }),
        invoke('screenshot-known-session', 'kernel_computer_screenshot', { session_id: sessionId }),
        tool('browser-entry', secureEntry, { session_id: sessionId, markers: ['login-password'] }),
        tool('saved-login', approveLogin, { session_id: sessionId, form_id: walletId,
          record: { id: 'fake-record', revision: 1 }, bindings: [{ sourceField: 'password', targetField: 'f0' }] }),
        tool('payment', requestPayment, { arguments: JSON.stringify({ session_id: sessionId, request_key: 'second-hand-test', amount_cents: 100, currency: 'USD' }) }),
        tool('connect-wallet', connectWallet),
        // A successful local call lets the model inspect the denials before the loop guard halts it.
        tool('clock', 'current_time'),
      ]
    }
    const discovery = receipts.get('discover')
    if (!secondHand) assert.ok(discovery.startsWith('['), 'The scoped MCP catalog is still callable')
    if (discovery.startsWith('[')) {
      assert.ok(!JSON.parse(discovery).some(({ id }) => id === browser))
    } else {
      assert.match(discovery, /not granted/)
    }
    for (const id of ['browser-list', 'new-session', 'use-known-session', 'screenshot-known-session',
      'browser-entry', 'saved-login', 'payment', 'connect-wallet']) {
      assert.match(receipts.get(id), /not granted/)
    }
    if (secondHand) secondHandChecked = true
    return []
  }
  assert.ok(body.messages[user]?.content.includes(`${marker}-trusted`))
  if (!receipts.size) {
    return [tool('discover', 'list_mcp_servers'), list('browser-list'),
      invoke('known-handle', execute, { session_id: sessionId, code: 'return await page.title();' }),
      tool('browser-entry', secureEntry, { session_id: sessionId, markers: ['login-password'] })]
  }
  assert.deepEqual(JSON.parse(receipts.get('discover')).map(({ id }) => id), [other])
  assert.match(receipts.get('browser-list'), /not granted/)
  assert.match(receipts.get('known-handle'), /not granted/)
  assert.match(receipts.get('browser-entry'), /not granted/)
  return []
}

function kernel(request) {
  calls.push(request.params.name ?? request.method)
  if (request.method === 'tools/list') {
    return { tools: [create, execute, release, screenshot].map((name) => ({
      name, description: name,
      inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, code: { type: 'string' } },
        required: name === execute ? ['session_id', 'code'] : name === create ? [] : ['session_id'] },
    })) }
  }
  assert.equal(request.method, 'tools/call')
  const { name, arguments: args } = request.params
  const reply = (text, structuredContent) => ({ content: [{ type: 'text', text }], structuredContent })
  if (name === walletConnect || name === walletStatus) {
    assert.deepEqual(args, name === walletConnect ? {} : { request_id: walletId })
    if (name === walletStatus) walletPolls++
    return reply(privateResult, {
      kind: 'connect', request_id: walletId,
      status: walletConnected ? 'connected' : 'pending',
      owner_action_required: !walletConnected,
      action: { url: 'https://example.test/' + privateResult },
    })
  }
  if (name === create) {
    assert.ok(['idle', 'released'].includes(state))
    state = state === 'idle' ? 'open' : 'open-for-permission-tests'
    return reply('Session started', { session_id: fixtureHandle })
  }
  assert.equal(args.session_id, fixtureHandle)
  if (name === screenshot) {
    if (++screenshots === 2) return null
    return { content: [{ type: 'text', text: 'Screenshot captured.' },
      { type: 'image', mimeType: 'image/png', data: 'dGVzdA==' }] }
  }
  if (name === prepare) {
    assert.equal(state, revocation ? 'open-for-permission-tests' : 'ready')
    assert.deepEqual(args, {
      session_id: fixtureHandle, action: 'prepare_form', fields: [{ name: 'tlon-mark:login-password' }],
    })
    return reply('Prepared private form', {
      session_id: fixtureHandle, viewer_url: `${origin}/s/${revocation?.token ?? viewerToken}?clipboardBridge=true`,
      card: { purpose: 'login', site: 'example.test' },
    })
  }
  if (name === execute && state === 'open') {
    assert.match(args.code, /page\.goto/)
    state = 'ready'
    return reply('result: Ready to continue')
  }
  if (name === execute) {
    assert.equal(state, 'ready')
    assert.match(args.code, /\.click\(\)/)
    state = 'clicked'
    return reply('result: Action complete')
  }
  assert.equal(name, release)
  assert.equal(state, 'clicked')
  state = 'released'
  return reply('Session released', { released: true })
}

const server = createServer(async (req, res) => {
  try {
    res.setHeader('content-type', 'application/json')
    if (req.url === resultPath) {
      assert.equal(req.method, 'GET')
      assert.equal(req.headers['x-api-key'], undefined, 'Result lookup does not forward the MCP key')
      polls++
      return res.end(JSON.stringify(completed ? { status: 'filled', submitted: false, privateResult } : { status: 'pending' }))
    }
    if (revocation && req.url === `/credential-result/${revocation.token}`) {
      assert.equal(req.method, 'GET')
      revocation.polls++
      return res.end(JSON.stringify({ status: revocation.status }))
    }
    if (revocation && req.url === `/credentials/${revocation.token}`) {
      assert.equal(req.method, 'DELETE')
      assert.equal(req.headers['x-api-key'], undefined)
      assert.equal(++revocation.deletes, 1, 'Cancel the specific pending form once')
      assert.equal(revocation.status, revocation.busy ? 'filling' : 'pending')
      if (revocation.busy) {
        res.statusCode = 409
        return res.end(JSON.stringify({ code: 'session_busy' }))
      }
      revocation.status = 'cancelled'
      return res.end(JSON.stringify({ ok: true }))
    }
    const raw = await readText(req)
    const body = JSON.parse(raw)
    if (req.url === '/kernel/mcp') {
      assert.ok(req.headers['x-api-key'] === fixtureKey, 'MCP request uses the configured key')
      const envelope = JSON.stringify({ jsonrpc: '2.0', id: body.id, result: kernel(body) })
      if (body.method === 'tools/call') {
        res.setHeader('content-type', 'text/event-stream')
        return res.end(`event: message\ndata: ${envelope}\n\n`)
      }
      return res.end(envelope)
    }
    assert.equal(req.url, '/completions')
    assert.ok(!raw.includes(fixtureKey), 'The model request does not contain the MCP key')
    assert.ok(!raw.includes(viewerToken), 'The model request does not contain the viewer capability')
    assert.ok(!revocation || !raw.includes(revocation.token), 'The model request does not contain the revoked capability')
    assert.ok(!raw.includes(privateResult), 'The model request does not contain private result fields')
    assert.ok(!raw.includes('dGVzdA=='), 'The unsupported model route receives no screenshot pixels')
    const tool_calls = model(body)
    const content = tool_calls.length ? '' : `${marker}-done-${state}`
    res.end(JSON.stringify({ choices: [{ finish_reason: tool_calls.length ? 'tool_calls' : 'stop',
      message: { role: 'assistant', content, ...(tool_calls.length && { tool_calls }) } }] }))
  } catch (error) {
    failures.push(error)
    res.writeHead(500)
    res.end('Browser fixture assertion failed')
  }
})

const configure = (servers) => bot.call('harness/mcp/configure', { servers })
async function dmAndWait(actor, isDone) {
  const sent = Date.now(), author = `~${peer.ship}`, ship = `~${bot.ship}`
  const da = (((BigInt(sent) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n)
    .toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const essay = { content: [{ inline: [`${marker}-${actor}`] }], author, sent, kind: '/chat', meta: null, blob: null }
  await peer.pokeAgent('chat', 'chat-dm-action-2', {
    ship, diff: { id: `${author}/${da}`, delta: { add: { time: null, essay } } },
  })
  const deadline = Date.now() + 45_000
  while (Date.now() < deadline) {
    if (failures.length) throw new AggregateError(failures)
    const response = await fetch(`${peerUrl}/~/scry/chat/v4/dm/${ship}/writs/newest/20/heavy.json`, {
      headers: { cookie: peer.cookie }, signal: AbortSignal.timeout(15_000),
    })
    assert.ok(response.ok, `DM read HTTP ${response.status}`)
    const { writs } = await response.json()
    const replies = Object.values(writs).filter(({ essay }) => essay?.author === ship && essay.sent >= sent)
    if (actor === 'owner' && !completed && polls > 1) {
      const cards = replies.flatMap(({ essay }) => JSON.parse(essay.blob ?? '[]'))
        .filter((card) => card.type === 'browser-secure-entry')
      assert.deepEqual(cards, [{
        type: 'browser-secure-entry', version: 1,
        viewerUrl: `${origin}/s/${viewerToken}?clipboardBridge=true`,
        presentation: { purpose: 'login', site: 'example.test' },
      }])
      assert.equal(resumed, 0)
      completed = true
    }
    if (actor === 'connect' && !walletConnected && walletPolls > 1) {
      const cards = replies.flatMap(({ essay }) => JSON.parse(essay.blob ?? '[]'))
        .filter((card) => card.type === 'browser-wallet')
      assert.deepEqual(cards, [{ type: 'browser-wallet', version: 1, requestId: walletId }])
      assert.equal(walletResumed, 0)
      walletConnected = true
    }
    const done = typeof isDone === 'function'
      ? isDone(replies)
      : replies.some(({ essay }) => JSON.stringify(essay.content).includes(isDone))
    if (done) return
    await sleep(200)
  }
  throw new Error(`Timed out waiting for ${actor} DM result`)
}

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
  await bot.start()
  previous = { servers: await bot.call('harness/mcp/servers'),
    defaults: { ...await bot.call('harness/defaults'), key: '' },
    policy: (await bot.call('harness/tlon')).policy }
  assert.ok(previous.servers.every(({ id }) => id !== browser && id !== other), 'Use a clean fixture ship')
  await configure([...previous.servers, { id: browser, name: 'Kernel Browser', url: `${origin}/kernel/mcp`,
    headers: [{ name: 'x-api-key', value: fixtureKey }], enabled: true },
  { id: other, name: 'Unrelated test service', url: `${origin}/unrelated`, headers: [], enabled: true }])
  await bot.call('harness/defaults/configure', { config: {
    ...previous.defaults, url: `${origin}/completions`, model: 'fixture', key: '', headers: [], system: 'Browser fixture.', tools: [],
  } })
  const policy = { enabled: true, owner: `~${peer.ship}`, trusted: [], response: 'mentions', allowed: [], channels: [] }
  await bot.call('harness/tlon/configure', policy)
  await dmAndWait('owner', `${marker}-done-released`)
  const expectedCalls = ['tools/list', 'tools/list', create, execute, screenshot, screenshot, prepare, execute, release]
  assert.deepEqual(calls, expectedCalls)
  assert.equal(resumed, 1)
  await dmAndWait('connect', `${marker}-done-released`)
  assert.equal(walletResumed, 1)
  assert.equal(walletPolls, 3)
  expectedCalls.push(walletConnect, walletStatus, walletStatus, walletStatus)

  const directServers = await bot.call('harness/mcp/servers')
  await configure(directServers.map((server) => server.id === browser
    ? { ...server, url: `urbit://~${bot.ship}/mcp-proxy` } : server))
  await dmAndWait('proxy', `${marker}-done-released`)
  assert.deepEqual(calls, expectedCalls, 'Unsupported proxy handoffs never reach Kernel')
  await configure(directServers)

  await dmAndWait('open', `${marker}-done-open-for-permission-tests`)
  expectedCalls.push(create)

  const [conversationId] = (await bot.call('harness/tlon')).sessions
  assert.ok(conversationId.startsWith(`${peer.ship}-dm-`))
  const config = await bot.call('harness/session/config', { sessionId: conversationId })
  await bot.call('harness/session/configure', {
    sessionId: conversationId, config: { ...config, key: '', tools: [{ mcp: browser }] },
  })
  const hand = new HandClient(bot, { hand: marker, worker: 'fixture' })
  await hand.bind(marker, { sessionId: conversationId, address: 'other-hand', actors: ['another-sender'] })
  try {
    const { inputId } = await hand.observe(marker, { event: 'second-hand', actor: 'another-sender', text: `${marker}-second-hand` })
    const deadline = Date.now() + 45_000
    let publication
    while (!publication && Date.now() < deadline) {
      if (failures.length) throw new AggregateError(failures)
      publication = (await hand.outbox()).find((entry) => entry.inputId === inputId)
      if (!publication) await sleep(200)
    }
    if (failures.length) throw new AggregateError(failures)
    assert.ok(publication, 'The second hand completes its turn on the owner DM session')
    assert.equal(publication.text, `${marker}-done-open-for-permission-tests`)
    assert.ok(secondHandChecked, 'The model received and checked the second hand tool receipts')
    assert.deepEqual(calls, expectedCalls, 'The second hand never reaches Kernel')
  } finally {
    await hand.enable(marker, false)
  }

  for (const busy of [false, true]) {
    await bot.call('harness/tlon/configure', policy)
    revocation = { token: `${randomUUID()}.${'B'.repeat(43)}`, busy, status: 'pending', polls: 0, deletes: 0 }
    await dmAndWait(`revoke-${busy}`, (replies) => revocation.polls && replies.some(({ essay }) =>
      JSON.parse(essay.blob ?? '[]').some(({ type, viewerUrl }) =>
        type === 'browser-secure-entry' && viewerUrl.includes(revocation.token))))
    if (busy) revocation.status = 'filling'
    await bot.call('harness/tlon/configure', { ...policy, owner: `~${bot.ship}` })
    const deadline = Date.now() + 10_000
    while (!revocation.deletes && Date.now() < deadline) {
      if (failures.length) throw new AggregateError(failures)
      await sleep(100)
    }
    assert.equal(revocation.deletes, 1, 'Changing owners revokes the active form at Kernel')
    assert.equal(revocation.status, busy ? 'filling' : 'cancelled')
    expectedCalls.push(prepare)
  }

  await bot.call('harness/tlon/configure', {
    ...policy, owner: `~${bot.ship}`, trusted: [{ ship: `~${peer.ship}`, tools: [{ mcp: other }] }],
  })
  await dmAndWait('trusted', `${marker}-done-open-for-permission-tests`)
  await bot.call('harness/tlon/configure', {
    ...policy, owner: `~${bot.ship}`, trusted: [{ ship: `~${peer.ship}`, tools: [{ mcp: browser }, { mcp: other }] }],
  })
  await dmAndWait('trusted-browser', `${marker}-done-open-for-permission-tests`)
  assert.deepEqual(calls, expectedCalls, 'The non-owner does not reach the browser endpoint')
  assert.deepEqual(failures, [])
  console.log('PASS owner browser lifecycle, private secure entry, Link connection, second-hand and non-owner denial, and form revocation')
} finally {
  try {
    if (previous) {
      await bot.call('harness/tlon/configure', previous.policy)
      await bot.call('harness/defaults/configure', { config: previous.defaults })
      await configure(previous.servers)
    }
  } finally {
    await bot.close()
    server.closeAllConnections()
    if (server.listening) await new Promise((resolve) => server.close(resolve))
  }
}
