// The owner answers channel approval requests, on three real ships: the bot and two
// others that take turns as its owner and as a ship on no list, in a channel on the
// peer that the bot and the guest have joined. With the peer as owner, the guest
// mentions the bot and the owner types /allow in its DM with the bot: the guest is then
// answered in that channel and still not in a DM. With the guest as owner, the peer
// mentions the bot and the owner posts /allow in the channel: that is an ordinary
// message, answered as any slash text the head does not know, and grants nothing. The owner then types /reject in its
// DM: the peer stays unanswered, with no request open. No DM command text is in a model
// request. Runs apart from tlon-approval-commands-dm-conformance: the denial limit lets a
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

  // The guest owns the bot; the peer asks. The channel's host reports a channel post's
  // author, so the owner's /allow there is an ordinary message: it grants nothing and is
  // answered as any message there is. The owner then rejects it from its DM. The bot's DM with the
  // guest starts over so that the card can reach it.
  await t.forget(guest)
  await t.configure(guest)
  const swapped = t.da(Date.now())
  const second = await asks(peer)
  await until('the new owner is sent a card', async () => (await t.dmFromBot(guest, swapped))
    .some((post) => t.words(post).includes(`Channel mention request from ${peer.ship}`)))
  const posted = `/allow ${second.id}`
  await t.post(guest, posted)
  // The head answers it as it answers any slash text it does not know.
  const [plain] = await until('the owner\'s channel /allow is answered as an ordinary message', async () => {
    const found = await t.channelFromBot(swapped)
    return found.length && found
  })
  assert.equal(t.words(plain), 'Unknown command. Send /help for the available commands.')
  const unchanged = await status()
  assert.deepEqual(requests(unchanged, peer), [second], 'a channel /allow closed the request')
  assert.deepEqual(grants(unchanged), [], 'a channel /allow gave access')
  assert.ok(!unchanged.events.some((notice) => notice.kind === 'approval-allowed' && notice.actor === peer.ship), 'a channel /allow was recorded as allowed')
  const replies = [...await t.channelFromBot(swapped), ...await t.dmFromBot(guest, swapped)]
  assert.ok(!replies.some((post) => t.words(post).includes(`Approved ${peer.ship}`)), 'a channel /allow was answered as a command')
  console.log('PASS the owner\'s /allow in the channel grants nothing and is an ordinary message')

  const rejected = `/reject ${second.id}`
  await t.dm(guest, bot, rejected)
  await until('the owner\'s /reject in its DM is answered there', async () => (await t.dmFromBot(guest, swapped))
    .some((post) => t.words(post).includes(`Denied ${peer.ship} for `)))
  const after = await status()
  assert.deepEqual(requests(after, peer), [], 'the rejected request is still open')
  assert.deepEqual(grants(after), [], 'reject gave access')
  assert.ok(after.events.some((notice) => notice.kind === 'approval-rejected' && notice.actor === peer.ship))
  const quiet = t.da(Date.now())
  await t.post(peer, sentText('again'))
  await sleep(4000)
  assert.ok(!answered(await t.channelFromBot(quiet)), 'the rejected peer was answered')
  assert.ok(!t.seen(sentText('again')), 'the rejected peer\'s mention reached the model')
  assert.ok(!t.seen(rejected), 'the owner\'s DM command reached the model')
  console.log('PASS the owner\'s /reject in its DM closes the request and gives nothing')
} finally {
  await t.stop()
}
