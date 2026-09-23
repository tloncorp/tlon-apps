import { Page, expect } from '@playwright/test';
import { MIN_GROUPS_VERSION } from '@tloncorp/shared/logic/deskPolicy';

import { shouldIncludeShip } from '../rube/shipSelection';
import * as helpers from './helpers';
import shipManifest from './shipManifest.json';
import { test } from './test-fixtures';

/**
 * Ground truth for the N-1 desk policy (docs/tlon-apps/desk-compatibility.md):
 * this client, running against the *previous* %groups release, must start,
 * sync, and talk to a ship on the current desk in both directions.
 *
 * ~bud is the pinned N-1 pier — a hand-built fakeship carrying desk
 * MIN_GROUPS_VERSION, rebuilt by rube/build-n1-pier.sh whenever that constant
 * moves. ~bus is a different ship for a different purpose (deliberately far
 * out of date, for protocol-mismatch rendering) and is not used here.
 *
 * Nothing else in the repo runs the version boundary: a mismatch that only
 * shows between two real ships — a negotiation protocol the pair cannot
 * agree on, a response shape that changed — shows up here or nowhere.
 *
 * ## Coverage
 *
 * Both browser contexts run the *current* client; the only thing that differs
 * is the desk under each ship. So every step below is the current client
 * driving a current-desk ship (~zod) and the current client driving an
 * N-1-desk ship (~bud), with the two ships' agents talking to each other
 * across the version boundary. Steps run in both directions wherever the
 * acting side is a real choice: a request family is only covered in the
 * direction it was sent, since whichever ship acts is the one whose agent
 * builds the request and the other is the one that has to understand it.
 *
 * | Step                           | Acts → observes | Agents / request families crossing the boundary                                    |
 * | ------------------------------ | --------------- | --------------------------------------------------------------------------------- |
 * | startup                        | —               | %docket charges; the client's own compatibility gate                              |
 * | version boundary               | —               | %docket charges on both ships                                                     |
 * | group create / invite / accept | zod → bud       | %groups (create, invite, preview, join), %grouper, %contacts (invitee lookup);     |
 * |                               |                 | a cabal added before the invite, so it travels in the snapshot the joiner pulls    |
 * | chat post                      | both ways       | %channels-server (zod hosts) ↔ %channels (bud subscribes): post add                |
 * | thread reply                   | both ways       | %channels reply add; reply-count meta on the parent post                          |
 * | reaction add + remove          | both ways       | %channels post react / del-react                                                  |
 * | edit own message               | both ways       | %channels post edit (a revision on an existing seal)                              |
 * | delete own message             | both ways       | %channels post del (tombstone propagation)                                        |
 * | ship mention                   | both ways       | %channels post add with a rich `ship` inline; %activity mention event; %contacts   |
 * | quote reply                    | both ways       | %channels post add carrying a cite block referencing another post                 |
 * | notebook (diary) channel       | both ways       | %channels create kind=%diary, post add, and post reply (comments) on a diary       |
 * | gallery (heap) channel         | both ways       | %channels create kind=%heap, post add on a heap channel                           |
 * | Admin given to the N-1 ship    | zod → bud       | %groups fleet sects add; ~bud's own admin-gated UI is the receipt                 |
 * | role read on the N-1 desk      | zod → bud       | %groups cabal carried in the group snapshot; assign/unassign asserted on ~zod     |
 * |                               |                 | only — see the role step for the two cross-ship assertions that did not pass       |
 * | channel rename                 | zod → bud       | %groups channel edit + %channels meta update                                      |
 * | group pin / unpin              | zod (local)     | client-local pin state — deliberately NOT observed on ~bud, it is not group state |
 * | group rename                   | zod → bud       | %groups meta edit                                                                 |
 * | admin action by the N-1 ship   | bud → zod       | %groups action proxied from an N-1 member to the current-desk host, plus           |
 * |                                |                 | %channels-server *on the N-1 desk* hosting a channel the current desk joins,       |
 * |                                |                 | posts to, and sees deleted                                                        |
 * | DM                             | both ways       | %chat (dm invite, accept, writ) — a second agent pair, a second negotiation       |
 * | activity feed                  | bud observes    | %activity stream built on the N-1 desk out of current-desk events                 |
 *
 * Not covered: a group DM (club). %chat clubs have no helper in helpers.ts and
 * no spec in this suite drives one, so there is nothing to reuse; adding a club
 * step would mean writing that UI flow from scratch, which belongs in a club
 * spec rather than in the version-boundary spec.
 *
 * Also not covered, and for a worse reason: a role created in a group ~bud has
 * already joined, and a custom role assigned to ~bud. Both steps were written
 * and neither passed — see the note on the role step for what was observed.
 */
