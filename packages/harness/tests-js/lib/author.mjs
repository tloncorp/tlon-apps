// A Tlon message's author is a ship or a bot profile, {ship, nickname, avatar}.
// Other ships' bots write the profile form too, so whose message it is comes
// from the ship alone, never from the form.
import assert from 'node:assert/strict'

export const authorShip = (author) => (typeof author === 'string' ? author : author?.ship)

// The Tlon hand writes every message as a bot, with an empty profile.
export function assertBotAuthor(author, ship) {
  assert.deepEqual(author, { ship, nickname: null, avatar: null })
}
