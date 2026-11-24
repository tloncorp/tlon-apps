// Two local fake ships: ownership setup, real roles, invitations and join flows.
// Uses a deterministic model; deletes only unique fixture groups and restores policy.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

assert.ok(process.env.PEER_COOKIE && process.env.PEER_URL, 'Set PEER_COOKIE and PEER_URL')
const row = (await readFile(process.env.PEER_COOKIE, 'utf8')).split('\n').find((line) => /\turbauth-~/.test(line)).split('\t')
const peer = row[5].slice('urbauth-'.length), peerCookie = `${row[5]}=${row[6]}`
const ship = cookie.split('=')[0].slice('urbauth-'.length)
assert.ok(['~lux', '~nec', '~bud', '~zod'].includes(ship) && ['~lux', '~nec', '~bud', '~zod'].includes(peer) && ship !== peer)
const slug = `roles-${randomUUID().slice(0, 8)}`, group = `${ship}/${slug}`, foreign = `${peer}/${slug}`
const client = new Client(), sessionId = slug, errors = []
let policy, sessionCreated = false, localCreated = false, foreignCreated = false, calls = 0, requests = 0, peerEvent = 0
let args, result
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw); requests++
    const after = body.messages.findLastIndex((message) => message.role === 'user')
    const reply = body.messages.slice(after + 1).find((message) => message.role === 'tool')
    const tool = body.tools.find((tool) => tool.function.name === 'tlon')
    assert.ok(tool); assert.match(tool.function.description, /parallel channels/)
    if (reply) result = reply.content
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ choices: [{ finish_reason: reply ? 'stop' : 'tool_calls', message: reply
      ? { role: 'assistant', content: 'DONE' }
      : { role: 'assistant', content: '', tool_calls: [{ id: `group-${calls}`, type: 'function', function: { name: 'tlon', arguments: JSON.stringify(args) } }] },
    }] }))
  } catch (error) { errors.push(error); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] })) }
})
async function scry(path, remote = false) {
  const response = await fetch(`${remote ? process.env.PEER_URL : base}/~/scry/${path}.json`, {
    headers: { cookie: remote ? peerCookie : cookie }, signal: AbortSignal.timeout(15000),
  })
  assert.ok(response.ok, `scry ${path}: HTTP ${response.status}`); return response.json()
}
const groups = (remote = false) => scry('groups/v2/groups', remote)
const foreigns = (remote = false) => scry('groups/v1/foreigns', remote)
async function until(label, predicate) {
  for (let i = 0; i < 90; i++) { if (await predicate()) return; await sleep(250) }
  throw new Error(`Timed out: ${label}`)
}
async function poke(mark, json, remote = false) {
  if (!remote) return client.pokeAgent('groups', mark, json)
  const response = await fetch(`${process.env.PEER_URL}/~/channel/${slug}`, {
    method: 'PUT', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify([{ id: ++peerEvent, action: 'poke', ship: peer.slice(1), app: 'groups', mark, json }]),
    signal: AbortSignal.timeout(15000),
  })
  assert.ok(response.ok, `peer poke HTTP ${response.status}`)
}
const groupAction = (flag, action, remote = false) => poke('group-action-4', { group: { flag, 'a-group': action } }, remote)
const hasInvite = (state, flag) => state[flag]?.invites?.some((invite) => invite.valid)
async function invoke(action, parameters = {}, expected = 'accepted') {
  calls++; args = { action, ...parameters }; result = undefined
  await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: `${calls}: ${action}` }] })
  if (errors.length) throw new AggregateError(errors)
  assert.ok(result, `missing ${action} receipt`)
  if (expected === 'error') assert.match(result, /^error: invalid Tlon action/)
  else if (expected === 'taken') assert.match(result, /^error: this ship already has a group named/)
  else if (expected === 'read') { const parsed = JSON.parse(result); console.log(`PASS ${action}`); return parsed }
  else assert.match(result, /^accepted:/)
  console.log(`PASS ${action}${['error', 'taken'].includes(expected) ? ' rejected safely' : ''}`)
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  policy = (await client.call('harness/tlon')).policy
  await client.call('harness/tlon/configure', { ...policy, enabled: false })
  await client.call('session/new', { name: sessionId }); sessionCreated = true
  await client.call('harness/session/configure', { sessionId, config: {
    url: `http://127.0.0.1:${server.address().port}`, model: 'group-fixture', key: '', headers: [], system: 'Fixture', 'max-context': 100000, tools: ['tlon'],
  } })
  assert.ok(!(await groups())[group] && !(await groups(true))[foreign], 'Fixture names must not already exist')
  localCreated = true
  await invoke('create_group', { name: slug, title: 'Requester group', owner: peer })
  await until('owner admin seat', async () => (await groups())[group]?.seats?.[peer]?.roles.includes('admin'))
  await until('owner received invitation', async () => hasInvite(await foreigns(true), group))
  await invoke('create_group', { name: slug, title: 'Forbidden replacement' }, 'taken')
  assert.equal((await groups())[group].meta.title, 'Requester group')
  assert.ok((await invoke('list_roles', { group }, 'read')).items.some((role) => role.role === 'admin' && role.admin))
  await invoke('create_role', { group, role: 'editors', title: 'Editors', description: 'Preserve me' })
  await invoke('update_role', { group, role: 'editors', title: 'Writers' })
  const roles = await invoke('list_roles', { group }, 'read')
  assert.ok(roles.items.some((role) => role.role === 'editors' && role.title === 'Writers' && role.description === 'Preserve me' && !role.admin))
  await invoke('assign_role', { group, role: 'editors', ship: peer })
  await invoke('remove_role', { group, role: 'editors', ship: peer })
  await invoke('assign_role', { group, role: 'editors', ship: peer })
  await invoke('promote_member', { group, role: 'editors', ship: peer }, 'error')
  await invoke('create_role', { group, role: 'steward', title: 'Steward' })
  // Fixture setup marks a second role as admin using the native host-only API.
  await groupAction(group, { role: { roles: ['steward'], 'a-role': { 'set-admin': null } } })
  await until('second native admin role', async () => (await groups())[group].admins.includes('steward'))
  await invoke('promote_member', { group, role: 'steward', ship: peer })
  await invoke('demote_member', { group, ship: peer })
  let member = (await invoke('list_members', { group }, 'read')).items.find((member) => member.ship === peer)
  assert.equal(member.admin, false); assert.deepEqual(member.roles, ['editors'])
  await invoke('promote_member', { group, ship: peer })
  member = (await invoke('list_members', { group }, 'read')).items.find((member) => member.ship === peer)
  assert.equal(member.admin, true)
  await invoke('demote_member', { group, ship }, 'error')
  await poke('group-join', { flag: group, 'join-all': true }, true)
  await until('requester actually joined', async () => (await groups(true))[group])
  await invoke('set_group_privacy', { group, privacy: 'private' })
  await until('privacy propagated', async () => (await groups(true))[group]?.admissions?.privacy === 'private')
  await poke('group-leave', group, true)
  await until('requester left', async () => !(await groups())[group].seats[peer])
  await poke('group-knock', group, true)
  await until('join request arrived', async () => (await groups())[group].admissions.requests[peer])
  assert.ok((await invoke('list_group_requests', { group }, 'read')).requests.includes(peer))
  await invoke('approve_join_request', { group, ship: peer })
  await until('approved requester joined', async () => (await groups(true))[group] && (await groups())[group].seats[peer])
  await poke('group-leave', group, true)
  await until('requester left again', async () => !(await groups())[group].seats[peer])
  await poke('group-knock', group, true)
  await until('second join request arrived', async () => (await groups())[group].admissions.requests[peer])
  await invoke('reject_join_request', { group, ship: peer })
  await until('request rejected', async () => !(await groups())[group].admissions.requests[peer])
  await invoke('approve_join_request', { group, ship: peer }, 'error')
  await invoke('invite_to_group', { group, ship: peer })
  await until('new invite recorded', async () => (await groups())[group].admissions.invited[peer])
  await invoke('revoke_group_invite', { group, ship: peer })
  await until('invite revoked', async () => !(await groups())[group].admissions.invited[peer])

  // The peer hosts a separate fixture, initially with no admin rights for us.
  foreignCreated = true
  const created = await fetch(`${process.env.PEER_URL}/spider/groups/group-create-thread/group-create-1/group-ui-2.json`, {
    method: 'POST', headers: { cookie: peerCookie, 'content-type': 'application/json' },
    body: JSON.stringify({ groupId: foreign, meta: { title: 'Foreign fixture' }, guestList: [], channels: [] }), signal: AbortSignal.timeout(30000),
  })
  assert.ok(created.ok, `peer create HTTP ${created.status}`)
  await until('foreign fixture exists', async () => (await groups(true))[foreign])
  await poke('group-action-4', { invite: { flag: foreign, ships: [ship], 'a-invite': { token: null, note: null } } }, true)
  await until('foreign invite arrived', async () => hasInvite(await foreigns(), foreign))
  assert.ok((await invoke('list_group_invites', {}, 'read')).items.some((item) => item.group === foreign && item.has_invite))
  await invoke('decline_group_invite', { group: foreign })
  await until('foreign invite declined', async () => !hasInvite(await foreigns(), foreign))
  await poke('group-action-4', { invite: { flag: foreign, ships: [ship], 'a-invite': { token: null, note: null } } }, true)
  await until('foreign reinvite arrived', async () => hasInvite(await foreigns(), foreign))
  await invoke('accept_group_invite', { group: foreign })
  await until('joined foreign fixture', async () => (await groups())[foreign])
  await invoke('create_role', { group: foreign, role: 'forbidden', title: 'Forbidden' }, 'error')
  await invoke('set_group_privacy', { group: foreign, privacy: 'public' }, 'error')
  await invoke('list_group_requests', { group: foreign }, 'error')
  assert.equal((await groups(true))[foreign].admissions.privacy, 'secret')
  assert.ok(!(await groups(true))[foreign].roles.forbidden)
  await invoke('leave_group', { group: foreign })
  await until('left foreign group', async () => !(await groups())[foreign] && !(await groups(true))[foreign].seats[ship])
  await groupAction(foreign, { entry: { privacy: 'private' } }, true)
  await invoke('request_group_invite', { group: foreign })
  await until('our request arrived remotely', async () => (await groups(true))[foreign].admissions.requests[ship])
  await invoke('cancel_group_join', { group: foreign })
  await until('our request cancelled remotely', async () => !(await groups(true))[foreign].admissions.requests[ship])
  await invoke('request_group_invite', { group: foreign })
  await until('our second request arrived', async () => (await groups(true))[foreign].admissions.requests[ship])
  await groupAction(foreign, { entry: { ask: { ships: [ship], 'a-ask': 'approve' } } }, true)
  await until('remote approval joined us', async () => (await groups())[foreign])
  await groupAction(foreign, { seat: { ships: [ship], 'a-seat': { 'add-roles': ['admin'] } } }, true)
  await until('remote admin grant propagated', async () => (await groups())[foreign].seats[ship].roles.includes('admin'))
  await invoke('create_role', { group: foreign, role: 'remote-editor', title: 'Remote editor' })
  await until('authorized remote mutation applied', async () => (await groups(true))[foreign].roles['remote-editor'])
  await invoke('demote_member', { group: foreign, ship })
  await until('self-demotion propagated', async () => !(await groups())[foreign].seats[ship].roles.includes('admin'))
  await invoke('create_role', { group: foreign, role: 'after-demotion', title: 'Forbidden after demotion' }, 'error')
  assert.ok(!(await groups(true))[foreign].roles['after-demotion'])
  assert.equal(requests, calls * 2, 'one tool round trip per call, no automatic mutation retry')
  console.log(`PASS ${calls} group tool cases; owner invitation, actual admin authority, remote administration and complete join lifecycle`)
} finally {
  try {
    if (localCreated) await groupAction(group, { delete: null })
    if (foreignCreated) await groupAction(foreign, { delete: null }, true)
    if (localCreated) await until('local fixture deleted', async () => !(await groups())[group])
    if (foreignCreated) await until('foreign fixture deleted', async () => !(await groups(true))[foreign])
  } finally {
    if (sessionCreated) { await client.call('session/cancel', { sessionId }); await client.call('session/delete', { sessionId }) }
    if (policy) await client.call('harness/tlon/configure', policy)
    await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
    if (peerEvent) await fetch(`${process.env.PEER_URL}/~/channel/${slug}`, { method: 'DELETE', headers: { cookie: peerCookie }, signal: AbortSignal.timeout(15000) })
  }
}
