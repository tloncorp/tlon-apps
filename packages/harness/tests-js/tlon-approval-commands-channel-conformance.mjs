// The owner answers channel approval requests, on three real ships: the bot and two
// others that take turns as its owner and as a ship on no list, in a channel on the
// peer that the bot and the guest have joined. With the peer as owner, the guest
// mentions the bot and the owner types /allow in its DM with the bot: the guest is then
// answered in that channel and still not in a DM. With the guest as owner, the peer
// mentions the bot and the owner types /reject in the channel: the reply comes there,
// and the peer stays unanswered, with no request open. No command text is in a model
// request in these turns. Runs apart from tlon-approval-commands-dm-conformance: the denial limit lets a
// ship open one request per five minutes. Restores policy and defaults. Leaves the
// fixture messages, the cards and the replies.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { approvalShips } from './lib/approval-ships.mjs'

const marker = `allow-channel-${randomUUID().slice(0, 8)}`
const t = await approvalShips(marker)
const { bot, peer, guest, nest, until, status } = t
const sentText = (label) => `${marker}-${label}`
const requests = (s, who) => s.requests.filter((request) => request.ship === who.ship)
const answered = (posts) => posts.some((post) => t.words(post).includes(`${marker}-answer`))
const grants = (s) => s.policy.channelGrants.find((grant) => grant.channel === nest)?.ships ?? []
async function asks(who) {
  await t.post(who, sentText(`${who.ship.slice(1)}-first`))
  const [request] = await until(`a mention from ${who.ship} without access opens a request`, async () => {
    const open = requests(await status(), who)
    return open.length && open
  })
  assert.equal(request.address, nest)
  return request
}
try {
  await t.start()
  await t.client.call('harness/tlon/configure', { ...(await status()).policy, enabled: false })
  await t.forget(guest)

  // The peer owns the bot; the guest asks, and the owner allows it from its DM.
  await t.configure(peer)
  const start = t.da(Date.now())
  const request = await asks(guest)
  await until('the owner is sent a card', async () => (await t.dmFromBot(peer, start))
    .some((post) => t.words(post).includes(`Channel mention request from ${guest.ship}`)))
  const typed = `/allow ${request.id}`
  await t.dm(peer, bot, typed)
  const reply = await until('the owner is told the guest may talk in the channel', async () => (await t.dmFromBot(peer, start))
    .find((post) => t.words(post).includes(`Approved ${guest.ship} for `)))
  assert.ok(t.words(reply).includes(nest) && t.words(reply).includes('. They will be able to interact in this channel.'), t.words(reply))
  const allowed = await status()
  assert.deepEqual(requests(allowed, guest), [], 'the allowed request is still open')
  assert.deepEqual(grants(allowed), [guest.ship], 'allow did not give the guest this channel')
  assert.equal(allowed.policy.channelGrants.length, 1, 'allow gave another channel')
  assert.deepEqual(allowed.policy.dmGrants, [], 'allow of a channel request gave DM access')
  console.log('PASS the owner\'s /allow gives the guest this channel only')

  await t.post(guest, sentText('after'))
  await until('the guest\'s next mention is answered in the channel', async () => answered(await t.channelFromBot(start)))
  assert.ok(!t.seen(sentText(`${guest.ship.slice(1)}-first`)), 'the mention the guest asked with reached the model')
  const direct = t.da(Date.now())
  await t.dm(guest, bot, sentText('direct'))
  await until('the guest sent its DM', async () => Object.values((await t.scry(guest, `chat/v4/dm/${bot.ship}/writs/newest/16/light`))?.writs || {})
    .some((post) => t.words(post).includes(sentText('direct'))))
  await sleep(3000)
  assert.deepEqual(await t.dmFromBot(guest, direct), [], 'the guest was answered in a DM')
  assert.ok(!(await t.scry(bot, 'chat/dm')).includes(guest.ship), 'the guest\'s DM invitation was accepted')
  // The guest asked in the channel minutes ago, so the denial limit drops its first DM
  // and declines the invitation rather than leave it pending.
  assert.ok(!(await t.scry(bot, 'chat/dm/invited')).includes(guest.ship), 'the guest\'s DM invitation was left pending')
  assert.ok(!t.seen(sentText('direct')), 'the guest\'s DM reached the model')
  assert.ok(!t.seen(typed), 'the owner\'s command reached the model')
  console.log('PASS the allowed guest is answered in the channel and not in a DM')

  // The guest owns the bot; the peer asks, and the owner rejects it in the channel. The
  // bot's DM with the guest starts over so that the card can reach it.
  await t.forget(guest)
  await t.configure(guest)
  const swapped = t.da(Date.now())
  const second = await asks(peer)
  const rejected = `/reject ${second.id}`
  await t.post(guest, rejected)
  const denied = await until('the owner\'s /reject in the channel is answered there', async () => (await t.channelFromBot(swapped))
    .find((post) => t.words(post).includes(`Denied ${peer.ship} for `)))
  assert.ok(t.words(denied).includes(nest), t.words(denied))
  const after = await status()
  assert.deepEqual(requests(after, peer), [], 'the rejected request is still open')
  assert.deepEqual(grants(after), [], 'reject gave access')
  assert.ok(after.events.some((notice) => notice.kind === 'approval-rejected' && notice.actor === peer.ship))
  const quiet = t.da(Date.now())
  await t.post(peer, sentText('again'))
  await sleep(4000)
  assert.ok(!answered(await t.channelFromBot(quiet)), 'the rejected peer was answered')
  assert.ok(!t.seen(sentText('again')), 'the rejected peer\'s mention reached the model')
  console.log('PASS the owner\'s /reject in the channel closes the request, gives nothing and is answered there')

  // The owner's next mention is answered, and its command is not in what the model sees.
  await t.post(guest, sentText('owner'))
  await until('the owner\'s next mention is answered', async () => answered(await t.channelFromBot(quiet)))
  assert.ok(!t.seen(rejected), 'the owner\'s command reached the model')
  console.log('PASS the owner\'s command in the channel starts no turn and is not in the owner\'s next turn')
} finally {
  await t.stop()
}
