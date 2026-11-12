// Live native upload + four Messenger surfaces. Uses a real public download,
// a local independently-verifying S3 endpoint and a deterministic model.
// Temporarily replaces TEST SHIP storage/defaults/policy; restores all fields.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

assert.equal(process.env.MEDIA_TEST_STORAGE, '1', 'Explicitly enable temporary test-ship storage configuration with MEDIA_TEST_STORAGE=1')
const peerUrl = process.env.PEER_URL, nest = process.env.TEST_NEST
assert.ok(peerUrl && nest && process.env.PEER_COOKIE)
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((r) => /\turbauth-~/.test(r)).split('\t')
const peerCookie = `${row[5]}=${row[6]}`, peer = row[5].slice('urbauth-'.length)
const ship = cookie.split('=')[0].slice('urbauth-'.length), client = new Client()
const marker = `media-${randomUUID()}`, secret = randomBytes(24).toString('hex')
const source = 'https://www.python.org/static/img/python-logo.png', bucket = `harness-${randomBytes(8).toString('hex')}`
let event = 0, mode = 'success', sourceUrl = source, originals, fixtureImage, heldPut, putCount = 0, suspended = false
const failures = [], results = [], puts = [], objects = new Map()
const sha = (s) => createHash('sha256').update(s).digest('hex')
const hmac = (k, s) => createHmac('sha256', k).update(s).digest()
const encode = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`)
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = (server) => `http://127.0.0.1:${server.address().port}`
const storage = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, origin(storage))
    if (req.method === 'GET') {
      const body = objects.get(url.pathname)
      res.writeHead(body ? 200 : 404, { 'content-type': 'image/png' }); return res.end(body)
    }
    assert.equal(req.method, 'PUT'); putCount++
    const parts = []; for await (const part of req) parts.push(part)
    const data = Buffer.concat(parts), params = url.searchParams
    assert.deepEqual(data, fixtureImage, 'Iris must preserve binary bytes exactly')
    assert.equal(params.get('X-Amz-Algorithm'), 'AWS4-HMAC-SHA256')
    const [access, day, region, service, terminator] = params.get('X-Amz-Credential').split('/')
    assert.equal(access, 'HARNESSFIXTURE'); assert.equal(region, 'us-east-1'); assert.equal(service, 's3'); assert.equal(terminator, 'aws4_request')
    const signed = params.get('X-Amz-SignedHeaders')
    assert.equal(signed, 'cache-control;content-type;host')
    const query = [...params].filter(([key]) => key !== 'X-Amz-Signature').map(([k, v]) => [encode(k), encode(v)]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${k}=${v}`).join('&')
    const headers = signed.split(';').map((name) => `${name}:${req.headers[name].trim()}\n`).join('')
    const canonical = ['PUT', url.pathname, query, headers, signed, 'UNSIGNED-PAYLOAD'].join('\n')
    let key = Buffer.from(`AWS4${secret}`)
    for (const part of [day, region, service, terminator]) key = hmac(key, part)
    const signature = hmac(key, ['AWS4-HMAC-SHA256', params.get('X-Amz-Date'), `${day}/${region}/${service}/${terminator}`, sha(canonical)].join('\n')).toString('hex')
    assert.equal(params.get('X-Amz-Signature'), signature, 'Independent SigV4 verification')
    puts.push({ path: url.pathname, acl: params.get('x-amz-acl') })
    if (['reload-put', 'timeout-put', 'config-put', 'revoke-put'].includes(mode)) { heldPut = res; return }
    if (mode === 'acl' && params.has('x-amz-acl')) {
      res.writeHead(400, { 'content-type': 'application/xml' }); return res.end('<Error><Code>AccessControlListNotSupported</Code></Error>')
    }
    if (mode === 'uncertain') { res.writeHead(503); return res.end('No acceptance evidence') }
    objects.set(url.pathname, data); res.writeHead(200); res.end()
  } catch (error) { failures.push(error); res.writeHead(400); res.end('Fixture verification failed') }
})
const answer = (res, content, calls) => res.end(JSON.stringify({ choices: [{ finish_reason: calls ? 'tool_calls' : 'stop', message: { role: 'assistant', content, ...(calls ? { tool_calls: calls } : {}) } }] }))
const model = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    assert.ok(!raw.includes(secret), 'Storage secrets must not reach the model')
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    const current = body.messages.slice(last + 1).filter((m) => m.role === 'tool')
    res.writeHead(200, { 'content-type': 'application/json' })
    if (!current.length) return answer(res, '', [{ id: `upload-${mode}`, type: 'function', function: { name: 'tlon_upload_image', arguments: JSON.stringify({ url: sourceUrl }) } }])
    results.push(current.at(-1).content)
    let result
    try { result = JSON.parse(current.at(-1).content) } catch { return answer(res, `${marker}-${mode}-failed`) }
    assert.ok(result.url.startsWith(`${origin(storage)}/${bucket}/`))
    answer(res, `${marker}-${mode}\n![fixture picture](${result.url})`)
  } catch (error) { failures.push(error); answer(res, 'FIXTURE_ERROR') }
})
async function scry(path, remote = false) {
  const res = await fetch(`${remote ? peerUrl : base}/~/scry/${path}.json`, { headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(res.ok, `scry ${path}: ${res.status}`); return res.json()
}
async function until(label, check, timeout = 45000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    if (failures.length) throw new AggregateError(failures)
    const value = await check()
    if (value) { console.log(`PASS ${label}`); return value }
    await sleep(250)
  }
  throw new Error(`Timed out: ${label}`)
}
const da = () => (((BigInt(Date.now()) * (1n << 64n)) / 1000n) + 170141184475152167957503069145530368000n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
async function send(surface = 'dm', parent) {
  const content = [{ inline: [...(surface === 'channel' ? [{ ship }] : []), `${marker}-${mode}`] }]
  const essay = { content, author: peer, sent: Date.now(), kind: '/chat', meta: null, blob: null }
  const reply = { content, author: peer, sent: Date.now(), blob: null }
  const inChannel = surface.startsWith('channel')
  const json = inChannel ? { channel: { nest, action: { post: parent ? { reply: { id: parent, action: { add: reply } } } : { add: essay } } } }
    : { ship, diff: { id: parent || `${peer}/${da()}`, delta: parent ? { reply: { id: `${peer}/${da()}`, meta: null, delta: { add: { 'reply-essay': reply, time: null } } } } : { add: { essay, time: null } } } }
  const res = await fetch(`${peerUrl}/~/channel/${marker}`, { method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' }, body: JSON.stringify([{ id: ++event, action: 'poke', ship: peer.slice(1), app: inChannel ? 'channels' : 'chat', mark: inChannel ? 'channel-action-1' : 'chat-dm-action-2', json }]), signal: AbortSignal.timeout(15000) })
  assert.ok(res.ok)
}
const dmPage = () => scry(`chat/v4/dm/${ship}/writs/newest/32/heavy`, true)
const channelPage = () => scry(`channels/v5/${nest}/posts/newest/32/post`, true)
function imageIn(essay) { return essay?.author === ship && essay.content?.some((verse) => verse.block?.image?.src?.startsWith(origin(storage))) }
async function storageSet(fields) { for (const [name, value] of Object.entries(fields)) await client.pokeAgent('storage', 'storage-action', { [name]: value }) }
async function reloadAdapter() {
  assert.ok(process.env.TEST_PANE, 'TEST_PANE is required for reload tests')
  const run = promisify(execFile)
  async function dojo(value) {
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, '-l', '--', value])
    await run('tmux', ['send-keys', '-t', process.env.TEST_PANE, 'Enter'])
  }
  async function status() {
    const res = await fetch(`${base}/~/scry/harness-tlon/status.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
    return res.ok ? res.json() : null
  }
  suspended = true
  await dojo('|rein %harness [%.n %harness-tlon]')
  await until('upload adapter suspended', async () => !await status())
  await dojo('|rein %harness [%.y %harness-tlon]')
  await until('upload adapter resumed', async () => (await status())?.headConnected)
  suspended = false
}
try {
  const reference = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(30000) })
  assert.equal(reference.status, 200)
  fixtureImage = Buffer.from(await reference.arrayBuffer())
  await Promise.all([listen(storage), listen(model)]); await client.start()
  originals = { defaults: await client.call('harness/defaults'), policy: (await client.call('harness/tlon')).policy,
    cred: (await scry('storage/credentials'))['storage-update'].credentials, conf: (await scry('storage/configuration'))['storage-update'].configuration }
  await storageSet({ 'set-endpoint': origin(storage), 'set-access-key-id': 'HARNESSFIXTURE', 'set-secret-access-key': secret, 'set-region': 'us-east-1', 'set-current-bucket': bucket, 'set-public-url-base': '', 'toggle-service': 'credentials' })
  await client.call('harness/defaults/configure', { config: { ...originals.defaults, url: `${origin(model)}/completions`, model: 'fixture', key: '', headers: [], tools: [] } })
  await client.call('harness/tlon/configure', { enabled: true, owner: peer, response: 'mentions', allowed: [], channels: [], trusted: [] })
  await send()
  const dm = await until('real public download, verified binary S3 PUT and native DM image', async () => Object.values((await dmPage()).writs).find((post) => imageIn(post.essay)))
  assert.equal(putCount, 1)
  mode = 'dm-thread'; await send('dm-thread', dm.seal.id)
  await until('native DM-thread image', async () => Object.values((await dmPage()).writs).some((post) => Object.values(post.seal?.replies || {}).some((reply) => imageIn(reply['reply-essay']))))
  mode = 'channel'; await send('channel')
  const channelPost = await until('native channel image', async () => Object.entries((await channelPage()).posts).find(([, post]) => imageIn(post.essay)))
  mode = 'channel-thread'; await send('channel-thread', channelPost[0])
  await until('native channel-thread image', async () => Object.values((await channelPage()).posts[channelPost[0]]?.seal?.replies || {}).some((reply) => imageIn(reply['reply-essay'])))
  mode = 'acl'; const beforeAcl = putCount, beforeAclResults = results.length; await send()
  await until('known ACL rejection retries once without ACL', () => results.length > beforeAclResults && puts.length === beforeAcl + 2)
  assert.equal(puts.at(-1).path, puts.at(-2).path); assert.equal(puts.at(-1).acl, null)
  mode = 'uncertain'; const beforeUncertain = putCount; await send()
  await until('server failure is reported uncertain', () => results.some((r) => r.startsWith('uncertain:')))
  await sleep(2000); assert.equal(putCount, beforeUncertain + 1)
  if (process.env.TEST_PANE) {
    mode = 'reload-put'; const beforePut = putCount, resultCountPut = results.length
    await send(); await until('reload fixture holds dispatched PUT', () => heldPut)
    await reloadAdapter()
    await until('reload reports dispatched PUT uncertain', () => results.length > resultCountPut)
    assert.match(results.at(-1), /^uncertain:/)
    if (!heldPut.destroyed) { heldPut.writeHead(200); heldPut.end() }
    await sleep(2000); assert.equal(putCount, beforePut + 1)
    console.log('PASS reload never repeats a PUT and late acceptance cannot republish')
  }
  mode = 'config-put'; heldPut = null; const beforeConfig = putCount, configResultCount = results.length
  await send(); await until('configuration fixture holds first PUT', () => heldPut)
  await storageSet({ 'set-public-url-base': 'https://changed.example.com' })
  heldPut.writeHead(400, { 'content-type': 'application/xml' })
  heldPut.end('<Error><Code>AccessControlListNotSupported</Code></Error>')
  await until('changed storage fences ACL retry dispatch', () => results.length > configResultCount)
  assert.match(results.at(-1), /^failed: storage configuration changed/); assert.equal(putCount, beforeConfig + 1)
  await storageSet({ 'set-public-url-base': '' })
  for (const url of ['http://www.python.org/image.png', 'https://127.0.0.1/image.png', 'https://service.local/image.png', 'https://user:pass@example.com/image.png', 'https://example.com:8443/image.png']) {
    mode = 'invalid-url'; sourceUrl = url
    const before = putCount, resultCount = results.length
    await send(); await until('unsafe source URL rejected without a PUT', () => results.length > resultCount)
    assert.match(results.at(-1), /^error: provide a public HTTPS/); assert.equal(putCount, before)
  }
  sourceUrl = source
  if (process.env.MEDIA_TEST_TIMEOUT === '1') {
    mode = 'timeout-put'; heldPut = null; const before = putCount, resultCount = results.length
    await send(); await until('timeout fixture holds dispatched PUT', () => heldPut)
    await until('one-minute upload deadline settles uncertain', () => results.length > resultCount, 75000)
    assert.match(results.at(-1), /^uncertain:/); assert.equal(putCount, before + 1)
  }
  mode = 'revoke-put'; heldPut = null; const beforeRevocation = putCount; await send()
  await until('first PUT held before permission revocation', () => heldPut)
  await client.call('harness/tlon/configure', { enabled: false, owner: peer, response: 'mentions', allowed: [], channels: [], trusted: [] })
  if (!heldPut.destroyed) {
    heldPut.writeHead(400, { 'content-type': 'application/xml' })
    heldPut.end('<Error><Code>AccessControlListNotSupported</Code></Error>')
  }
  await sleep(2000); assert.equal(putCount, beforeRevocation + 1)
  console.log('PASS revoked authority dispatches no retry; uncertain upload is not retried')
  console.log(JSON.stringify({ ok: true, putCount, nativeSurfaces: 4 }))
} finally {
  if (suspended) {
    await promisify(execFile)('tmux', ['send-keys', '-t', process.env.TEST_PANE, '-l', '--', '|rein %harness [%.y %harness-tlon]'])
    await promisify(execFile)('tmux', ['send-keys', '-t', process.env.TEST_PANE, 'Enter'])
    await sleep(1000)
  }
  if (originals) {
    const { cred, conf } = originals
    await storageSet({ 'set-endpoint': cred.endpoint, 'set-access-key-id': cred.accessKeyId, 'set-secret-access-key': cred.secretAccessKey, 'set-region': conf.region, 'set-current-bucket': conf.currentBucket, 'set-public-url-base': conf.publicUrlBase, 'toggle-service': conf.service })
    for (const added of new Set([bucket, conf.currentBucket])) if (!conf.buckets.includes(added)) await storageSet({ 'remove-bucket': added })
    assert.deepEqual((await scry('storage/credentials'))['storage-update'].credentials, cred)
    assert.deepEqual((await scry('storage/configuration'))['storage-update'].configuration, conf)
    await client.call('harness/defaults/configure', { config: { ...originals.defaults, key: '' } })
    await client.call('harness/tlon/configure', originals.policy)
  }
  await client.close()
  for (const server of [storage, model]) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
}
