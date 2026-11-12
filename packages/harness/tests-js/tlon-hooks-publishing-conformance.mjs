// Deterministic, native hook and public-page tests on fake ~lux only.
// Publishes only unique fixtures; removes hooks, schedules, pages and fixtures.
import assert from 'node:assert/strict'
import { text as readText } from 'node:stream/consumers'
import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, cookie, base } from './lib/ship-client.mjs'

const ship = cookie.split('=')[0].slice('urbauth-'.length)
assert.equal(ship, '~lux')
const slug = `publish-${randomUUID().slice(0, 8)}`, group = `${ship}/${slug}`, channel = `chat/${group}`
const client = new Client(), errors = [], hooks = new Set(), publications = new Set()
let args, result, calls = 0, policy, session = false, createdGroup = false, notebook
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
async function publicPage(path) {
  const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(15000) })
  return { status: response.status, text: await response.text() }
}
async function until(label, check) {
  for (let i = 0; i < 60; i++) { if (await check()) { console.log(`PASS ${label}`); return }; await sleep(250) }
  throw new Error(`Timed out: ${label}`)
}
const groupAction = (action) => client.pokeAgent('groups', 'group-action-4', { group: { flag: group, 'a-group': action } })
try {
  await new Promise((resolve) => model.listen(0, '127.0.0.1', resolve))
  await client.start()
  policy = (await client.call('harness/tlon')).policy
  await client.call('harness/tlon/configure', { ...policy, enabled: false })
  await client.call('session/new', { name: slug }); session = true
  await client.call('harness/session/configure', { sessionId: slug, config: {
    url: `http://127.0.0.1:${model.address().port}`, model: 'publishing-fixture', key: '', headers: [], system: 'Fixture', 'max-context': 200000, tools: ['tlon'],
  } })
  assert.ok(!(await scry('groups/v2/groups'))[group]); createdGroup = true
  await invoke('create_group', { name: slug, title: slug })
  await invoke('create_channel', { group, name: slug, title: slug })
  const template = await invoke('hook_template', {}, 'read')
  await invoke('add_hook', { title: slug, source: template.source, confirm: 'wrong' }, 'error')
  const added = await invoke('add_hook', { title: slug, source: template.source, confirm: slug }, 'read')
  const hook_id = added.hook_id; hooks.add(hook_id); assert.equal(added.compiled, true)
  let detail = await invoke('get_hook', { hook_id }, 'read')
  assert.equal(detail.source, template.source); assert.equal(detail.hook.compiled, true)
  await invoke('configure_hook', { hook_id, channel, config: '{"marker":"fixture"}', confirm: hook_id }, 'saved')
  await invoke('configure_hook', { hook_id, channel, config: '{"number":1}', confirm: hook_id }, 'error')
  await invoke('set_hook_order', { channel, hook_ids: JSON.stringify([hook_id]), confirm: channel }, 'saved')
  assert.deepEqual((await invoke('get_hook_order', { channel }, 'read')).hook_ids, [hook_id])
  await invoke('schedule_hook', { hook_id, schedule: '~s1', confirm: hook_id }, 'error')
  await invoke('schedule_hook', { hook_id, channel, schedule: '~h1', confirm: hook_id }, 'saved')
  assert.equal((await invoke('get_hook', { hook_id }, 'read')).schedules.length, 1)
  await invoke('stop_hook', { hook_id, channel, confirm: hook_id }, 'saved')
  assert.equal((await invoke('get_hook', { hook_id }, 'read')).schedules.length, 0)
  detail = await invoke('get_hook', { hook_id }, 'read')
  await invoke('edit_hook', { hook_id, revision: '0v0', title: slug, confirm: hook_id }, 'error')
  const source = template.on_post_add_example
  await invoke('edit_hook', { hook_id, revision: detail.hook.revision, source, confirm: hook_id }, 'read')
  await invoke('send_channel', { channel, text: `${slug} public-post` })
  await until('hook produces a real native reaction', async () => JSON.stringify(await scry(`channels/v5/${channel}/posts/newest/20/post`)).includes('ok'))
  detail = await invoke('get_hook', { hook_id }, 'read')
  await invoke('edit_hook', { hook_id, revision: detail.hook.revision, source: 'this is not hoon', confirm: hook_id }, 'error')
  detail = await invoke('get_hook', { hook_id }, 'read')
  assert.equal(detail.hook.compiled, true, 'native failed edits preserve previous compiled code')
  assert.equal(detail.source, 'this is not hoon')
  await invoke('delete_hook', { hook_id, confirm: 'wrong' }, 'error')
  await invoke('delete_hook', { hook_id, confirm: hook_id }, 'saved'); hooks.delete(hook_id)
  assert.deepEqual((await invoke('get_hook_order', { channel }, 'read')).hook_ids, [])
  assert.ok(!(await invoke('list_hooks', {}, 'read')).items.some((h) => h.hook_id === hook_id))

  const posts = await scry(`channels/v5/${channel}/posts/newest/20/post`)
  const [postId] = Object.entries(posts.posts).find(([, p]) => JSON.stringify(p).includes(`${slug} public-post`))
  const citation = `/1/chan/${channel}/msg/${postId.replaceAll('.', '')}`
  const history = await invoke('history', { channel }, 'read')
  const message = history.messages.find((p) => p.text === `${slug} public-post`)
  assert.equal((await invoke('get_publication', { channel, message_id: message.message_id }, 'read')).citation, citation)
  await invoke('publish_post', { citation, confirm: 'wrong' }, 'error')
  await invoke('publish_post', { citation: `${citation}/1`, confirm: `${citation}/1` }, 'error')
  publications.add(citation)
  await invoke('publish_post', { citation, confirm: citation })
  const publication = await invoke('get_publication', { citation }, 'read')
  assert.equal(publication.published, true)
  await until('post is readable without authentication', async () => (await publicPage(publication.public_path)).text.includes(`${slug} public-post`))
  assert.ok((await invoke('list_publications', {}, 'read')).items.some((p) => p.citation === citation))
  await invoke('unpublish_post', { citation, confirm: 'wrong' }, 'error')
  await invoke('unpublish_post', { citation, confirm: citation }); publications.delete(citation)
  assert.equal((await invoke('get_publication', { citation }, 'read')).published, false)
  await until('unpublished post is no longer served', async () => !(await publicPage(publication.public_path)).text.includes(`${slug} public-post`))

  const book = await invoke('create_notebook', { title: slug }, 'read'); notebook = book.notebook
  await invoke('create_note', { notebook, folder_id: book.root_folder_id, title: slug, text: `${slug} note-body <script>alert(1)</script>` }, 'saved')
  const note = (await invoke('list_notes', { notebook }, 'read')).items.find((n) => n.title === slug)
  const target = { notebook, note_id: note.note_id }, confirm = `${notebook}/note/${note.note_id}`
  await invoke('publish_note', { ...target, revision: note.revision, confirm: 'wrong' }, 'error')
  await invoke('publish_note', { ...target, revision: '999.999', confirm }, 'error')
  await invoke('publish_note', { ...target, revision: note.revision, confirm, html: '<script>alert(1)</script>' }, 'error')
  await invoke('publish_note', { ...target, revision: note.revision, confirm }, 'saved')
  const published = await invoke('get_note_publication', target, 'read')
  assert.equal(published.published, true)
  let page = await publicPage(published.public_path)
  assert.equal(page.status, 200); assert.ok(page.text.includes(`${slug} note-body`))
  assert.ok(page.text.includes('&lt;script&gt;')); assert.ok(!page.text.includes('<script>'))
  assert.ok(page.text.includes('Content-Security-Policy'))
  await invoke('publish_note', { ...target, revision: note.revision, confirm, html: `<h2>${slug} formatted</h2><p><strong>Safe HTML</strong></p>` }, 'saved')
  page = await publicPage(published.public_path); assert.ok(page.text.includes(`<h2>${slug} formatted</h2>`))
  assert.ok((await invoke('list_published_notes', {}, 'read')).items.some((p) => p.notebook === notebook && p.note_id === note.note_id))
  await invoke('unpublish_note', { ...target, confirm: 'wrong' }, 'error')
  await invoke('unpublish_note', { ...target, confirm }, 'saved')
  assert.equal((await invoke('get_note_publication', target, 'read')).published, false)
  await until('unpublished Notes snapshot is no longer served', async () => !(await publicPage(published.public_path)).text.includes(`${slug} formatted`))
  await invoke('delete_notebook', { notebook, confirm: notebook }, 'saved'); notebook = undefined
  console.log(`PASS ${calls} native hooks and publishing cases`)
} catch (error) {
  console.error(`Fixture failed before cleanup: ${error.message}`)
  throw error
} finally {
  try {
    try {
      // A compiler failure can create a native hook before returning an error.
      if (session) {
        let offset
        do {
          const page = await invoke('list_hooks', offset ? { offset } : {}, 'read')
          for (const hook of page.items) if (hook.title === slug) hooks.add(hook.hook_id)
          offset = page.next_offset
        } while (offset)
      }
      for (const hook_id of hooks) await invoke('delete_hook', { hook_id, confirm: hook_id }, 'saved')
      for (const citation of publications) await invoke('unpublish_post', { citation, confirm: citation })
    } finally {
      try {
        if (notebook) await client.pokeAgent('notes', 'notes-action', { type: 'notebook', flag: notebook, action: { type: 'delete' } })
        if (createdGroup) await groupAction({ delete: null })
        if (session) { await client.call('session/cancel', { sessionId: slug }); await client.call('session/delete', { sessionId: slug }) }
      } finally {
        if (policy) await client.call('harness/tlon/configure', policy)
      }
    }
  } finally {
    await client.close(); model.closeAllConnections(); await new Promise((resolve) => model.close(resolve))
  }
}
