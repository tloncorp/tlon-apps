// End-to-end native Notes checks on fake ~lux, using an unpaid local model.
// All writes are restricted to unique fixture notebooks/channels/groups.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

const ship = cookie.split('=')[0].slice('urbauth-'.length)
assert.equal(ship, '~lux')
const slug = `notes-${randomUUID().slice(0, 8)}`, group = `${ship}/${slug}`, channel = `diary/${group}`
const client = new Client(), errors = [], books = new Set()
let args, result, calls = 0, policy, session = false, createdGroup = false
const model = createServer(async (req, res) => {
  try {
    const raw = await readText(req)
    const body = JSON.parse(raw), last = body.messages.findLastIndex((m) => m.role === 'user')
    const reply = body.messages.slice(last + 1).find((m) => m.role === 'tool')
    if (reply) result = reply.content
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify({ choices: [{ finish_reason: reply ? 'stop' : 'tool_calls', message: reply
      ? { role: 'assistant', content: 'DONE' }
      : { role: 'assistant', content: '', tool_calls: [{ id: `${slug}-${calls}`, type: 'function', function: { name: 'tlon', arguments: JSON.stringify(args) } }] },
    }] }))
  } catch (error) { errors.push(error); res.end(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { role: 'assistant', content: 'FIXTURE_ERROR' } }] })) }
})
async function invoke(action, parameters = {}, expected = 'accepted') {
  calls++; args = { action, ...parameters }; result = undefined
  await client.call('session/prompt', { sessionId: slug, prompt: [{ type: 'text', text: `${calls}: ${action}` }] })
  assert.equal(errors.length, 0); assert.ok(result, `${action}: no result`)
  if (expected === 'read') { const value = JSON.parse(result); console.log(`PASS ${action}`); return value }
  assert.match(result, expected === 'error' ? /^(error:|failed:|rejected:)/ : expected === 'saved' ? /^(saved:|confirmed:)/ : /^accepted:/, `${action}: ${result}`)
  console.log(`PASS ${action}${expected === 'error' ? ' rejected safely' : ''}`)
  return result
}
async function scry(path) {
  const response = await fetch(`${base}/~/scry/${path}.json`, { headers: { cookie }, signal: AbortSignal.timeout(15000) })
  assert.ok(response.ok, `${path}: HTTP ${response.status}`); return response.json()
}
async function until(label, check) {
  for (let i = 0; i < 80; i++) { if (await check()) { console.log(`PASS ${label}`); return }; await sleep(250) }
  throw new Error(`Timed out: ${label}`)
}
async function createBook(parameters) {
  const value = await invoke('create_notebook', parameters, 'read')
  assert.ok(value.notebook); books.add(value.notebook)
  if (parameters.group) await until('group-linked notebook registered', async () => Boolean((await scry('groups/v2/groups'))[group].channels[`notes/${value.notebook}`]))
  return value
}
const nativePosts = () => scry(`channels/v5/${channel}/posts/newest/100/post`)
let stamp = Date.now()
async function seed(title, content) {
  await client.pokeAgent('channels', 'channel-action-2', { channel: { nest: channel, action: { post: { add: {
    content, author: ship, sent: ++stamp, blob: null, kind: '/diary', meta: { title, description: '', image: '', cover: '' },
  } } } } })
}
try {
  await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve))
  await client.start()
  policy = (await client.call('harness/tlon')).policy
  await client.call('harness/tlon/configure', { ...policy, enabled: false })
  await client.call('session/new', { name: slug }); session = true
  await client.call('harness/session/configure', { sessionId: slug, config: {
    url: `http://127.0.0.1:${model.address().port}`, model: 'notes-fixture', key: '', headers: [], system: 'Fixture', 'max-context': 500000, tools: ['tlon'],
  } })
  assert.ok(!(await scry('groups/v2/groups'))[group]); createdGroup = true
  await invoke('create_group', { name: slug, title: slug })
  await invoke('create_role', { group, role: 'editors', title: 'Editors' })
  await invoke('create_channel', { group, name: slug, title: 'Diary fixture', kind: 'diary' })
  await invoke('create_notebook', { title: slug, group: `${ship}/missing-group` }, 'error')
  await invoke('create_notebook', { title: slug, group, readers: '["missing"]' }, 'error')
  await invoke('create_notebook', { title: slug, group, readers: '["editors","editors"]' }, 'error')
  await invoke('create_channel', { title: slug, group, kind: 'notes', name: 'cannot-choose' }, 'error')

  const standalone = await createBook({ title: `${slug}-solo` })
  let target = { notebook: standalone.notebook, folder_id: standalone.root_folder_id }
  const members = await invoke('list_notebook_members', { notebook: target.notebook }, 'read')
  assert.ok(members.items.some((m) => m.ship === ship && m.role === 'owner'))
  assert.deepEqual((await invoke('list_notebook_members', { notebook: target.notebook, offset: '100' }, 'read')).items, [])
  await invoke('set_notebook_visibility', { notebook: target.notebook, visibility: 'public', confirm: 'wrong' }, 'error')
  await invoke('set_notebook_visibility', { notebook: target.notebook, visibility: 'public', confirm: target.notebook }, 'saved')
  assert.equal((await invoke('get_notebook', { notebook: target.notebook }, 'read')).visibility, 'public')
  await invoke('set_notebook_visibility', { notebook: target.notebook, visibility: 'private', confirm: target.notebook }, 'saved')

  const tree = JSON.stringify([{ type: 'note', title: 'Root note', text: 'α👍 **Markdown**' }, { type: 'folder', title: 'Nested', children: [{ type: 'note', title: 'Child note', text: 'nested\nbody' }] }])
  let plan = await invoke('plan_notes_import', { ...target, tree }, 'read')
  assert.equal(plan.notes, 2); assert.equal(plan.folders, 1)
  await invoke('import_notes', { ...target, tree, revision: plan.revision, confirm: 'wrong' }, 'error')
  await invoke('import_notes', { ...target, tree, revision: '0v0', confirm: plan.confirm }, 'error')
  await invoke('plan_notes_import', { ...target, folder_id: '999.999', tree }, 'error')
  await invoke('plan_notes_import', { ...target, tree: '[{"type":"note","title":"Missing body"}]' }, 'error')
  await invoke('import_notes', { ...target, tree, revision: plan.revision, confirm: plan.confirm }, 'saved')
  await invoke('import_notes', { ...target, tree, revision: plan.revision, confirm: plan.confirm }, 'error')
  let folders = (await invoke('list_folders', { notebook: target.notebook }, 'read')).items
  let notes = (await invoke('list_notes', { notebook: target.notebook }, 'read')).items
  const nested = folders.find((f) => f.name === 'Nested'), child = notes.find((n) => n.title === 'Child note')
  assert.equal(child.folder_id, nested.folder_id)
  assert.equal((await invoke('get_note', { notebook: target.notebook, note_id: child.note_id }, 'read')).body.text, 'nested\nbody')
  plan = await invoke('plan_notes_import', { ...target, tree }, 'read')
  await invoke('create_note', { ...target, title: 'Concurrent change', text: '' }, 'saved')
  await invoke('import_notes', { ...target, tree, revision: plan.revision, confirm: plan.confirm }, 'error')

  // Seed >64 roots to exercise resumable batching, independent of the 20-row history tool.
  for (let i = 0; i < 66; i++) await seed(`Entry ${i}`, [{ inline: [`Body ${i} `, { bold: ['rich'] }] }])
  await until('66 native diary roots', async () => Object.keys((await nativePosts()).posts).length === 66)
  plan = await invoke('plan_notes_migration', { channel }, 'read')
  assert.equal(plan.eligible, 66); assert.equal(plan.ready, false); assert.equal(plan.revision, null)
  assert.equal(plan.write_widening, false)
  await invoke('plan_notes_migration', { channel, notebook: target.notebook }, 'error')
  // A forged listing must not turn a standalone notebook into a migration target.
  const fakeNest = `notes/${standalone.notebook}`
  const listing = (await scry('groups/v2/groups'))[group].channels[channel]
  const listingAction = (action) => client.pokeAgent('groups', 'group-action-4', { group: { flag: group, 'a-group': { channel: { nest: fakeNest, 'a-channel': action } } } })
  await listingAction({ add: { ...listing, join: false } })
  await until('standalone notebook listed for negative test', async () => Boolean((await scry('groups/v2/groups'))[group].channels[fakeNest]))
  const falsePlan = await invoke('plan_notes_migration', { channel, notebook: standalone.notebook }, 'read')
  assert.equal(falsePlan.ready, true, 'preview can only inspect the listing; dispatch must verify affiliation')
  const beforeFalseMigration = (await invoke('list_notes', { notebook: standalone.notebook }, 'read')).items.length
  await invoke('migrate_notes', { channel, notebook: standalone.notebook, revision: falsePlan.revision, confirm: falsePlan.confirm }, 'error')
  assert.equal((await invoke('list_notes', { notebook: standalone.notebook }, 'read')).items.length, beforeFalseMigration)
  await listingAction({ del: null })
  await until('negative-test listing removed', async () => !(await scry('groups/v2/groups'))[group].channels[fakeNest])
  const book = await createBook({ title: `${slug}-migration`, group, readers: JSON.stringify(plan.readers) })
  target = { notebook: book.notebook }
  const notesChannel = `notes/${book.notebook}`
  let detail = await invoke('get_notebook', target, 'read')
  assert.ok(detail.group_channels.some((g) => g.group === group && g.readers.length === 0))
  await invoke('set_notebook_visibility', { ...target, visibility: 'public', confirm: target.notebook }, 'error')
  await invoke('update_channel', { group, channel: notesChannel, description: 'Native notes metadata' })
  await invoke('get_channel_permissions', { group, channel: notesChannel }, 'read')
  await invoke('add_channel_readers', { group, channel: notesChannel, role: 'editors' })
  await invoke('plan_notes_migration', { channel, ...target }, 'error')
  await invoke('remove_channel_readers', { group, channel: notesChannel, role: 'editors' })
  plan = await invoke('plan_notes_migration', { channel, ...target }, 'read')
  assert.equal(plan.ready, true); assert.equal(plan.batch_count, 64)
  await invoke('migrate_notes', { channel, ...target, revision: plan.revision, confirm: 'wrong' }, 'error')
  await invoke('add_channel_writers', { group, channel, role: 'editors' })
  await invoke('migrate_notes', { channel, ...target, revision: plan.revision, confirm: plan.confirm }, 'error')
  plan = await invoke('plan_notes_migration', { channel, ...target }, 'read')
  assert.equal(plan.write_widening, true)
  await invoke('migrate_notes', { channel, ...target, revision: plan.revision, confirm: plan.confirm }, 'error')
  await invoke('migrate_notes', { channel, ...target, revision: plan.revision, confirm: plan.confirm, allow_write_widening: 'true' }, 'saved')
  await invoke('migrate_notes', { channel, ...target, revision: plan.revision, confirm: plan.confirm, allow_write_widening: 'true' }, 'error')
  plan = await invoke('plan_notes_migration', { channel, ...target }, 'read')
  assert.equal(plan.already_imported, 64); assert.equal(plan.remaining, 2)
  await invoke('migrate_notes', { channel, ...target, revision: plan.revision, confirm: plan.confirm, allow_write_widening: 'true' }, 'saved')
  plan = await invoke('plan_notes_migration', { channel, ...target }, 'read')
  assert.equal(plan.complete, true); assert.equal(plan.already_imported, 66)
  assert.equal(Object.keys((await nativePosts()).posts).length, 66, 'source preserved')
  notes = (await invoke('list_notes', target, 'read')).items
  assert.equal(notes.length, 66)
  const first = notes.find((n) => n.title === 'Entry 0')
  const copied = await invoke('get_note', { ...target, note_id: first.note_id }, 'read')
  assert.ok(copied.body.text.includes('Body 0 **rich**'))
  assert.ok(copied.body.text.includes(`Originally posted by ${ship}`))
  assert.ok(copied.body.text.includes(`/1/chan/${channel}/note/`))
  await invoke('edit_note', { ...target, note_id: first.note_id, revision: first.revision, text: copied.body.text.replace('Body 0', 'Edited copy') }, 'saved')
  plan = await invoke('plan_notes_migration', { channel, ...target }, 'read')
  assert.equal(plan.conflicts, 1); assert.equal(plan.ready, false)
  await invoke('migrate_notes', { channel, ...target, revision: plan.revision, confirm: plan.confirm, allow_write_widening: 'true' }, 'error')

  await invoke('delete_channel', { group, channel: notesChannel, confirm: 'wrong' }, 'error')
  await invoke('delete_channel', { group, channel: notesChannel, confirm: notesChannel }, 'saved')
  books.delete(book.notebook)
  assert.ok(!(await invoke('list_notebooks', {}, 'read')).items.some((b) => b.notebook === book.notebook))
  await until('group listing removed with notebook', async () => !(await scry('groups/v2/groups'))[group].channels[notesChannel])
  const alias = await invoke('create_channel', { group, title: `${slug}-alias`, kind: 'notes', readers: '["editors"]' }, 'read')
  books.add(alias.notebook)
  await until('Notes channel alias registered', async () => Boolean((await scry('groups/v2/groups'))[group].channels[`notes/${alias.notebook}`]))
  detail = await invoke('get_notebook', { notebook: alias.notebook }, 'read')
  assert.deepEqual(detail.group_channels[0].readers, ['editors'])
  console.log(`PASS ${calls} native Notes cases`)
} catch (error) {
  console.error(`Fixture ${slug} failed before cleanup: ${error.stack || error.message}`)
  throw error
} finally {
  const cleanupErrors = []
  const cleanup = async (operation) => { try { await operation() } catch (error) { cleanupErrors.push(error) } }
  try {
    // Discover any successfully created fixture whose reply was lost.
    if (session) {
      await cleanup(async () => {
        let offset
        do {
          const all = await invoke('list_notebooks', offset ? { offset } : {}, 'read')
          for (const b of all.items) if (b.title.startsWith(slug)) books.add(b.notebook)
          offset = all.next_offset
        } while (offset)
      })
    }
    for (const notebook of books) await cleanup(() => invoke('delete_notebook', { notebook, confirm: notebook }, 'saved'))
    if (createdGroup) await cleanup(async () => {
      await client.pokeAgent('groups', 'group-action-4', { group: { flag: group, 'a-group': { delete: null } } })
      await until('fixture group removed', async () => !(await scry('groups/v2/groups'))[group])
    })
    if (session) await cleanup(async () => { await client.call('session/cancel', { sessionId: slug }); await client.call('session/delete', { sessionId: slug }) })
  } finally {
    try { if (policy) await client.call('harness/tlon/configure', policy) }
    finally {
      try { await client.close() }
      finally { model.closeAllConnections(); await new Promise((resolve) => model.close(resolve)) }
    }
  }
  if (cleanupErrors.length) throw new AggregateError(cleanupErrors, `Fixture ${slug} cleanup was incomplete`)
}