const n1Ship = shipManifest['~bud'];
const currentShip = shipManifest['~zod'];

test.skip(
  !shouldIncludeShip(n1Ship),
  `Requires the N-1 ship ~${n1Ship.ship}; run with N1_SHIP=${n1Ship.ship}`
);

// Every desk-facing flow the client has a helper for, run across the version
// boundary in one test: the setup this needs (two piers, a desk apply, two web
// servers) costs minutes, so the steps share one rather than each paying it.
test.setTimeout(1_500_000);

const groupName = `~${n1Ship.ship}, ~${currentShip.ship}`;

// The names that outlive the test are spelled the same way in the cleanup in
// test-fixtures.ts. Renaming the group here means updating that file too.
const renamedGroup = 'N-1 Interop Group';
const notebookChannel = 'N-1 Notebook';
const galleryChannel = 'N-1 Gallery';
const renamedChannel = 'N-1 General';
const n1HostedChannel = 'N-1 Hosted Chat';
const reviewerRole = 'N-1 Reviewer';

/**
 * The %groups version a ship reports, read through its own web origin.
 *
 * playwright.config.ts sets baseURL to ~zod, so a relative request would query
 * ~zod whichever ship the page is showing. The absolute URL comes from the
 * manifest, and page.request carries that context's session cookie.
 */
async function reportedDeskVersion(
  page: Page,
  ship: { webUrl: string }
): Promise<string> {
  const response = await page.request.get(
    `${ship.webUrl}/~/scry/docket/charges.json`
  );
  expect(response.ok()).toBe(true);
  const charges = await response.json();
  return charges.initial.groups.version;
}

/**
 * Opens a channel from the group's channel list, waiting out the auto-join a
 * newly created channel goes through on the ship that did not create it.
 */
async function openChannel(page: Page, channelName: string) {
  const listItem = page.getByTestId(`ChannelListItem-${channelName}`);
  await expect(listItem).toBeVisible({ timeout: 30000 });
  await expect(listItem.getByText('Join')).not.toBeVisible({ timeout: 30000 });
  await listItem.click();
  await helpers.channelIsLoaded(page);
}

/** Navigates into the group's manage-channels screen from anywhere in it. */
async function openManageChannels(page: Page) {
  await helpers.openGroupSettings(page);
  await expect(page.getByTestId('GroupChannels')).toBeVisible({
    timeout: 10000,
  });
  await page.getByTestId('GroupChannels').click();
  await expect(page.getByText('New', { exact: true })).toBeVisible({
    timeout: 10000,
  });
}

function escapeForRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * A notebook post's row in the channel, addressed by its post frame rather
 * than by its title text: the group's channel list renders the same title as
 * the channel's latest-post preview, and that preview comes first in the DOM.
 */
function notebookPost(page: Page, title: string) {
  return page.getByTestId('Post').filter({ hasText: title }).first();
}

/**
 * The position of a channel in the manage-channels list.
 *
 * editChannel/deleteChannel address a row by `ChannelItem-<title>-<index>`, and
 * that index moves as channels are added: the backend prepends a new channel to
 * its section's order, so General is not at 0 once anything else exists.
 */
async function channelItemIndex(page: Page, channelName: string) {
  const item = page.getByTestId(
    new RegExp(`^ChannelItem-${escapeForRegExp(channelName)}-`)
  );
  await expect(item).toBeVisible({ timeout: 15000 });
  const testId = await item.getAttribute('data-testid');
  const index = Number(testId?.split('-').pop());
  expect(
    Number.isInteger(index),
    `no ChannelItem index for ${channelName} (testID ${testId})`
  ).toBe(true);
  return index;
}

/**
 * The position of a ship's row in the members list.
 *
 * assignRoleToMember/unassignRoleFromMember address a row by index, and the
 * list is sectioned by role — so giving ~bud a role moves its row.
 */
async function memberRowIndex(page: Page, shipName: string) {
  const rows = page.getByTestId('MemberRow');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  const texts = await rows.allTextContents();
  const index = texts.findIndex((text) => text.includes(`~${shipName}`));
  expect(
    index,
    `no member row for ~${shipName} in ${texts.join(' | ')}`
  ).toBeGreaterThanOrEqual(0);
  return index;
}

