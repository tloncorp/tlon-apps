// Run on a disposable ship: temporarily publishes a profile to its Contacts
// peers, then restores only the fields touched. No Groups source changes.
import assert from 'node:assert/strict'
import { setTimeout as sleep } from 'node:timers/promises'
import { Client, base, cookie } from './lib/ship-client.mjs'

const client = new Client()
const raw = async () => {
  const response = await fetch(`${base}/~/scry/contacts/v1/self.json`, { headers: { cookie } })
  assert.ok(response.ok)
  return response.json()
}
async function until(fn) {
  for (let i = 0; i < 50; i++) {
    if (await fn()) return
    await sleep(100)
  }
  throw new Error('Contacts did not apply the profile edit')
}
let before
try {
  await client.start()
  before = await raw()
  const policy = (await client.call('harness/tlon')).policy
  const read = () => client.call('harness/tlon/profile')
  const set = (params) => client.call('harness/tlon/profile/set', params)
  // Simulate editing in Tlon: directly invoke the public Contacts API.
  await client.pokeAgent('contacts', 'contact-action-1', { self: {
    nickname: { type: 'text', value: 'External edit' },
    bio: { type: 'text', value: 'Unrelated profile field' },
  } })
  await until(async () => (await read()).nickname === 'External edit')
  const expected = { nickname: 'Harness test', avatar: 'https://example.com/bot.png' }
  assert.deepEqual(await set(expected), expected, 'reply follows Contacts acknowledgement')
  assert.deepEqual(await read(), expected)
  const updated = await raw()
  assert.deepEqual(updated.nickname, { type: 'text', value: expected.nickname })
  assert.deepEqual(updated.avatar, { type: 'look', value: expected.avatar })
  assert.equal(updated.bio.value, 'Unrelated profile field')
  await assert.rejects(set({ nickname: 'Bad URL', avatar: 'javascript:alert(1)' }), /HTTP/)
  assert.deepEqual(await read(), expected, 'invalid input cannot change Contacts')
  await assert.rejects(set({ nickname: 'x'.repeat(65), avatar: '' }), /64 bytes/)
  assert.deepEqual(await set({ nickname: '', avatar: '' }), { nickname: '', avatar: '' })
  const cleared = await raw()
  assert.ok(!cleared.nickname && !cleared.avatar)
  assert.equal(cleared.bio.value, 'Unrelated profile field')
  assert.deepEqual((await client.call('harness/tlon')).policy, policy, 'profile does not change authority')
  console.log('PASS: external edits, acknowledged profile writes, validation, clearing, unrelated-field and policy preservation')
} finally {
  if (before) {
    await client.pokeAgent('contacts', 'contact-action-1', { self: Object.fromEntries(
      ['nickname', 'avatar', 'bio'].map((field) => [field, before[field] || null]),
    ) })
    // Only these fields are restored: bot-liveness follows whether the hand is on.
    const restored = (profile) => JSON.stringify(['nickname', 'avatar', 'bio'].map((field) => profile[field] ?? null))
    await until(async () => restored(await raw()) === restored(before))
    console.log('Restored test ship profile.')
  }
  await client.close()
}
