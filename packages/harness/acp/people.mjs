import ob from './vendor/urbit-ob.mjs'

export function canonicalShip(value) {
  const ship = `~${String(value).trim().toLowerCase().replace(/^~/, '')}`
  return ob.isValidPatp(ship) ? ob.patp(ob.patp2dec(ship)) : null
}

// Suggest known people, not invented completions of a phonetic alphabet.
// An exact valid ship is selectable even when Contacts has never seen it.
// Nicknames are labels, never authority-bearing identifiers.
export function suggestPeople(query, contacts = [], exclude = []) {
  const needle = query.trim().toLowerCase().replace(/^~/, '')
  const omitted = new Set(exclude)
  const exact = canonicalShip(query)
  const candidates = contacts.filter(({ ship, nickname }) => !omitted.has(ship) &&
    (!needle || ship.includes(needle) || nickname?.toLowerCase().includes(needle)))
    .sort((a, b) => Number(b.ship === exact) - Number(a.ship === exact) ||
      Number(b.contact) - Number(a.contact) || a.ship.localeCompare(b.ship))
  if (exact && !omitted.has(exact) && !candidates.some(({ ship }) => ship === exact)) {
    candidates.unshift({ ship: exact, nickname: '', contact: false })
  }
  return candidates.slice(0, 8)
}