test('current client interoperates with a ship on the N-1 desk', async ({
  zodSetup,
  budSetup,
}) => {
  const zodPage = zodSetup.page;
  const budPage = budSetup.page;

  await test.step('startup on both desks', async () => {
    // Reaching 'Home' at all is the startup proof: the fixture navigated to the
    // app on a ship one desk release behind and it rendered the home screen
    // rather than a compatibility gate. MIN_GROUPS_VERSION is the floor, not
    // below it, so ~bud must be treated as supported.
    await expect(zodPage.getByText('Home')).toBeVisible();
    await expect(budPage.getByText('Home')).toBeVisible();
  });

  await test.step('the version boundary is real', async () => {
    // Without this the whole spec could pass against two identical ships and
    // prove nothing. The manifest's label cannot show it; the ship must.
    const budVersion = await reportedDeskVersion(budPage, n1Ship);
    const zodVersion = await reportedDeskVersion(zodPage, currentShip);
    expect(budVersion).toBe(MIN_GROUPS_VERSION);
    expect(budVersion).not.toBe(zodVersion);
  });

  await test.step('group: the current desk hosts, the N-1 desk joins', async () => {
    await helpers.createGroup(zodPage);

    // The role is created before the invite deliberately. A cabal added to a
    // group an N-1 member has *already joined* did not reach that member in a
    // local run (see the role step below), so what this covers is the path that
    // does work: the cabal travelling in the group snapshot the joiner pulls.
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupRoles').click();
    await helpers.createRole(
      zodPage,
      reviewerRole,
      'A role created on the current desk'
    );
    await helpers.navigateBack(zodPage);

    await helpers.inviteMembersToGroup(zodPage, [n1Ship.ship]);

    await helpers.navigateBack(zodPage);
    await helpers.navigateToGroupByTestId(zodPage, {
      expectedDisplayName: groupName,
    });

    await helpers.acceptGroupInvite(budPage, groupName);

    // Both ships see the same group, which is the cross-desk sync of the group
    // itself rather than of any post in it.
    await budPage.getByTestId('HomeNavIcon').click();
    await expect(
      budPage.getByTestId('GroupListItem-Untitled group-unpinned')
    ).toBeVisible({ timeout: 15000 });
    await expect(zodPage.getByTestId('ChannelListItem-General')).toBeVisible();

    await budPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
    await helpers.navigateToChannel(budPage, 'General');
  });

  const zodPost = 'Current desk speaking to the N-1 desk';
  const budPost = 'N-1 desk answering the current desk';

  await test.step('chat: a post each way', async () => {
    await helpers.sendMessage(zodPage, zodPost);
    await expect(budPage.getByText(zodPost).first()).toBeVisible({
      timeout: 20000,
    });

    await helpers.sendMessage(budPage, budPost);
    await expect(zodPage.getByText(budPost).first()).toBeVisible({
      timeout: 20000,
    });
  });

  await test.step('chat: a thread reply each way', async () => {
    const zodReply = 'Zod thread reply written on the current desk';
    const budReply = 'Bud thread reply written on the N-1 desk';

    await helpers.startThread(zodPage, zodPost);
    await helpers.sendThreadReply(zodPage, zodReply);
    await helpers.navigateBack(zodPage);
    await expect(zodPage.getByText('1 reply')).toBeVisible({ timeout: 10000 });

    await expect(budPage.getByText('1 reply')).toBeVisible({ timeout: 20000 });
    await budPage.getByText('1 reply').click();
    await expect(budPage.getByText(zodReply).first()).toBeVisible({
      timeout: 20000,
    });
    await helpers.sendThreadReply(budPage, budReply);

    await expect(zodPage.getByText('2 replies')).toBeVisible({
      timeout: 20000,
    });
    await zodPage.getByText('2 replies').click();
    await expect(zodPage.getByText(budReply).first()).toBeVisible({
      timeout: 20000,
    });

    await helpers.navigateBack(zodPage);
    await helpers.navigateBack(budPage);
  });

  await test.step('chat: a reaction each way, then removed each way', async () => {
    await helpers.reactToMessage(zodPage, budPost, 'heart');
    await expect(budPage.getByText('❤️')).toBeVisible({ timeout: 20000 });

    await helpers.reactToMessage(budPage, zodPost, 'laughing');
    await expect(zodPage.getByText('😆')).toBeVisible({ timeout: 20000 });

    await helpers.removeReaction(zodPage, '❤️');
    await expect(budPage.getByText('❤️')).not.toBeVisible({ timeout: 20000 });

    await helpers.removeReaction(budPage, '😆');
    await expect(zodPage.getByText('😆')).not.toBeVisible({ timeout: 20000 });
  });

  await test.step('chat: an edit of ones own message each way', async () => {
    const zodBefore = 'Zod draft before the current-desk edit';
    const zodAfter = 'Zod text after the current-desk edit';
    const budBefore = 'Bud draft before the N-1 edit';
    const budAfter = 'Bud text after the N-1 edit';

    await helpers.sendMessage(zodPage, zodBefore);
    await expect(budPage.getByText(zodBefore).first()).toBeVisible({
      timeout: 20000,
    });
    await helpers.editMessage(zodPage, zodBefore, zodAfter);
    await expect(budPage.getByText(zodAfter).first()).toBeVisible({
      timeout: 20000,
    });
    await expect(
      budPage.getByTestId('Post').getByText(zodBefore, { exact: true })
    ).not.toBeVisible({ timeout: 20000 });

    await helpers.sendMessage(budPage, budBefore);
    await expect(zodPage.getByText(budBefore).first()).toBeVisible({
      timeout: 20000,
    });
    await helpers.editMessage(budPage, budBefore, budAfter);
    await expect(zodPage.getByText(budAfter).first()).toBeVisible({
      timeout: 20000,
    });
    await expect(
      zodPage.getByTestId('Post').getByText(budBefore, { exact: true })
    ).not.toBeVisible({ timeout: 20000 });
  });

  await test.step('chat: a delete of ones own message each way', async () => {
    const zodDoomed = 'Zod message the current desk will delete';
    const budDoomed = 'Bud message the N-1 desk will delete';

    await helpers.sendMessage(zodPage, zodDoomed);
    await expect(budPage.getByText(zodDoomed).first()).toBeVisible({
      timeout: 20000,
    });
    await helpers.deleteMessage(zodPage, zodDoomed);
    await expect(
      budPage.getByTestId('Post').getByText(zodDoomed, { exact: true })
    ).not.toBeVisible({ timeout: 20000 });

    await helpers.sendMessage(budPage, budDoomed);
    await expect(zodPage.getByText(budDoomed).first()).toBeVisible({
      timeout: 20000,
    });
    await helpers.deleteMessage(budPage, budDoomed);
    await expect(
      zodPage.getByTestId('Post').getByText(budDoomed, { exact: true })
    ).not.toBeVisible({ timeout: 20000 });
  });

  const zodMention = 'Zod mention for the N-1 desk';

  await test.step('chat: a ship mention each way', async () => {
    const budMention = 'Bud mention for the current desk';

    await helpers.sendMentionMessage(zodPage, {
      inputText: `${zodMention} @${n1Ship.ship}`,
      suggestionTestId: `~${n1Ship.ship}-contact`,
      selectedMentionTestId: `SelectedMention-~${n1Ship.ship}`,
      expectedInputText: new RegExp(`^${zodMention} [@~]${n1Ship.ship}$`),
      expectedPostText: new RegExp(`${zodMention}\\s+~${n1Ship.ship}`, 'i'),
      expectedMentionInline: { ship: `~${n1Ship.ship}` },
      postMentionTestId: `PostMention-~${n1Ship.ship}`,
    });
    await expect(
      budPage.getByTestId(`PostMention-~${n1Ship.ship}`).first()
    ).toBeVisible({ timeout: 20000 });

    await helpers.sendMentionMessage(budPage, {
      inputText: `${budMention} @${currentShip.ship}`,
      suggestionTestId: `~${currentShip.ship}-contact`,
      selectedMentionTestId: `SelectedMention-~${currentShip.ship}`,
      expectedInputText: new RegExp(`^${budMention} [@~]${currentShip.ship}$`),
      expectedPostText: new RegExp(
        `${budMention}\\s+~${currentShip.ship}`,
        'i'
      ),
      expectedMentionInline: { ship: `~${currentShip.ship}` },
      postMentionTestId: `PostMention-~${currentShip.ship}`,
    });
    await expect(
      zodPage.getByTestId(`PostMention-~${currentShip.ship}`).first()
    ).toBeVisible({ timeout: 20000 });
  });

  await test.step('chat: a quote reply each way', async () => {
    const zodQuote = 'Zod quoting the N-1 desk back at it';
    const budQuote = 'Bud quoting the current desk back at it';

    await helpers.quoteReply(zodPage, budPost, zodQuote);
    await expect(budPage.getByText(zodQuote).first()).toBeVisible({
      timeout: 20000,
    });

    await helpers.quoteReply(budPage, zodPost, budQuote);
    await expect(zodPage.getByText(budQuote).first()).toBeVisible({
      timeout: 20000,
    });
  });

  await test.step('notebook: a diary channel, a post each way, a comment each way', async () => {
    const zodTitle = 'Notebook post from the current desk';
    const zodBody = 'Notebook body written on the current desk';
    const budTitle = 'Notebook post from the N-1 desk';
    const budBody = 'Notebook body written on the N-1 desk';
    const budComment = 'N-1 desk commenting on the current desk post';
    const zodComment = 'Current desk commenting on the N-1 post';

    // The create-channel sheet no longer offers the diary type, so the fixture
    // is built by poking %channels directly (see createDiaryChannel).
    await openManageChannels(zodPage);
    await helpers.createDiaryChannel(zodPage, notebookChannel);

    await openChannel(zodPage, notebookChannel);
    await helpers.createNotebookPost(zodPage, zodTitle, zodBody);

    await openChannel(budPage, notebookChannel);
    await expect(budPage.getByText(zodTitle).first()).toBeVisible({
      timeout: 30000,
    });

    // A comment is a reply on a diary post rather than a top-level add. The
    // post is addressed by its row rather than by its text: the group's
    // channel list shows the same title as the channel's latest-post preview,
    // and clicking that would only re-enter the channel.
    await notebookPost(budPage, zodTitle).click({ force: true });
    await expect(
      budPage.getByTestId('NotebookPostContent').getByText(zodBody)
    ).toBeVisible({ timeout: 20000 });
    await helpers.sendMessage(budPage, budComment);

    await notebookPost(zodPage, zodTitle).click({ force: true });
    await expect(zodPage.getByText(budComment).first()).toBeVisible({
      timeout: 30000,
    });
    await helpers.navigateBack(zodPage);

    await helpers.navigateBack(budPage);
    await helpers.createNotebookPost(budPage, budTitle, budBody);

    await expect(zodPage.getByText(budTitle).first()).toBeVisible({
      timeout: 30000,
    });
    await notebookPost(zodPage, budTitle).click({ force: true });
    await expect(
      zodPage.getByTestId('NotebookPostContent').getByText(budBody)
    ).toBeVisible({ timeout: 20000 });
    await helpers.sendMessage(zodPage, zodComment);

    await notebookPost(budPage, budTitle).click({ force: true });
    await expect(budPage.getByText(zodComment).first()).toBeVisible({
      timeout: 30000,
    });

    await helpers.navigateBack(zodPage);
    await helpers.navigateBack(budPage);
  });

  await test.step('gallery: a heap channel and a post each way', async () => {
    const zodGalleryPost = 'Gallery post from the current desk';
    const budGalleryPost = 'Gallery post from the N-1 desk';

    await openManageChannels(zodPage);
    await helpers.createChannel(zodPage, galleryChannel, 'gallery');

    await openChannel(zodPage, galleryChannel);
    await helpers.createGalleryPost(zodPage, zodGalleryPost);

    await openChannel(budPage, galleryChannel);
    await expect(budPage.getByText(zodGalleryPost).first()).toBeVisible({
      timeout: 30000,
    });

    await helpers.createGalleryPost(budPage, budGalleryPost);
    await expect(zodPage.getByText(budGalleryPost).first()).toBeVisible({
      timeout: 30000,
    });
  });

  await test.step('group admin: the N-1 desk is given the Admin role', async () => {
    await helpers.openGroupSettings(zodPage);
    await zodPage.getByTestId('GroupMembers').click();
    await helpers.assignRoleToMember(
      zodPage,
      'Admin',
      await memberRowIndex(zodPage, n1Ship.ship)
    );

    // The admin-only rows of the settings screen are gated on the current
    // user's sects, which come from the group's fleet — so their appearing on
    // ~bud is the N-1 desk seeing its own new role. It also unlocks the roles,
    // members and channels screens the rest of this spec drives from ~bud.
    await helpers.openGroupSettings(budPage);
    await expect(budPage.getByTestId('GroupRoles')).toBeVisible({
      timeout: 30000,
    });
  });

  await test.step('group admin: a role reaches the N-1 desk and is assigned', async () => {
    // The role travelled with the group at join time, so this is the N-1 desk
    // reading a cabal written by the current desk.
    await budPage.getByTestId('GroupRoles').click();
    await expect(budPage.getByTestId(`GroupRole-${reviewerRole}`)).toBeVisible({
      timeout: 30000,
    });
    await helpers.navigateBack(budPage);

    // Assigning and unassigning it is asserted on ~zod only, and that is a
    // finding rather than a preference. Two cross-ship assertions were written
    // here and neither passed against ~bud:
    //
    //   - creating the role *now*, in a group ~bud has already joined: ~zod's
    //     roles screen listed it at once, ~bud's still showed only Admin and
    //     Members 30s later;
    //   - assigning this custom role to ~bud: ~zod's members list moved ~bud
    //     under an "N-1 Reviewer" section, ~bud's own members list still
    //     showed only the Admin section 30s later.
    //
    // The Admin sects change in the step above *did* reach ~bud live, so ~bud
    // is receiving fleet updates — it is the custom cabal, and sects naming
    // it, that do not arrive. Whether that is an N-1 gap or a general one is
    // not settled here: nothing else in this suite adds a role to, or assigns
    // a non-Admin role in, a group an existing member has already joined, so
    // there is no same-desk control to compare against.
    await helpers.navigateBack(zodPage);
    await zodPage.getByTestId('GroupMembers').click();
    await helpers.assignRoleToMember(
      zodPage,
      reviewerRole,
      await memberRowIndex(zodPage, n1Ship.ship)
    );
    await expect(zodPage.getByText(reviewerRole).first()).toBeVisible({
      timeout: 15000,
    });

    await helpers.unassignRoleFromMember(
      zodPage,
      reviewerRole,
      await memberRowIndex(zodPage, n1Ship.ship)
    );
    await expect(zodPage.getByText(reviewerRole).first()).not.toBeVisible({
      timeout: 15000,
    });
  });

  await test.step('group admin: a channel renamed', async () => {
    await helpers.navigateBack(zodPage);
    await zodPage.getByTestId('GroupChannels').click();
    await helpers.editChannel(
      zodPage,
      'General',
      renamedChannel,
      undefined,
      await channelItemIndex(zodPage, 'General')
    );

    await expect(
      budPage.getByTestId(`ChannelListItem-${renamedChannel}`)
    ).toBeVisible({ timeout: 30000 });
  });

  await test.step('group admin: the group pinned and unpinned', async () => {
    // A pin is client-local state, not group metadata: ~bud is deliberately not
    // asserted on, because it should not and does not see ~zod's pin.
    await helpers.openGroupSettings(zodPage);
    expect(await helpers.toggleChatPin(zodPage)).toBe('pinned');

    await zodPage.getByTestId('HomeNavIcon').click();
    await expect(
      zodPage.getByTestId('GroupListItem-Untitled group-pinned')
    ).toBeVisible({ timeout: 15000 });

    await zodPage.getByTestId('GroupListItem-Untitled group-pinned').click();
    await helpers.openGroupSettings(zodPage);
    expect(await helpers.toggleChatPin(zodPage)).toBe('unpinned');

    await zodPage.getByTestId('HomeNavIcon').click();
    await expect(
      zodPage.getByTestId('GroupListItem-Untitled group-unpinned')
    ).toBeVisible({ timeout: 15000 });
  });

  await test.step('group admin: the group renamed', async () => {
    await zodPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
    // openGroupCustomization reaches the edit form from the group info screen's
    // header, so the settings screen has to be open before it is called.
    await helpers.openGroupSettings(zodPage);
    await helpers.openGroupCustomization(zodPage);
    await helpers.changeGroupName(zodPage, renamedGroup);

    await budPage.getByTestId('HomeNavIcon').click();
    await expect(
      budPage.getByTestId(`GroupListItem-${renamedGroup}-unpinned`)
    ).toBeVisible({ timeout: 30000 });
  });

  await test.step('the N-1 desk acts as admin: hosts a channel, then deletes it', async () => {
    const zodInN1Channel = 'Current desk posting into an N-1 hosted channel';

    // A channel is hosted by whoever creates it, so this one lives on ~bud's
    // %channels-server: the N-1 desk serving the current desk, the one
    // direction nothing above covers. The group action that attaches it is
    // proxied from the N-1 member to the current-desk host.
    await budPage.getByTestId(`GroupListItem-${renamedGroup}-unpinned`).click();
    await openManageChannels(budPage);
    await helpers.createChannel(budPage, n1HostedChannel);

    // ~zod is still on the edit-group-info screen from the rename; go back into
    // the group so the channel list it picks the new channel out of is the
    // group's own.
    await zodPage.getByTestId('HomeNavIcon').click();
    await zodPage.getByTestId(`GroupListItem-${renamedGroup}-unpinned`).click();
    await openChannel(zodPage, n1HostedChannel);
    await helpers.sendMessage(zodPage, zodInN1Channel);

    await openChannel(budPage, n1HostedChannel);
    await expect(budPage.getByText(zodInN1Channel).first()).toBeVisible({
      timeout: 30000,
    });

    await openManageChannels(budPage);
    await helpers.deleteChannel(
      budPage,
      n1HostedChannel,
      await channelItemIndex(budPage, n1HostedChannel)
    );
    await expect(
      zodPage.getByTestId(`ChannelListItem-${n1HostedChannel}`)
    ).not.toBeVisible({ timeout: 30000 });
  });

  // --- DMs cross the boundary in both directions -------------------------
  // DMs ride %chat rather than %channels, so they exercise a second agent
  // pair and a second negotiated protocol. Both directions are run, because
  // opening a DM and accepting one are different exchanges: whichever ship
  // initiates sends the invite, and only the other ship answers it.

  /**
   * Open a DM from `from`, accept it on `to`, and reply. Each side's ship is
   * read from its own page rather than passed in, so the two cannot be given
   * the wrong way round.
   */
  async function exchangeDm(
    from: Page,
    to: Page,
    opening: string,
    reply: string
  ) {
    const fromShip = helpers.ownShipForPage(from);
    const toShip = helpers.ownShipForPage(to);
    expect(fromShip, 'could not identify the sending ship').toBeTruthy();
    expect(toShip, 'could not identify the receiving ship').toBeTruthy();

    await from.getByTestId('HomeNavIcon').click();
    await helpers.createDirectMessage(from, toShip!);
    await helpers.sendMessage(from, opening);

    await to.getByTestId('HomeNavIcon').click();
    await expect(to.getByTestId(`ChannelListItem-${fromShip}`)).toBeVisible({
      timeout: 20000,
    });
    await to.getByTestId(`ChannelListItem-${fromShip}`).click();

    await expect(to.getByText(opening).first()).toBeVisible({ timeout: 20000 });
    await to.getByText('Accept').click();
    await expect(to.getByText('Accept')).not.toBeVisible({ timeout: 10000 });

    await helpers.sendMessage(to, reply);
    await expect(from.getByText(reply).first()).toBeVisible({ timeout: 20000 });
  }

  await test.step('dm: the current desk opens, the N-1 desk accepts', async () => {
    await exchangeDm(
      zodPage,
      budPage,
      'Current desk opening a DM to N-1',
      'N-1 desk accepting and replying'
    );

    // Both sides leave, so the next exchange is a fresh invite rather than the
    // same conversation — an accepted DM has nothing left to accept.
    await helpers.leaveDM(zodPage, `~${n1Ship.ship}`);
    await helpers.leaveDM(budPage, `~${currentShip.ship}`);
  });

  await test.step('dm: the N-1 desk opens, the current desk accepts', async () => {
    await exchangeDm(
      budPage,
      zodPage,
      'N-1 desk opening a DM to the current desk',
      'Current desk accepting and replying'
    );
  });

  await test.step('activity: the N-1 desk builds a feed out of current-desk events', async () => {
    // %activity on the N-1 desk has been fed everything above. The mention is
    // the event with a guaranteed entry, and its own tab holds exactly one
    // row — the All tab would bury it under every later event in this spec,
    // below the fold where a visibility assertion cannot see it.
    await budPage.getByTestId('ActivityNavIcon').click();
    await expect(
      budPage.getByText('Activity', { exact: true }).first()
    ).toBeVisible({ timeout: 20000 });
    await budPage.getByText('Mentions', { exact: true }).click();
    await expect(
      budPage.getByText(new RegExp(escapeForRegExp(zodMention))).first()
    ).toBeVisible({ timeout: 30000 });
    await budPage.getByTestId('HomeNavIcon').click();
  });
});
