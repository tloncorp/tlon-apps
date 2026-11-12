// Real native actions on local fake ships, with a deterministic model.
// Deletes only uniquely named fixtures and restores policy/storage exactly.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

const ship = cookie.split('=')[0].slice('urbauth-'.length)
assert.equal(ship, '~lux', 'This fixture is restricted to the local fake ~lux')
const peer = '~nec', slug = `complete-${randomUUID().slice(0, 8)}`, group = `${ship}/${slug}`, channel = `chat/${ship}/${slug}`
const client = new Client(), errors = [], puts = []
let args, result, calls = 0, policy, originalStorage, storageMissing = false, session = false, createdGroup = false, notebook, club
const model = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    const reply = body.messages.slice(last + 1).find((m) => m.role === 'tool')
    assert.ok(body.tools.some((t) => t.function.name === 'tlon'))
    if (reply) result = reply.content
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ choices: [{ finish_reason: reply ? 'stop' : 'tool_calls', message: reply
      ? { role: 'assistant', content: 'DONE' }
      : { role: 'assistant', content: '', tool_calls: [{ id: `complete-${calls}`, type: 'function', function: { name: 'tlon', arguments: JSON.stringify(args) } }] },
    }] }))
  } catch (error) { errors.push(error); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] })) }
})
const storage = createServer(async (req, res) => {
  const chunks = []; for await (const part of req) chunks.push(part)
  puts.push({ url: req.url, data: Buffer.concat(chunks), type: req.headers['content-type'] })
  res.writeHead(200); res.end()
})
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = (server) => `http://127.0.0.1:${server.address().port}`
async function scry(path) {
  const response = await fetch(`${base}/~/scry/${path}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(response.ok, `${path}: HTTP ${response.status}`); return response.json()
}
async function until(label, predicate) {
  for (let i = 0; i < 80; i++) { if (await predicate()) return; await sleep(250) }
  throw new Error(`Timed out: ${label}`)
}
async function invoke(action, parameters = {}, expected = 'accepted') {
  calls++; args = { action, ...parameters }; result = undefined
  await client.call('session/prompt', { sessionId: slug, prompt: [{ type: 'text', text: `${calls}: ${action}` }] })
  assert.equal(errors.length, 0); assert.ok(result, `${action}: no result`)
  if (expected === 'read') { const value = JSON.parse(result); console.log(`PASS ${action}`); return value }
  if (expected === 'error') assert.match(result, /^(error:|failed:|rejected:)/, `${action}: ${result}`)
  else if (expected === 'saved') assert.match(result, /^(saved:|confirmed:)/, `${action}: ${result}`)
  else assert.match(result, /^accepted:/, `${action}: ${result}`)
  console.log(`PASS ${action}${expected === 'error' ? ' rejected safely' : ''}`)
  return result
}
const groupAction = (action) => client.pokeAgent('groups', 'group-action-4', { group: { flag: group, 'a-group': action } })
async function storageSet(fields) { for (const [name, value] of Object.entries(fields)) await client.pokeAgent('storage', 'storage-action', { [name]: value }) }
async function configure(tools) {
  await client.call('harness/session/configure', { sessionId: slug, config: {
    url: origin(model), model: 'completion-fixture', key: '', headers: [], system: 'Fixture', 'max-context': 200000, tools,
  } })
}
try {
  await Promise.all([listen(model), listen(storage)])
  await client.start()
  policy = (await client.call('harness/tlon')).policy
  await client.call('harness/tlon/configure', { ...policy, enabled: false })
  await client.call('session/new', { name: slug }); session = true
  await configure(['tlon'])
  assert.ok(!(await scry('groups/v2/groups'))[group])
  createdGroup = true
  await invoke('create_group', { name: slug, title: slug })
  await invoke('create_channel', { group, name: slug, title: 'Fixture' })
  assert.equal((await invoke('resolve_citation', { citation: `/1/group/${group}` }, 'read')).group, group)
  await invoke('create_role', { group, role: 'writers', title: 'Writers' })
  let permissions = await invoke('get_channel_permissions', { group, channel }, 'read')
  assert.deepEqual(permissions.readers, []); assert.deepEqual(permissions.writers, [])
  await invoke('add_channel_readers', { group, channel, role: 'writers' })
  await invoke('add_channel_writers', { group, channel, role: 'writers' })
  permissions = await invoke('get_channel_permissions', { group, channel }, 'read')
  assert.deepEqual(permissions.readers, ['writers']); assert.deepEqual(permissions.writers, ['writers'])
  await invoke('remove_channel_readers', { group, channel, role: 'writers' })
  await invoke('remove_channel_writers', { group, channel, role: 'writers' })
  await invoke('delete_role', { group, role: 'admin', confirm: 'admin' }, 'error')
  await invoke('delete_role', { group, role: 'writers', confirm: 'wrong' }, 'error')
  await invoke('delete_role', { group, role: 'writers', confirm: 'writers' })
  await invoke('ban_member', { group, ship, confirm: ship }, 'error')
  await invoke('ban_member', { group, ship: peer, confirm: peer })
  await invoke('unban_member', { group, ship: peer, confirm: peer })
  await invoke('invite_to_group', { group, ship: peer })
  await groupAction({ seat: { ships: [peer], 'a-seat': { add: null } } })
  await until('member seat', async () => (await scry('groups/v2/groups'))[group].seats[peer])
  await invoke('kick_member', { group, ship: peer, confirm: peer })
  await until('member removed', async () => !(await scry('groups/v2/groups'))[group].seats[peer])

  const text = `${slug} ${'α👍'.repeat(500)} ending-search-marker`
  for (const target of [{ ship: peer }, { channel }]) {
    await invoke(target.ship ? 'send_dm' : 'send_channel', { ...target, text })
    const history = await invoke('history', target, 'read')
    const post = history.messages.find((p) => p.text.startsWith(slug)); assert.ok(post)
    assert.equal(post.text_truncated, true)
    const found = await invoke('search_history', { ...target, query: 'ending-search-marker' }, 'read')
    assert.ok(found.messages.some((p) => p.message_id === post.message_id))
    let body = '', offset
    do {
      const part = await invoke('get_message', { ...target, message_id: post.message_id, ...(offset ? { offset } : {}) }, 'read')
      body += part.text; offset = part.next_offset
    } while (offset)
    assert.equal(body, text)
    if (!target.ship) {
      const native = await scry(`channels/v5/${channel}/posts/newest/20/post`)
      const [nativeId] = Object.entries(native.posts).find(([, p]) => JSON.stringify(p.essay?.content).includes('ending-search-marker'))
      const cited = await invoke('resolve_citation', { citation: `/1/chan/${channel}/msg/${nativeId}` }, 'read')
      assert.equal(cited.message_id, post.message_id)
    }
    const around = await invoke('history_around', { ...target, message_id: post.message_id }, 'read')
    assert.ok(around.messages.some((p) => p.message_id === post.message_id))
    await invoke('edit_message', { ...target, message_id: post.message_id, text: `${slug} edited` }, target.ship ? 'error' : 'accepted')
    if (!target.ship) assert.equal((await invoke('get_message', { ...target, message_id: post.message_id }, 'read')).text, `${slug} edited`)
    await invoke(target.ship ? 'send_dm' : 'send_channel', { ...target, parent: post.message_id, text: `${slug} reply` })
    const thread = await invoke('history', { ...target, parent: post.message_id }, 'read')
    const reply = thread.messages.find((p) => p.text === `${slug} reply`); assert.ok(reply)
    await invoke('edit_message', { ...target, parent: post.message_id, message_id: reply.message_id, text: 'edited reply' }, target.ship ? 'error' : 'accepted')
    if (!target.ship) assert.equal((await invoke('get_message', { ...target, parent: post.message_id, message_id: reply.message_id }, 'read')).text, 'edited reply')
    await invoke('history_around', { ...target, parent: post.message_id, message_id: reply.message_id }, 'read')
    await invoke('delete_message', { ...target, parent: post.message_id, message_id: reply.message_id, confirm: reply.message_id })
    await invoke('get_message', { ...target, parent: post.message_id, message_id: reply.message_id }, 'error')
    await invoke('delete_message', { ...target, message_id: post.message_id, confirm: 'wrong' }, 'error')
    await invoke('delete_message', { ...target, message_id: post.message_id, confirm: post.message_id })
    await invoke('get_message', { ...target, message_id: post.message_id }, 'error')
  }
  for (const filter of ['all', 'mentions', 'replies', 'unreads']) await invoke('activity_inbox', { filter }, 'read')
  assert.deepEqual((await invoke('list_groups', { offset: '100' }, 'read')).items, [])
  await invoke('accept_dm', { ship: peer }, 'error')
  await invoke('decline_dm', { ship: peer }, 'error')

  await invoke('list_clubs', {}, 'read')
  const created = await invoke('create_club', { ship: peer })
  club = /club=(0v[^; ]+)/.exec(created)?.[1]; assert.ok(club)
  assert.ok((await invoke('get_club', { club }, 'read')).members.includes(ship))
  await invoke('send_club', { club, text: `${slug} group DM` })
  const clubHistory = await invoke('club_history', { club }, 'read')
  const clubPost = clubHistory.messages.find((p) => p.text === `${slug} group DM`); assert.ok(clubPost)
  await invoke('send_club', { club, parent: clubPost.message_id, text: 'group DM reply' })
  assert.ok((await invoke('club_history', { club, parent: clubPost.message_id }, 'read')).messages.some((p) => p.text === 'group DM reply'))
  assert.ok((await invoke('search_club_history', { club, query: slug }, 'read')).messages.length)
  assert.equal((await invoke('get_club_message', { club, message_id: clubPost.message_id }, 'read')).text, `${slug} group DM`)
  const clubReply = (await invoke('club_history', { club, parent: clubPost.message_id }, 'read')).messages.find((p) => p.text === 'group DM reply')
  assert.equal((await invoke('get_club_message', { club, parent: clubPost.message_id, message_id: clubReply.message_id }, 'read')).text, 'group DM reply')
  await invoke('delete_club_message', { club, parent: clubPost.message_id, message_id: clubReply.message_id, confirm: clubReply.message_id })
  await invoke('delete_club_message', { club, message_id: clubPost.message_id, confirm: clubPost.message_id })
  await invoke('get_club_message', { club, message_id: clubPost.message_id }, 'error')

  const book = await invoke('create_notebook', { title: slug }, 'read'); notebook = book.notebook
  assert.ok(notebook)
  await invoke('rename_notebook', { notebook, title: `${slug} renamed` }, 'saved')
  const detail = await invoke('get_notebook', { notebook }, 'read')
  await invoke('create_folder', { notebook, folder_id: detail.root_folder_id, title: 'Drafts' }, 'saved')
  const folders = await invoke('list_folders', { notebook }, 'read')
  const folder = folders.items.find((f) => f.name === 'Drafts'); assert.ok(folder)
  await invoke('rename_folder', { notebook, folder_id: folder.folder_id, title: 'Writing' }, 'saved')
  await invoke('create_note', { notebook, folder_id: folder.folder_id, title: 'Fixture note', text: '# Original\nNative Notes' }, 'saved')
  const notes = await invoke('list_notes', { notebook }, 'read'), note = notes.items.find((n) => n.title === 'Fixture note'); assert.ok(note)
  await invoke('edit_note', { notebook, note_id: note.note_id, revision: note.revision, text: '# Revised\nSaved once' }, 'saved')
  await invoke('edit_note', { notebook, note_id: note.note_id, revision: note.revision, text: 'Must not overwrite' }, 'error')
  assert.equal((await invoke('get_note', { notebook, note_id: note.note_id }, 'read')).body.text, '# Revised\nSaved once')
  const revisions = await invoke('note_revisions', { notebook, note_id: note.note_id }, 'read'); assert.ok(revisions.items.length)
  await invoke('restore_note', { notebook, note_id: note.note_id, revision: revisions.items.at(-1).revision }, 'saved')
  await invoke('rename_note', { notebook, note_id: note.note_id, title: 'Renamed note' }, 'saved')
  await invoke('move_note', { notebook, note_id: note.note_id, folder_id: detail.root_folder_id }, 'saved')
  await invoke('delete_note', { notebook, note_id: note.note_id, confirm: 'wrong' }, 'error')
  await invoke('delete_note', { notebook, note_id: note.note_id, confirm: note.note_id }, 'saved')
  await invoke('delete_folder', { notebook, folder_id: folder.folder_id, confirm: folder.folder_id }, 'saved')

  const path = '/harness/lib/harness-tlon-tool/hoon'
  // The groups pill has no %storage. Pokes to it would pass silently, so ask first.
  storageMissing = (await fetch(`${base}/~/scry/storage/configuration.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })).status === 404
  if (storageMissing) {
    await configure(['tlon', { clay: path }])
    assert.match(await invoke('upload_file', { path }, 'error'), /configure Tlon storage/); assert.equal(puts.length, 0)
  } else {
    originalStorage = { cred: (await scry('storage/credentials'))['storage-update'].credentials, conf: (await scry('storage/configuration'))['storage-update'].configuration }
    await storageSet({ 'set-endpoint': origin(storage), 'set-access-key-id': 'COMPLETIONFIXTURE', 'set-secret-access-key': randomUUID(), 'set-region': 'us-east-1', 'set-current-bucket': slug, 'set-public-url-base': '', 'toggle-service': 'credentials' })
    await invoke('upload_file', { path }, 'error'); assert.equal(puts.length, 0)
    await configure(['tlon', { clay: '/harness/lib/harness-tlon-tool/hoon' }])
    const upload = await invoke('upload_file', { path }, 'read')
    assert.ok(upload.url.startsWith(origin(storage))); assert.equal(puts.length, 1)
    assert.equal(puts[0].type, 'text/plain'); assert.match(puts[0].data.toString(), /Public Tlon tool contract/)
    await invoke('upload_file', { path: '/harness/lib/harness-s3/hoon' }, 'error'); assert.equal(puts.length, 1)
    await invoke('upload_file', { path, url: 'https://example.com/test.txt' }, 'error'); assert.equal(puts.length, 1)
    const source = 'https://www.python.org/static/img/python-logo.png'
    const image = await invoke('upload_image', { url: source }, 'read')
    assert.equal(image.content_type, 'image/png'); assert.equal(puts.length, 2)
    const downloaded = await invoke('upload_file', { url: 'https://raw.githubusercontent.com/tloncorp/tlon-apps/938f0c44d693f6f7391cca8107c7b3a40b834a01/README.md' }, 'read')
    assert.equal(downloaded.content_type, 'text/plain'); assert.equal(puts.length, 3)
  }
  await invoke('delete_channel', { group, channel, confirm: channel })
  await invoke('delete_group', { group, confirm: group }); createdGroup = false
  await invoke('delete_notebook', { notebook, confirm: notebook }, 'saved'); notebook = undefined
  await invoke('leave_club', { club }); club = undefined
  if (storageMissing) {
    console.error(`INCOMPLETE ${calls} native Tlon completion cases passed, but the granted upload cases need the %storage agent, which this ship does not run.`)
    process.exitCode = 1
  } else console.log(`PASS ${calls} native Tlon completion cases`)
} finally {
  try {
    if (createdGroup) await groupAction({ delete: null })
    if (notebook) await client.pokeAgent('notes', 'notes-action', { type: 'notebook', flag: notebook, action: { type: 'delete' } })
    if (club) await invoke('leave_club', { club })
    if (originalStorage) {
      const { cred, conf } = originalStorage
      await storageSet({ 'set-endpoint': cred.endpoint, 'set-access-key-id': cred.accessKeyId, 'set-secret-access-key': cred.secretAccessKey, 'set-region': conf.region, 'set-current-bucket': conf.currentBucket, 'set-public-url-base': conf.publicUrlBase, 'toggle-service': conf.service })
      for (const added of new Set([slug, conf.currentBucket])) if (!conf.buckets.includes(added)) await storageSet({ 'remove-bucket': added })
      assert.deepEqual((await scry('storage/credentials'))['storage-update'].credentials, cred)
      assert.deepEqual((await scry('storage/configuration'))['storage-update'].configuration, conf)
    }
    if (session) { await client.call('session/cancel', { sessionId: slug }); await client.call('session/delete', { sessionId: slug }) }
    if (policy) await client.call('harness/tlon/configure', policy)
  } finally {
    await client.close()
    for (const server of [model, storage]) { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)) }
  }
}
