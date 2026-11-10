import test from 'node:test'
import assert from 'node:assert/strict'
import { canonicalShip, suggestPeople } from './people.mjs'

test('canonical identities use urbit-ob, not nickname or loose syllables', () => {
  assert.equal(canonicalShip(' ZOD '), '~zod')
  assert.equal(canonicalShip('Alice'), null)
  assert.equal(canonicalShip('~not-a-ship'), null)
})
test('nickname lookup prioritizes contacts and retains exact ships', () => {
  const contacts = [{ ship: '~nec', nickname: 'Alice', contact: false }, { ship: '~zod', nickname: 'Alice Home', contact: true }]
  assert.deepEqual(suggestPeople('alice', contacts).map((p) => p.ship), ['~zod', '~nec'])
  assert.deepEqual(suggestPeople('alice', contacts, ['~zod']).map((p) => p.ship), ['~nec'])
})
test('partial names only suggest known people; exact names need no contact', () => {
  assert.deepEqual(suggestPeople('~zo'), [])
  assert.deepEqual(suggestPeople('~zo', [{ ship: '~zod', contact: true }]).map((p) => p.ship), ['~zod'])
  assert.deepEqual(suggestPeople('~lux').map((p) => p.ship), ['~lux'])
  assert.deepEqual(suggestPeople('~lux', [], ['~lux']), [])
})
test('an exact ship outranks nickname matches, even beyond the result limit', () => {
  const contacts = Array.from({ length: 12 }, () => ({ ship: '~nec', nickname: 'lux', contact: true }))
  assert.equal(suggestPeople('~lux', contacts)[0].ship, '~lux')
  assert.equal(suggestPeople('~lux', [...contacts, { ship: '~lux', contact: false }])[0].ship, '~lux')
  assert.equal(suggestPeople('', contacts).length, 8)
})
