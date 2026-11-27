// The owner answers a DM approval request, on three real ships: the bot, its owner
// (the peer) and a ship on no list (the guest). A guest's command in the DM it was
// given does nothing and gets no reply. The guest DMs the bot and the owner is sent a card. The owner's tap on the
// card's Allow button gives the guest DM access, accepts its pending invitation and
// answers it there; the guest's next message is answered, the one it asked with is not.
// No command text is in a model request. Runs apart from tlon-approval-commands-channel-conformance: the
// denial limit lets a ship open one request per five minutes. Restores policy and
// defaults. Leaves the fixture messages, the card and the replies.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { approvalShips } from './lib/approval-ships.mjs'

const marker = `allow-dm-${randomUUID().slice(0, 8)}`
const t = await approvalShips(marker)
const { bot, peer: owner, guest, until, status } = t
const sentText = (label) => `${marker}-${label}`
const requests = (s) => s.requests.filter((request) => request.ship === guest.ship)
const answered = (posts) => posts.some((post) => t.words(post).includes(`${marker}-answer`))
try {
  await t.start()
  await t.client.call('harness/tlon/configure', { ...(await status()).policy, enabled: false })
  await t.forget(guest)
  await t.configure(owner)
  const start = t.da(Date.now())

  await t.dm(guest, bot, sentText('first'))
  const [request] = await until('a DM from a ship without access opens a request', async () => {
    const open = requests(await status())
    return open.length && open
  })
  const [card] = await until('the owner is sent a card', async () => {
    const found = (await t.dmFromBot(owner, start)).filter((post) => t.words(post).includes(`DM request from ${guest.ship}`))
    return found.length && found
  })
  const entry = JSON.parse(card.essay.blob)[0]
  const parts = new Map(entry.messages.find((message) => message.updateComponents).updateComponents.components.map((c) => [c.id, c]))
  const allow = parts.get('allow').action.event.context.text
  assert.match(allow, new RegExp(`^/allow ${request.id} 0v[0-9a-v.]+$`))

  // The app sends a tapped button's text with a selection receipt in the blob.
  const tapped = t.da(Date.now())
  const receipt = [{ type: 'tlon-a2ui-selection', version: 1, sourcePostId: card.seal.id, surfaceId: `approval-${request.id}`, componentId: 'allow', values: [allow] }]
  await t.dm(owner, bot, allow, JSON.stringify(receipt))
  await until('the owner is told the guest may DM the bot', async () => (await t.dmFromBot(owner, tapped))
    .some((post) => t.words(post).includes(`Approved DM access for ${guest.ship}. They will be able to message the bot.`)))
  const allowed = await status()
  assert.deepEqual(requests(allowed), [], 'the allowed request is still open')
  assert.deepEqual(allowed.policy.dmGrants, [guest.ship], 'allow gave something other than the guest\'s DM access')
  assert.deepEqual(allowed.policy.channelGrants, [], 'allow of a DM request gave channel access')
  assert.ok(allowed.events.some((notice) => notice.kind === 'approval-allowed' && notice.actor === guest.ship))
  await until('the guest\'s pending invitation is accepted', async () => {
    const [invited, accepted] = await Promise.all([t.scry(bot, 'chat/dm/invited'), t.scry(bot, 'chat/dm')])
    return !invited.includes(guest.ship) && accepted.includes(guest.ship)
  })
  console.log('PASS the owner\'s tap on Allow gives the guest DM access and accepts its invitation')

  await t.dm(guest, bot, sentText('after'))
  await until('the guest\'s next message is answered', async () => answered(await t.dmFromBot(guest, start)))
  assert.ok(t.seen(sentText('after')))
  assert.ok(!t.seen(sentText('first')), 'the message the guest asked with reached the model')
  console.log('PASS the guest\'s next message is answered, the one it asked with is not')

  // A ship that is not the owner, with access: the guest in the DM it was given.
  const banned = `/ban ${request.id}`
  const before = (await t.dmFromBot(guest, start)).length
  await t.dm(guest, bot, banned)
  await sleep(3000)
  assert.equal((await t.dmFromBot(guest, start)).length, before, 'the bot answered a command from a ship that is not the owner')
  await t.dm(guest, bot, sentText('later'))
  await until('the guest\'s message after its command is answered', async () => (await t.dmFromBot(guest, start)).length === before + 1)
  const later = await status()
  assert.deepEqual(later.policy.dmGrants, [guest.ship], 'a command from a ship that is not the owner changed access')
  assert.ok(!(await t.scry(bot, 'chat/blocked')).includes(guest.ship), 'a command from a ship that is not the owner blocked a ship')
  assert.ok(!t.seen(banned), 'a command from a ship with access reached the model')
  console.log('PASS a command from a ship with access changes nothing and gets no reply')

  // The owner's command starts no turn and is not in the owner's next one.
  const asked = t.da(Date.now())
  await t.dm(owner, bot, sentText('owner'))
  await until('the owner\'s next message is answered', async () => answered(await t.dmFromBot(owner, asked)))
  assert.ok(!t.seen(allow), 'the owner\'s command reached the model')
  console.log('PASS the owner\'s command starts no turn and is not in the owner\'s next turn')
} finally {
  await t.stop()
}
