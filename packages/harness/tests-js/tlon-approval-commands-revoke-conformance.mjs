// The owner revokes a guest's channel access from that channel, on three real ships:
// the bot, the peer as its owner and the guest, which holds a settings grant for the
// channel on the peer that the bot and the guest have joined. The guest's mention is
// answered; the owner then mentions the bot with /revoke and the guest's ship in the
// channel, and is told there that the guest's access is revoked, while the command
// reaches no model. The guest's next mention is not answered and opens a request, with
// a card for the owner. Runs apart from the other approval command scripts: the denial
// limit lets a ship open one request per five minutes. Restores policy and defaults.
// Leaves the fixture messages, the card and the replies.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { approvalShips } from './lib/approval-ships.mjs'

const marker = `revoke-channel-${randomUUID().slice(0, 8)}`
const t = await approvalShips(marker)
const { peer, guest, nest, until, status } = t
const sentText = (label) => `${marker}-${label}`
const answered = (posts) => posts.some((post) => t.words(post).includes(`${marker}-answer`))
const grants = (s) => s.policy.channelGrants.find((grant) => grant.channel === nest)?.ships ?? []
try {
  await t.start()
  await t.client.call('harness/tlon/configure', {
    enabled: true, owner: peer.ship, response: 'mentions', allowed: [], channels: [], trusted: [],
    dmGrants: [], channelGrants: [{ channel: nest, ships: [guest.ship] }],
  })
  const start = t.da(Date.now())
  await t.post(guest, sentText('before'))
  await until('the guest holding the channel is answered there', async () => answered(await t.channelFromBot(start)))

  const typed = `/revoke ${guest.ship}`
  await t.post(peer, typed)
  const reply = await until('the owner is told in the channel that the guest\'s access is revoked', async () => (await t.channelFromBot(start))
    .find((post) => t.words(post).startsWith(`Revoked ${guest.ship} for `)))
  assert.ok(t.words(reply).includes(nest) && t.words(reply).endsWith('. They will no longer be able to interact in this channel.'), t.words(reply))
  const revoked = await status()
  assert.deepEqual(grants(revoked), [], 'the guest still holds the channel')
  assert.ok(revoked.events.some((notice) => notice.kind === 'approval-revoked' && notice.actor === guest.ship), 'the revoke was not recorded')
  assert.deepEqual(revoked.requests, [], 'the revoke opened a request')
  assert.ok(!(await t.dmFromBot(peer, start)).some((post) => t.words(post).startsWith('Revoked ')), 'the revoke was answered in the owner\'s DM')
  assert.ok(!t.seen(typed), 'the owner\'s command reached the model')
  console.log('PASS the owner\'s /revoke in the channel takes the guest\'s grant there and is answered there')

  const after = t.da(Date.now())
  await t.post(guest, sentText('after'))
  const [request] = await until('the revoked guest\'s next mention opens a request', async () => {
    const open = (await status()).requests.filter((found) => found.ship === guest.ship)
    return open.length && open
  })
  assert.equal(request.address, nest)
  await until('the owner is sent a card', async () => (await t.dmFromBot(peer, after))
    .some((post) => t.words(post).includes(`Channel mention request from ${guest.ship}`)))
  await sleep(3000)
  assert.ok(!answered(await t.channelFromBot(after)), 'the revoked guest was answered')
  assert.ok(!t.seen(sentText('after')), 'the revoked guest\'s mention reached the model')
  console.log('PASS the revoked guest is not answered in the channel, and its mention opens a request')
} finally {
  await t.stop()
}
