// Owner skill editor contract over real ACP. Touches only a unique fixture skill.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { Client } from './lib/ship-client.mjs'

const client = new Client()
const name = `editor-${randomUUID()}`
let saved
try {
  await client.start()
  const baseline = await client.call('harness/skills')
  const defaults = await client.call('harness/defaults')
  const input = { name, desc: 'Use for editor conformance', body: '# Instructions\n\nKeep literal <tags>, quotes " and Unicode: 雪.\n', revision: '' }
  saved = await client.call('harness/skill/save', input)
  assert.deepEqual({ ...saved, revision: '' }, input)
  assert.ok(saved.revision)
  assert.deepEqual(await client.call('harness/skill', { name }), saved)
  const list = await client.call('harness/skills')
  assert.deepEqual(list.find((entry) => entry.name === name), { name, desc: input.desc })
  await assert.rejects(client.call('harness/skill/save', input), /changed/)
  const stale = saved
  saved = await client.call('harness/skill/save', { ...saved, body: 'Edited instructions\n' })
  assert.notEqual(saved.revision, stale.revision)
  await assert.rejects(client.call('harness/skill/delete', { name, revision: stale.revision }), /changed/)
  await assert.rejects(client.call('harness/skill/save', { ...saved, body: '' }), /instructions/)
  await assert.rejects(client.call('harness/skill/save', { ...saved, body: 'x'.repeat(65537) }), /instructions/)
  assert.deepEqual(await client.call('harness/skill', { name }), saved)
  assert.deepEqual(await client.call('harness/defaults'), defaults)
  assert.deepEqual(await client.call('harness/skill/delete', { name, revision: saved.revision }), baseline)
  saved = null
  await assert.rejects(client.call('harness/skill', { name }), /Unknown skill/)
  console.log('PASS skill catalog, literal text round-trip, update, stale-write/delete rejection, bounds, deletion and unchanged defaults')
} finally {
  if (saved) await client.call('harness/skill/delete', { name, revision: saved.revision })
  await client.close()
}
