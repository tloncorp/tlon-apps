// The owner answers a DM approval request, on three real ships: the bot, its owner
// (the peer) and a ship on no list (the guest). A guest's command in the DM it was
// given does nothing and gets no reply. The guest DMs the bot and the owner is sent a card,
// whose Allow button the owner's /pending card repeats beside the request's id. The owner's
// tap on that Allow gives the guest DM access, accepts its pending invitation and
// answers the message it asked with, once, without its writing again; its next message
// is answered too. With the guest blocked, /banned lists it, /unban unblocks it and
// /banned then does not.
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
// A post's text by line: its paragraphs and line breaks, a ship as its name.
const lines = (post) => (post?.essay?.content ?? []).map((verse) => (verse.inline || [])
  .map((item) => typeof item === 'string' ? item : item.ship ?? ('break' in item ? '\n' : item['inline-code'] ?? '')).join('')).join('\n').split('\n')
// The bot's join notice in the DM it accepts is its post too; only answers count.
const answers = async (start) => (await t.dmFromBot(guest, start)).filter((post) => t.words(post).includes(`${marker}-answer`)).length
let blocked = false
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

  const listing = t.da(Date.now())
  await t.dm(owner, bot, '/pending')
  const [pending] = await until('the owner\'s /pending lists the open request with its id', async () => {
    const found = (await t.dmFromBot(owner, listing)).filter((post) => t.words(post).includes(`#${request.id} - DM from ${guest.ship}`))
    return found.length && found
  })
  assert.match(t.words(pending), /^Pending requests \(\d+\):/)
  const pendingEntry = JSON.parse(pending.essay.blob)[0]
  console.log(`CARD ${JSON.stringify(pendingEntry)}`)
  const pendingParts = pendingEntry.messages.find((message) => message.updateComponents).updateComponents.components
  const pendingAllow = pendingParts.find((c) => c.component === 'Button' && c.action.event.context.text === allow)
  assert.ok(pendingAllow, 'the /pending card has no Allow button for the request')
  assert.ok(pendingParts.some((c) => c.component === 'Row' && c.children.includes(pendingAllow.id)), 'the /pending card\'s Allow button is in no row')
  console.log('PASS /pending lists the open request\'s id, with a card whose Allow button is the request\'s own')

  // The owner taps Allow on the /pending card; the app sends the button's
  // text with a selection receipt in the blob.
  const tapped = t.da(Date.now())
  const receipt = [{ type: 'tlon-a2ui-selection', version: 1, sourcePostId: pending.seal.id, surfaceId: 'pending-approvals', componentId: pendingAllow.id, values: [allow] }]
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

  await until('the guest\'s waiting message is answered without its writing again', async () => answered(await t.dmFromBot(guest, start)))
  assert.ok(t.seen(sentText('first')), 'the message the guest asked with did not reach the model')
  await sleep(3000)
  assert.equal(await answers(start), 1, 'the guest\'s waiting message was answered more than once')
  console.log('PASS the message the guest asked with is answered once, without its writing again')

  await t.dm(guest, bot, sentText('after'))
  await until('the guest\'s next message is answered', async () => (await answers(start)) === 2)
  assert.ok(t.seen(sentText('after')))
  console.log('PASS the guest\'s next message is answered')

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
  assert.ok(!t.seen('/pending'), 'the owner\'s /pending reached the model')
  console.log('PASS the owner\'s command starts no turn and is not in the owner\'s next turn')

  // The guest has no request open, and the denial limit keeps it from opening
  // another, so it is blocked natively, as /ban and the app's Block do.
  await t.client.pokeAgent('chat', 'chat-block-ship', { ship: guest.ship })
  blocked = true
  await until('the bot blocks the guest', async () => (await t.scry(bot, 'chat/blocked')).includes(guest.ship))
  const reply = async (text, expected) => {
    const sent = t.da(Date.now())
    await t.dm(owner, bot, text)
    const [found] = await until(`the owner's ${text} is answered`, async () => {
      const posts = (await t.dmFromBot(owner, sent)).filter((post) => expected(t.words(post)))
      return posts.length && posts
    })
    return lines(found)
  }
  const blockedList = await reply('/banned', (words) => words.startsWith('Blocked users ('))
  assert.ok(blockedList.some((line) => line.trim() === guest.ship), '/banned does not list the blocked guest')
  console.log('PASS /banned lists the blocked guest')
  await reply(`/unban ${guest.ship}`, (words) => words === `Unblocked ${guest.ship}.`)
  assert.ok(!(await t.scry(bot, 'chat/blocked')).includes(guest.ship), '/unban left the guest blocked')
  blocked = false
  const after = await reply('/banned', (words) => words.startsWith('Blocked users (') || words === 'No users are currently blocked.')
  assert.ok(!after.some((line) => line.trim() === guest.ship), '/banned still lists the unbanned guest')
  console.log('PASS /unban unblocks the guest and /banned no longer lists it')
} finally {
  try {
    if (blocked) await t.client.pokeAgent('chat', 'chat-unblock-ship', { ship: guest.ship })
  } finally {
    await t.stop()
  }
}
