// The owner answers a group invite request, on three real ships: the bot, its owner
// (the peer) and a ship on no list (the guest). The guest creates a group with a
// channel and invites the bot, which does not join; the owner is sent a card for the
// group, and its /allow makes the bot join the group and its channel, while no grant is
// stored for the guest. No model is called. Restores policy and defaults, then the bot
// leaves the group and the guest deletes it. Leaves the card and the replies.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { setTimeout as sleep } from 'node:timers/promises'
import { approvalShips } from './lib/approval-ships.mjs'

const marker = `allow-group-${randomUUID().slice(0, 8)}`
const t = await approvalShips(marker)
const { bot, peer: owner, guest, until, status } = t
const group = `${guest.ship}/${marker}`, chat = `chat/${guest.ship}/${marker}-chat`
const groups = (who) => t.scry(who, 'groups/v2/groups')
const action = (value) => t.poke(guest, 'groups', 'group-action-4', value)
let created = false
try {
  await t.start()
  await t.configure(owner)
  const start = t.da(Date.now())

  created = true
  const response = await fetch(`${guest.url}/spider/groups/group-create-thread/group-create-1/group-ui-2.json`, {
    method: 'POST', headers: { cookie: guest.cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ groupId: group, meta: { title: 'Guest club' }, guestList: [], channels: [] }),
    signal: AbortSignal.timeout(30000),
  })
  assert.ok(response.ok, `create group: HTTP ${response.status}`)
  await until('the guest creates its group', async () => (await groups(guest))[group])
  await t.poke(guest, 'channels', 'channel-action-2', { create: {
    kind: 'chat', name: `${marker}-chat`, group, title: 'Club chat', description: '', meta: null, readers: [], writers: [],
  } })
  await until('the guest creates the group\'s channel', async () => (await groups(guest))[group].channels?.[chat])

  await action({ invite: { flag: group, ships: [bot.ship], 'a-invite': { token: null, note: null } } })
  const [request] = await until('the guest\'s invite opens a group request', async () => {
    const open = (await status()).requests.filter((r) => r.ship === guest.ship && r.address === group)
    return open.length && open
  })
  assert.match(request.id, /^g[0-9a-f]{4}([0-9a-f]{4})?$/)
  const label = `Guest club (${group})`
  const [card] = await until('the owner is sent a card for the group', async () => {
    const found = (await t.dmFromBot(owner, start)).filter((post) => t.words(post).includes(`Group invite request from ${guest.ship} for ${label}`))
    return found.length && found
  })
  const parts = new Map(JSON.parse(card.essay.blob)[0].messages.find((m) => m.updateComponents).updateComponents.components.map((c) => [c.id, c]))
  assert.equal(parts.get('title').text, 'Let the bot join Guest club?')
  const allow = parts.get('allow').action.event.context.text
  assert.match(allow, new RegExp(`^/allow ${request.id} 0v[0-9a-v.]+$`))
  await sleep(3000)
  assert.ok(!(await groups(bot))[group], 'the bot joined the group before the owner allowed it')
  console.log('PASS the guest\'s invite sends the owner a card, and the bot does not join')

  const allowed = t.da(Date.now())
  await t.dm(owner, bot, allow)
  await until('the owner is told the bot joins the group', async () => (await t.dmFromBot(owner, allowed))
    .some((post) => t.words(post).includes(`Approved group invite from ${guest.ship} to ${label}. Joining group...`)))
  await until('the bot joins the group', async () => (await groups(bot))[group])
  await until('the bot joins the group\'s channel', async () => Object.hasOwn(await t.scry(bot, 'channels/v4/channels'), chat))
  const after = await status()
  assert.deepEqual(after.requests.filter((r) => r.address === group), [], 'the allowed request is still open')
  assert.deepEqual(after.policy.allowed, [], 'allow put the guest on the allowed list')
  assert.deepEqual(after.policy.dmGrants, [], 'allow gave DM access')
  assert.deepEqual(after.policy.channelGrants, [], 'allow gave channel access')
  assert.ok(after.events.some((notice) => notice.kind === 'approval-allowed' && notice.actor === guest.ship))
  assert.ok(!t.seen(allow), 'the owner\'s command reached the model')
  console.log('PASS the owner\'s /allow joins the group and its channel and gives nobody access')
} finally {
  try {
    if (created) {
      if ((await groups(bot))[group]) await t.client.pokeAgent('groups', 'group-leave', group)
      if ((await groups(guest))[group]) await action({ group: { flag: group, 'a-group': { delete: null } } })
      await until('the guest\'s group is deleted', async () => !(await groups(guest))[group] && !(await groups(bot))[group], 90000)
    }
  } finally {
    await t.stop()
  }
}
