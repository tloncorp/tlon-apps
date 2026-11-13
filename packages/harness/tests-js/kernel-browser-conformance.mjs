// Two local fake ships, a scripted model, and a loopback Kernel MCP fixture.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import { text as readText } from 'node:stream/consumers'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, readCookie } from './lib/ship-client.mjs'

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
    assert.deepEqual(result(value).tools.map(({ name }) => name).sort(), [create, release, execute])
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
  if (body.messages[user]?.content.includes(`${marker}-trusted-wallet`)) {
    if (!receipts.size) return [tool('connect', connectWallet)]
    assert.match(receipts.get('connect'), /only in the owner DM/)
    return []
  }
  if (body.messages[user]?.content.includes(`${marker}-trusted-browser`)) {
    if (!receipts.size) {
      return [
        tool('browser-entry', secureEntry, { session_id: sessionId, markers: ['login-password'] }),
        tool('saved-login', approveLogin, { session_id: sessionId }),
        tool('payment', requestPayment, { arguments: JSON.stringify({ session_id: sessionId }) }),
      ]
    }
    for (const id of ['browser-entry', 'saved-login', 'payment']) {
      assert.match(receipts.get(id), /only in the owner DM/)
    }
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
    return { tools: [create, execute, release].map((name) => ({
      name, description: name,
      inputSchema: { type: 'object', properties: { session_id: { type: 'string' }, code: { type: 'string' } },
        required: name === execute ? ['session_id', 'code'] : name === release ? ['session_id'] : [] },
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
    assert.equal(state, 'idle')
    state = 'open'
    return reply('Session started', { session_id: fixtureHandle })
  }
  assert.equal(args.session_id, fixtureHandle)
  if (name === prepare) {
    assert.equal(state, 'ready')
    assert.deepEqual(args, {
      session_id: fixtureHandle, action: 'prepare_form', fields: [{ name: 'tlon-mark:login-password' }],
    })
    return reply('Prepared private form', {
      session_id: fixtureHandle, viewer_url: `${origin}/s/${viewerToken}?clipboardBridge=true`,
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
    assert.ok(!raw.includes(privateResult), 'The model request does not contain private result fields')
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
async function dmAndWait(actor, receipt) {
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
    if (replies.some(({ essay }) => JSON.stringify(essay.content).includes(receipt))) return
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
  const expectedCalls = ['tools/list', 'tools/list', create, execute, prepare, execute, release]
  assert.deepEqual(calls, expectedCalls)
  assert.equal(resumed, 1)
  await dmAndWait('connect', `${marker}-done-released`)
  assert.equal(walletResumed, 1)
  assert.equal(walletPolls, 3)
  expectedCalls.push(walletConnect, walletStatus, walletStatus, walletStatus)

  state = 'denied'
  await bot.call('harness/tlon/configure', {
    ...policy, owner: `~${bot.ship}`, trusted: [{ ship: `~${peer.ship}`, tools: [{ mcp: other }] }],
  })
  await dmAndWait('trusted', `${marker}-done-denied`)
  state = 'denied-with-browser-grant'
  await bot.call('harness/tlon/configure', {
    ...policy, owner: `~${bot.ship}`, trusted: [{ ship: `~${peer.ship}`, tools: [{ mcp: browser }] }],
  })
  await dmAndWait('trusted-browser', `${marker}-done-denied-with-browser-grant`)
  state = 'wallet-denied'
  await dmAndWait('trusted-wallet', `${marker}-done-wallet-denied`)
  assert.deepEqual(calls, expectedCalls, 'The non-owner does not reach the browser endpoint')
  assert.deepEqual(failures, [])
  console.log('PASS owner DM browser lifecycle, private secure entry, Link connection, and trusted non-owner denial')
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
