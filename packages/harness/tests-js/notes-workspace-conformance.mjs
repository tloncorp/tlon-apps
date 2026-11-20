// Local-only Native Notes backend conformance. Creates one private test note;
// its harmless public snapshot is withdrawn in finally. Never deletes Notes.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client, base, cookie } from './lib/ship-client.mjs'

assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname), 'Use a local test ship')
const id = `notes-check-${randomUUID().slice(0, 8)}`
const project = `${id}-project`
const client = new Client()
const work = (action, args = {}) => client.call('harness/workspace', { action, args })
const read = () => work('artifact', { id })
const scry = async (path) => {
  const response = await fetch(`${base}/~/scry/notes/${path}.json`, { headers: { cookie }, signal: AbortSignal.timeout(10_000) })
  assert.equal(response.status, 200)
  return response.json()
}
let confirmed = false, native
const editInNotes = async (action) => {
  const response = await fetch(`${base}/notes/~/v1`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ action: { type: 'notebook', flag: native.notebook, action: { type: 'note', id: Number(native.noteId), action } } }),
    signal: AbortSignal.timeout(30_000),
  })
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.body.type, 'ok', JSON.stringify(result))
}
console.log(`Fixture ${id}; if interrupted, inspect this identity before rerunning.`)
try {
  await client.start()
  await work('project-create', { id: project, title: 'Notes backend fixture', description: 'Must survive every Notes refresh.' })
  const first = { title: 'Native backend fixture', body: 'First accepted native body.', sources: [{ label: 'PRIVATE_SOURCE', url: 'https://example.com/private-reference' }] }
  const created = await work('artifact-create', { id, project, ...first })
  confirmed = true
  native = created.artifact.notes
  assert.ok(native?.noteId)
  assert.equal(created.artifact.head, 1)
  const notePath = `v0/note/${native.notebook}/${native.noteId}`
  assert.equal((await scry(notePath)).bodyMd, first.body)
  assert.equal((await read()).content.body, first.body)
  assert.equal((await work('project', { id: project })).description, 'Must survive every Notes refresh.')
  assert.ok((await work('artifacts', { offset: 0, limit: 64 })).items.some((item) => item.id === id))
  console.log('PASS native creation, nullable list metadata, read-after-write and project preservation')

  await work('artifact-save', { id, project, base: 1, ...first, body: 'Second accepted native body.' })
  assert.equal((await scry(notePath)).revision, 1)
  assert.equal((await work('revision', { id, revision: 1 })).content.body, first.body)
  await assert.rejects(work('artifact-save', { id, project, base: 1, ...first }), /stale|changed|conflict/i)
  await assert.rejects(work('artifact-save', { id, project, base: 2, ...first, title: 'Implicit rename' }), /rename|title/i)
  await work('artifact-rename', { id, title: 'Explicit native rename' })
  let current = await read()
  assert.equal(current.artifact.head, 2)
  assert.equal(current.content.title, 'Explicit native rename')
  assert.equal((await scry(notePath)).title, current.content.title)
  console.log('PASS Notes history, stale-body rejection and separate unversioned rename')

  const beforeExternalRename = await work('preview', { id, revision: 2 })
  await editInNotes({ type: 'rename', title: 'Renamed directly in Notes' })
  current = await read()
  assert.equal(current.content.title, 'Renamed directly in Notes')
  assert.equal(current.artifact.head, 2)
  await assert.rejects(work('publish', { id, revision: 2, head: 2, exposure: current.artifact.exposure, confirm: `${id}@2`, previewToken: beforeExternalRename.previewToken }), /changed|preview|invalid/i)
  await editInNotes({ type: 'update', body: 'Third body, edited directly in Notes.', expectedRevision: 1 })
  current = await read()
  assert.equal(current.artifact.head, 3)
  assert.equal(current.content.body, 'Third body, edited directly in Notes.')
  assert.equal((await work('project', { id: project })).id, project)
  console.log('PASS external Notes edits and stale-title publication fence')

  const preview = await work('preview', { id, revision: 3 })
  const published = await work('publish', { id, revision: 3, head: 3, exposure: current.artifact.exposure, confirm: `${id}@3`, previewToken: preview.previewToken })
  assert.equal(published.artifact.publication.path, native.path)
  const response = await fetch(`${base}${native.path}`)
  const html = await response.text()
  assert.equal(response.status, 200)
  assert.equal(html, preview.html)
  assert.ok(!html.includes('PRIVATE_SOURCE'))
  assert.match(html, /Content-Security-Policy/)
  assert.ok((await scry('v0/published')).some((item) => String(item.noteId) === native.noteId))
  await work('artifact-save', { id, project, base: 3, title: current.content.title, body: 'PRIVATE_UNPUBLISHED_BODY', sources: [] })
  assert.equal(await (await fetch(`${base}${native.path}`)).text(), html)
  current = await read()
  await work('unpublish', { id, exposure: current.artifact.exposure })
  assert.ok(!(await scry('v0/published')).some((item) => String(item.noteId) === native.noteId))
  assert.ok(!(await (await fetch(`${base}${native.path}`)).text()).includes('Third body, edited directly in Notes.'))
  console.log('PASS native publishing, frozen public snapshot, private source omission and native unpublish')

  await assert.rejects(work('artifacts', { offset: null, limit: 24 }), /invalid/i)
  assert.ok((await client.call('harness/defaults')).model)
  assert.ok((await work('artifacts', { offset: 0, limit: 64 })).items.some((item) => item.id === id))
  console.log('PASS invalid request isolation; Settings and Artifacts remain connected')
} finally {
  if (confirmed) {
    try {
      const { artifact } = await read()
      if (artifact.publication) await work('unpublish', { id, exposure: artifact.exposure })
      if (!artifact.archived) await work('artifact-archive', { id, base: artifact.head, archived: true })
    } catch (error) { console.error(`Inspect retained fixture ${id}: ${error.message}`) }
  }
  await client.close()
}
