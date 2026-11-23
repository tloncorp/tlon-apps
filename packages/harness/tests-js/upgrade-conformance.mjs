// Seed Harness through its public interfaces, then check that every seeded value
// is still there after the desk is upgraded under it, on a disposable test ship.
// scripts/test-js.sh runs `seed` from the tree of the build the ship runs and
// `check` from the tree of the build it is upgraded to. No model, network or
// credentials: the conversation's provider URL is never dialed, schedules fire
// long after the run, and the Tlon hand stays disabled.
//
//   UPGRADE_ID        the fixture prefix, unique to each seed
//   UPGRADE_MANIFEST  the file `seed` writes and `check` reads
//   UPGRADE_KEYS=all  `check` requires the newer keys too, as for a manifest the
//                     same tree seeded
import assert from 'node:assert/strict'
import { readFile, writeFile } from 'node:fs/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'
import { HandClient } from '../acp/hand-client.mjs'

// Keys every seeder emits. A baseline key missing from a manifest fails the
// check, so dropping a seeded value cannot shrink the test.
const provider = ['url', 'model', 'headers', 'system', 'max-context', 'tools']
const publications = ['pending', 'claimed', 'delivered']
const publicationFields = [
  'event', 'actor', 'phase', 'state', 'attempt', 'worker', 'externalId', 'address', 'sessionId',
  'text', 'hand', 'binding', 'kind', 'capability', 'resolutions', 'receipts',
]
const baseline = {
  conversation: ['name', ...provider],
  config: [
    ...['defaults.url', 'defaults.model', 'defaults.headers', 'defaults.system'],
    ...provider.map((key) => `summary.compaction.${key}`), ...provider.map((key) => `summary.lcm.${key}`),
    'search.provider', 'search.instance-url',
  ],
  grants: ['peer.tools', 'peer.inflows', 'peer.budget', 'peer.model', 'peer.limit'],
  memory: ['text', 'source'],
  skills: ['desc', 'body'],
  mcp: ['name', 'url', 'headers', 'enabled'],
  hand: [
    'binding', 'hand', 'session', 'address', 'actors', 'enabled', 'observations',
    ...publications.flatMap((name) => publicationFields.map((field) => `${name}.${field}`)),
  ],
  schedules: [
    'cron.binding', 'cron.actor', 'cron.kind', 'cron.state', 'cron.prompt', 'cron.schedule', 'cron.destination',
    'timer.prompt', 'timer.every', 'timer.at',
  ],
  tlon: ['enabled', 'owner', 'trusted', 'response', 'allowed', 'channels'],
}
// Keys an older seeder may not emit. Checked when the manifest has them; a key
// moves to the baseline once the seeder of every long-lived branch emits it.
const newer = {}

const sections = Object.keys(baseline)
const id = process.env.UPGRADE_ID
assert.match(id || '', /^upgrade-[a-z0-9-]{4,40}$/, 'UPGRADE_ID')
const manifestPath = process.env.UPGRADE_MANIFEST
assert.ok(manifestPath, 'UPGRADE_MANIFEST')
const mode = process.argv[2]
assert.ok(['seed', 'check'].includes(mode), 'mode is seed or check')

const peer = '~sampel-palnet'
const client = new Client()
const hand = new HandClient(client, { hand: id, worker: `${id}-worker` })

// A canonical @uv for a schedule id, unique to this fixture prefix.
function uv(text) {
  let value = 0n
  for (const byte of Buffer.from(text)) value = (value * 131n + BigInt(byte)) % (1n << 100n)
  return `0v${value.toString(32).replace(/\B(?=(.{5})+$)/g, '.')}`
}

