// Ship-wide tool from an unbound Harness session, using a deterministic model.
// Creates a uniquely named secret group/channel and sends fixture messages to
// a local fake peer. Restores Tlon policy and deletes only its own fixtures.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'
import { GrantedTurns } from './lib/granted-turns.mjs'

const client = new Client(), failures = [], results = new Map(), grants = new GrantedTurns(client)
const ship = cookie.split('=')[0].slice('urbauth-'.length)
const peer = process.env.TEST_PEER || '~nec'
assert.ok(['~lux', '~zod', '~nec', '~bud'].includes(ship), 'Use a local fake test ship')
assert.ok(['~lux', '~zod', '~nec', '~bud'].includes(peer) && ship !== peer, 'Use a different local fake peer')
const slug = `tool-${randomUUID().slice(0, 8)}`, sessionId = slug, deniedSession = `${slug}-denied`, group = `${ship}/${slug}`, channel = `chat/${ship}/${slug}`
let policy, originalProfile, created = false, groupCreated = false, mode, args, requests = 0
let channelRoot, dmRoot, channelReply, dmReply, profileChanged = false, contactAdded = false
let contactShip, originalGroup, originalChannel
const server = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    requests++
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    const result = body.messages.slice(last + 1).find((m) => m.role === 'tool')
    const tool = body.tools.find((t) => t.function.name === 'tlon')
    assert.equal(Boolean(tool), mode !== 'denied')
    if (tool) {
      assert.match(tool.function.description, /automatically delivered.*current DM\/channel\/thread/)
      assert.match(tool.function.description, /parallel channels/)
    }
    if (result) results.set(mode, result.content)
    const message = result ? { role: 'assistant', content: `DONE_${mode}` }
      : { role: 'assistant', content: '', tool_calls: [{ id: mode, type: 'function', function: { name: 'tlon', arguments: JSON.stringify(args) } }] }
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ choices: [{ finish_reason: result ? 'stop' : 'tool_calls', message }] }))
  } catch (error) {
    failures.push(error)
    res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] }))
  }
})
async function scry(path) {
  const response = await fetch(`${base}/~/scry/${path}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(response.ok, `scry HTTP ${response.status}: ${path}`)
  return response.json()
}
async function until(check) {
  for (let i = 0; i < 60; i++) { const value = await check(); if (value) return value; await sleep(250) }
  throw new Error('Native fixture state did not arrive')
}
try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  await client.start()
  policy = (await client.call('harness/tlon')).policy
  await client.call('harness/tlon/configure', { ...policy, enabled: false })
  // Disabling the hand marks the bot offline in its profile, so snapshot after that.
  await sleep(3000)
  originalProfile = await scry('contacts/v1/self')
  await client.call('session/new', { name: sessionId }); created = true
  await client.call('session/new', { name: deniedSession })
  const cases = [
    ['denied', { action: 'create_group', name: slug, title: 'Forbidden fixture' }],
    ['invalid', { action: 'send_dm', ship: 'not-a-ship', text: 'Forbidden fixture' }],
    ['help', { action: 'help' }],
    ['contacts', { action: 'list_contacts' }],
    ['contact-add', () => ({ action: 'add_contact', ship: contactShip })],
    ['contact-check', () => ({ action: 'get_profile', ship: contactShip })],
    ['contact-remove', () => ({ action: 'remove_contact', ship: contactShip })],
    ['profile', { action: 'get_profile' }],
    ['profile-edit', { action: 'update_profile', nickname: slug }],
    ['profile-check', { action: 'get_profile' }],
    ['create', { action: 'create_group', name: slug, title: 'Tool conformance' }],
    ['groups', { action: 'list_groups' }],
    ['channel', { action: 'create_channel', group, name: slug, title: 'Tool conformance' }],
    ['channels', { action: 'list_channels', group }],
    ['members', { action: 'list_members', group }],
    ['group-edit', { action: 'update_group', group, title: 'Renamed group' }],
    ['channel-edit', { action: 'update_channel', group, channel, title: 'Renamed channel' }],
    ['group-check', { action: 'get_group', group }],
    ['post', { action: 'send_channel', channel, text: `${slug}-parallel-channel` }],
    ['dm', { action: 'send_dm', ship: peer, text: `${slug}-parallel-dm` }],
    ['dms', { action: 'list_dms' }],
    ['history-channel', { action: 'history', channel }],
    ['history-dm', { action: 'history', ship: peer }],
    ['search-channel', { action: 'search_history', channel, query: `${slug}-parallel-channel` }],
    ['reply-channel', () => ({ action: 'send_channel', channel, parent: channelRoot, text: `${slug}-thread-channel` })],
    ['reply-dm', () => ({ action: 'send_dm', ship: peer, parent: dmRoot, text: `${slug}-thread-dm` })],
    ['thread-channel', () => ({ action: 'history', channel, parent: channelRoot })],
    ['thread-dm', () => ({ action: 'history', ship: peer, parent: dmRoot })],
    ['react-channel', () => ({ action: 'react', channel, message_id: channelRoot, emoji: '👍' })],
    ['unreact-channel', () => ({ action: 'unreact', channel, message_id: channelRoot })],
    ['react-dm', () => ({ action: 'react', ship: peer, message_id: dmRoot, emoji: '👍' })],
    ['unreact-dm', () => ({ action: 'unreact', ship: peer, message_id: dmRoot })],
    ['react-channel-reply', () => ({ action: 'react', channel, parent: channelRoot, message_id: channelReply, emoji: '🧪' })],
    ['unreact-channel-reply', () => ({ action: 'unreact', channel, parent: channelRoot, message_id: channelReply })],
    ['react-dm-reply', () => ({ action: 'react', ship: peer, parent: dmRoot, message_id: dmReply, emoji: '🧪' })],
    ['unreact-dm-reply', () => ({ action: 'unreact', ship: peer, parent: dmRoot, message_id: dmReply })],
    ['missing-channel', { action: 'history', channel: `chat/${ship}/nonexistent-${slug}` }],
    ['missing-parent', { action: 'history', channel, parent: '~2026.01.01' }],
    ['ambiguous-destination', { action: 'history', ship: peer, channel }],
    ['empty-profile-edit', { action: 'update_profile' }],
    ['invite', { action: 'invite_to_group', group, ship: peer }],
  ]
  for ([mode, args] of cases) {
    if (typeof args === 'function') args = args()
    // Owner turns aren't limited by saved grants, so denial is checked through a hand.
    const target = mode === 'denied' ? deniedSession : sessionId
    await client.call('harness/session/configure', { sessionId: target, config: {
      url: `http://127.0.0.1:${server.address().port}`, model: 'tlon-fixture', key: '', headers: [], system: 'Fixture',
      'max-context': 100000, tools: mode === 'denied' ? [] : ['tlon'],
    } })
    if (mode === 'denied') await grants.prompt(deniedSession, mode)
    else await client.call('session/prompt', { sessionId, prompt: [{ type: 'text', text: mode }] })
    if (failures.length) throw new AggregateError(failures)
    const result = results.get(mode)
    assert.ok(result, `missing ${mode} receipt`)
    if (mode === 'denied') assert.match(result, /not granted|rejected/)
    else if (['invalid', 'missing-channel', 'missing-parent', 'ambiguous-destination', 'empty-profile-edit'].includes(mode)) assert.match(result, /^error: invalid Tlon action/)
    else if (['create', 'channel', 'post', 'dm', 'invite', 'profile-edit', 'group-edit', 'channel-edit', 'reply-channel', 'reply-dm', 'contact-add', 'contact-remove'].includes(mode) || /^(un)?react-/.test(mode)) assert.match(result, /^accepted:/)
    if (mode === 'contacts') {
      assert.equal(JSON.parse(result).has_more, false, 'Need a complete contact list before choosing a disposable fixture')
      const contacts = JSON.parse(result).items
      contactShip = ['~zod', '~bud', '~nec'].find((s) => s !== ship && !contacts.some((c) => c.ship === s && c.contact))
      assert.ok(contactShip, 'Need an unused fake contact for the fixture')
    }
    if (mode === 'contact-add') contactAdded = true
    if (mode === 'contact-check') assert.equal(JSON.parse(result).ship, contactShip)
    if (mode === 'contact-remove') contactAdded = false
    if (mode === 'profile-edit') profileChanged = true
    if (mode === 'profile-check') {
      assert.equal(JSON.parse(result).profile.nickname, slug)
      const { nickname: _old, ...untouched } = originalProfile
      const { nickname: _new, ...current } = await scry('contacts/v1/self')
      assert.deepEqual(current, untouched, 'profile patch must preserve every omitted field')
    }
    if (mode === 'create') { groupCreated = true; await until(async () => (await scry('groups/v2/groups'))[group]) }
    if (mode === 'channel') await until(async () => (await scry('groups/v2/groups'))[group]?.channels?.[channel])
    if (mode === 'groups') assert.ok(JSON.parse(result).items.some((item) => item.group === group))
    if (mode === 'channels') {
      assert.ok(JSON.parse(result).channels.some((item) => item.channel === channel))
      originalGroup = (await scry('groups/v2/groups'))[group]
      originalChannel = originalGroup.channels[channel]
    }
    if (mode === 'members') assert.ok(JSON.parse(result).items.some((item) => item.ship === ship && item.admin))
    if (mode === 'group-check') {
      assert.equal(JSON.parse(result).title, 'Renamed group')
      assert.equal(JSON.parse(result).channels.find((item) => item.channel === channel).title, 'Renamed channel')
      const current = (await scry('groups/v2/groups'))[group]
      assert.deepEqual(current.meta, { ...originalGroup.meta, title: 'Renamed group' })
      assert.deepEqual(current.channels[channel], { ...originalChannel, meta: { ...originalChannel.meta, title: 'Renamed channel' } }, 'channel edit must preserve permissions and other metadata')
    }
    if (mode === 'dms') assert.ok(JSON.parse(result).items.some((item) => item.ship === peer))
    if (mode === 'history-channel') channelRoot = JSON.parse(result).messages.find((item) => item.text.includes(`${slug}-parallel-channel`)).message_id
    if (mode === 'history-dm') dmRoot = JSON.parse(result).messages.find((item) => item.text.includes(`${slug}-parallel-dm`)).message_id
    if (mode === 'search-channel') assert.equal(JSON.parse(result).messages[0].message_id, channelRoot)
    if (mode.startsWith('thread-')) {
      const json = JSON.parse(result)
      assert.equal(json.parent.message_id, mode === 'thread-channel' ? channelRoot : dmRoot)
      const reply = json.messages.find((item) => item.text.includes(`${slug}-${mode}`))
      assert.ok(reply)
      if (mode === 'thread-channel') channelReply = reply.message_id
      else dmReply = reply.message_id
    }
    if (mode === 'post') await until(async () => JSON.stringify(await scry(`channels/v4/${channel}/posts/newest/20/outline`)).includes(`${slug}-parallel-channel`))
    if (mode === 'dm') await until(async () => JSON.stringify(await scry(`chat/v4/dm/${peer}/writs/newest/20/light`)).includes(`${slug}-parallel-dm`))
    console.log(`PASS ${mode}`)
  }
  assert.equal(requests, cases.length * 2, 'one tool round trip, no automatic duplicate calls')
  console.log('PASS explicit broad grant, current-vs-parallel guidance, native group/channel/DM actions with Tlon replies disabled')
} finally {
  if (contactAdded) await client.pokeAgent('contacts', 'contact-action-1', { wipe: [contactShip] })
  if (profileChanged) {
    await client.pokeAgent('contacts', 'contact-action-1', { self: { nickname: originalProfile.nickname ?? null } })
    await until(async () => JSON.stringify((await scry('contacts/v1/self')).nickname) === JSON.stringify(originalProfile.nickname))
  }
  if (groupCreated) await client.pokeAgent('groups', 'group-action-4', { group: { flag: group, 'a-group': { delete: null } } })
  if (created) { await client.call('session/cancel', { sessionId }); await client.call('session/delete', { sessionId }) }
  await grants.close()
  if (policy) await client.call('harness/tlon/configure', policy)
  await client.close(); server.closeAllConnections(); await new Promise((resolve) => server.close(resolve))
}