async function scry(path) {
  const response = await fetch(`${base}/~/scry/${path}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(response.ok, `${path}: HTTP ${response.status}`)
  return response.json()
}

// What the ship reports now for the fixtures that `ids` name, by section and key.
async function values(ids) {
  const config = await client.call('harness/session/config', { sessionId: ids.session })
  const listed = (await client.call('session/list')).sessions.find((row) => row.sessionId === ids.session)
  const defaults = await client.call('harness/defaults')
  const summary = await client.call('harness/summary-models')
  const search = await client.call('harness/search')
  const peers = await client.call('harness/peers')
  const grant = peers.grants.find((row) => row.ship === peer)
  const memory = await scry(`harness/memory/${ids.memory}`)
  const skill = await client.call('harness/skill', { name: ids.skill })
  const server = (await client.call('harness/mcp/servers')).find((row) => row.id === ids.mcp)
  const status = await hand.status(ids.binding)
  const records = (await hand.records(ids.binding, null, 16)).records
  // A publication, found by its observation's text, as the seed determined it.
  // The ship's ids and times, and the record version, which the build sets,
  // are left out.
  const publication = (text) => {
    const row = records.find((record) => record.text === text)
    if (!row) return undefined
    const { status: state, attempt, worker, externalId, address, sessionId, receipts } = row.publication
    return {
      event: row.event, actor: row.actor, phase: row.phase, state, attempt, worker, externalId, address, sessionId,
      text: row.publication.text, hand: row.publication.hand, binding: row.publication.binding,
      kind: row.publication.kind, capability: row.publication.capability, resolutions: row.publication.resolutions,
      receipts: receipts.map((receipt) => ({ status: receipt.status, worker: receipt.worker, externalId: receipt.externalId })),
    }
  }
  const cron = (await client.call('harness/cron')).find((row) => row.id === ids.cron)
  const timer = (await scry('harness/timers')).find((row) => row.sid === ids.session && row.name === ids.timer)
  const tlon = (await client.call('harness/tlon')).policy
  const sorted = (rows) => [...rows].sort()
  const fields = (prefix, config) => Object.fromEntries(provider.map((key) => [`${prefix}${key}`, config?.[key]]))
  return {
    conversation: { name: listed?.title, ...fields('', config) },
    config: {
      'defaults.url': defaults.url, 'defaults.model': defaults.model, 'defaults.headers': defaults.headers, 'defaults.system': defaults.system,
      ...fields('summary.compaction.', summary.compaction), ...fields('summary.lcm.', summary.lcm),
      'search.provider': search.provider, 'search.instance-url': search['instance-url'],
    },
    grants: {
      'peer.tools': grant?.tools, 'peer.inflows': grant?.inflows, 'peer.budget': grant?.budget, 'peer.model': grant?.model,
      'peer.limit': (peers.limits || []).find((row) => row.ship === peer)?.budget,
    },
    memory: { text: memory.text, source: memory.source?.sessionId },
    skills: { desc: skill.desc, body: skill.body },
    mcp: { name: server?.name, url: server?.url, headers: server?.headers, enabled: server?.enabled },
    hand: {
      binding: status.binding, hand: status.hand, session: status.sessionId,
      address: status.address, actors: status.actors, enabled: status.enabled,
      observations: status.observations.map((row) => `${row.sourceEvent}: ${row.phase}`).sort(),
      ...Object.fromEntries(publications.flatMap((name) => {
        const row = publication(ids[name])
        return publicationFields.map((field) => [`${name}.${field}`, row?.[field]])
      })),
    },
    schedules: {
      'cron.binding': cron?.sourceBinding, 'cron.actor': cron?.actor, 'cron.kind': cron?.kind, 'cron.state': cron?.state,
      'cron.prompt': cron?.prompt, 'cron.schedule': cron?.schedule, 'cron.destination': cron?.destination,
      'timer.prompt': timer?.prompt, 'timer.every': timer?.every, 'timer.at': timer?.at,
    },
    tlon: {
      enabled: tlon.enabled, owner: tlon.owner, response: tlon.response,
      trusted: tlon.trusted, allowed: sorted(tlon.allowed), channels: tlon.channels,
    },
  }
}

async function seed() {
  const ids = {
    session: id, memory: `${id}-memory`, skill: `${id}-skill`, mcp: `${id}-mcp`, binding: `${id}-binding`,
    cron: uv(`${id}-cron`), timer: 'upgrade-timer', pending: `${id} pending`, claimed: `${id} claimed`, delivered: `${id} delivered`,
  }
  const actor = 'upgrade-actor', address = `room/${id}`, worker = `${id}-worker`, external = `${id}-external`
  const url = 'http://127.0.0.1:1/never-dispatch'
  const headers = (name) => [{ name: 'x-upgrade', value: `${id}-${name}` }]
  const conversation = { url, model: `${id}-model`, headers: headers('conversation'), system: `${id} system`, 'max-context': 81234, tools: ['skills', 'curl'] }
  // Summary models keep no instructions of their own, so theirs is left empty.
  const summary = (name, size) => ({ url: `${url}/${name}`, model: `${id}-${name}`, headers: headers(name), system: '', 'max-context': size, tools: [] })
  const compaction = summary('compaction', 64001), lcm = summary('lcm', 64002)
  const grant = { ship: peer, tools: ['web'], inflows: [ids.skill], budget: 4321, model: `${id}-peer-model` }
  const server = { id: ids.mcp, name: `${id} server`, url: `http://127.0.0.1:1/${id}/mcp`, headers: headers('mcp'), enabled: false }
  const later = new Date(Date.now() + 30 * 86_400_000).toISOString().replace(/\.\d{3}Z$/, 'Z')
  const timer = { sid: ids.session, name: ids.timer, in: 30 * 86_400, every: 7200, prompt: `${id} timer prompt` }
  const policy = {
    enabled: false, owner: '~nec', response: 'all', allowed: ['~bud', '~wes'],
    channels: [{ channel: `chat/~nec/${id}`, response: 'off', everyone: true }],
    trusted: [{ ship: '~marzod', tools: [{ clay: `/harness/${id}` }] }],
  }

  // Configs go with an empty key: provider reads never return credentials.
  assert.equal((await client.call('session/new', { name: id })).sessionId, ids.session)
  await client.call('harness/session/configure', { sessionId: ids.session, config: { ...conversation, key: '' } })
  const defaults = await client.call('harness/defaults')
  await client.call('harness/defaults/configure', { config: {
    ...defaults, url, key: '', headers: headers('defaults'), model: `${id}-default-model`, system: `${id} default system`,
  } })
  await client.call('harness/summary-models/configure', { models: { compaction: { ...compaction, key: '' }, lcm: { ...lcm, key: '' } } })
  await client.call('harness/search/configure', { config: { provider: 'searxng', 'instance-url': `http://127.0.0.1:1/${id}` } })
  const peers = await client.call('harness/peers')
  await client.call('harness/peers/configure', {
    revision: peers.revision, config: peers.config,
    grants: [...peers.grants.filter((row) => row.ship !== peer), grant],
    limits: [...(peers.limits || []).filter((row) => row.ship !== peer), { ship: peer, budget: 8765 }],
  })
  await client.call('session/prompt', { sessionId: ids.session, prompt: [{ type: 'text', text: `/remember ${ids.memory} ${id} remembered fact` }] })
  await client.call('harness/skill/save', { name: ids.skill, desc: `${id} skill`, body: `${id} instructions`, revision: '' })
  const servers = await client.call('harness/mcp/servers')
  await client.call('harness/mcp/configure', { servers: [...servers, server] })
  await hand.bind(ids.binding, { address, sessionId: ids.session, actors: [actor] })
  await hand.action('notify', { binding: ids.binding, event: `${id}-pending`, actor, text: ids.pending })
  const claimed = await hand.action('notify', { binding: ids.binding, event: `${id}-claimed`, actor, text: ids.claimed })
  await hand.claim(claimed.inputId)
  const delivered = await hand.action('notify', { binding: ids.binding, event: `${id}-delivered`, actor, text: ids.delivered })
  await hand.deliver(delivered.inputId, async () => external)
  await hand.schedule(ids.binding, { id: ids.cron, actor, kind: 'reminder', at: later, destination: address, text: `${id} reminder` })
  const poked = Date.now()
  await client.pokeAgent('harness', 'harness-action', { 'timer-set': timer })
  const answered = Date.now()
  await client.call('harness/tlon/configure', policy)

  const published = (name, state, attempt, receipts) => Object.fromEntries(Object.entries({
    event: `${id}-${name}`, actor, phase: 'completed', state, attempt, worker: attempt ? worker : '',
    externalId: state === 'delivered' ? external : '', address, sessionId: ids.session,
    text: ids[name], hand: id, binding: ids.binding, kind: 'reply', capability: 'publish', resolutions: [], receipts,
  }).map(([field, value]) => [`${name}.${field}`, value]))
  const expected = {
    conversation: { name: id, ...conversation },
    config: {
      'defaults.url': url, 'defaults.model': `${id}-default-model`, 'defaults.headers': headers('defaults'), 'defaults.system': `${id} default system`,
      ...Object.fromEntries(provider.map((key) => [`summary.compaction.${key}`, compaction[key]])),
      ...Object.fromEntries(provider.map((key) => [`summary.lcm.${key}`, lcm[key]])),
      'search.provider': 'searxng', 'search.instance-url': `http://127.0.0.1:1/${id}`,
    },
    grants: { 'peer.tools': grant.tools, 'peer.inflows': grant.inflows, 'peer.budget': grant.budget, 'peer.model': grant.model, 'peer.limit': 8765 },
    memory: { text: `${id} remembered fact`, source: ids.session },
    skills: { desc: `${id} skill`, body: `${id} instructions` },
    mcp: { name: server.name, url: server.url, headers: server.headers, enabled: server.enabled },
    hand: {
      binding: ids.binding, hand: id, session: ids.session, address, actors: [actor], enabled: true,
      observations: ['pending', 'claimed', 'delivered'].map((name) => `${id}-${name}: completed`).sort(),
      ...published('pending', 'pending', 0, []),
      ...published('claimed', 'claimed', 1, [{ status: 'claimed', worker, externalId: '' }]),
      ...published('delivered', 'delivered', 1, [{ status: 'claimed', worker, externalId: '' }, { status: 'delivered', worker, externalId: external }]),
    },
    schedules: {
      'cron.binding': ids.binding, 'cron.actor': actor, 'cron.kind': 'reminder', 'cron.state': 'active',
      'cron.prompt': `${id} reminder`, 'cron.schedule': later, 'cron.destination': address,
      'timer.prompt': timer.prompt, 'timer.every': '~h2', 'timer.at': null,
    },
    tlon: { ...policy },
  }
  const seeded = await values(ids)
  // The ship sets the timer's deadline when it takes the poke, so it is recorded
  // only once it lies the requested delay after the poke.
  const at = seeded.schedules['timer.at']
  assertDeadline(at, poked + timer.in * 1000, answered + timer.in * 1000)
  expected.schedules['timer.at'] = at
  // The seed must have taken before anything can be said about the upgrade.
  compare(expected, seeded, true)
  await writeFile(manifestPath, `${JSON.stringify({ id, ids, sections: expected }, null, 2)}\n`)
}

// Milliseconds since the epoch of an @da such as ~2026.12.20..12.51.04..163b.
function parseDa(text) {
  const match = /^~(\d+)\.(\d+)\.(\d+)(?:\.\.(\d+)\.(\d+)\.(\d+)(?:\.\.([0-9a-f.]+))?)?$/.exec(text ?? '')
  if (!match) return NaN
  const [year, month, day, hour = 0, minute = 0, second = 0] = match.slice(1, 7).map(Number)
  const fraction = match[7] ? parseInt(match[7].replaceAll('.', '').slice(0, 4).padEnd(4, '0'), 16) / 65536 : 0
  return Date.UTC(year, month - 1, day, hour, minute, second) + Math.floor(fraction * 1000)
}

// Require the @da `at` to fall from `earliest` to `latest`, in milliseconds,
// give or take two seconds of clock skew between the ship and this process.
function assertDeadline(at, earliest, latest) {
  const time = parseDa(at)
  assert.ok(Number.isFinite(time), `timer.at: ${JSON.stringify(at)} is not a date`)
  assert.ok(time >= earliest - 2000 && time <= latest + 2000,
    `timer.at: ${at} is not between ${new Date(earliest).toISOString()} and ${new Date(latest).toISOString()}`)
}

// Compare the manifest's values with the ship's, key by key, and fail naming
// every key that differs or that the manifest lacks.
function compare(expected, actual, all) {
  const failures = []
  for (const section of sections) {
    const keys = [...baseline[section].map((key) => [key, true]), ...(newer[section] || []).map((key) => [key, all])]
    for (const [key, required] of keys) {
      const name = `${section}.${key}`
      if (!(key in (expected[section] || {}))) {
        if (required) failures.push(`${name}: missing from the manifest`)
        else console.log(`${name}: not seeded by base`)
        continue
      }
      try {
        assert.deepEqual(actual[section][key], expected[section][key])
      } catch {
        failures.push(`${name}: expected ${JSON.stringify(expected[section][key])}, found ${JSON.stringify(actual[section][key])}`)
      }
    }
  }
  if (failures.length) throw new Error(`Seeded values differ:\n  ${failures.join('\n  ')}`)
}

try {
  await client.start()
  if (mode === 'seed') {
    await seed()
    console.log(JSON.stringify({ ok: true, mode, id, manifest: manifestPath }))
  } else {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    compare(manifest.sections, await values(manifest.ids), process.env.UPGRADE_KEYS === 'all')
    console.log(JSON.stringify({ ok: true, mode, id: manifest.id, sections }))
  }
} finally { await client.close() }
