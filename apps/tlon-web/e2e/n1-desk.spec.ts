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
 */
const n1Ship = shipManifest['~bud'];
const currentShip = shipManifest['~zod'];

test.skip(
  !shouldIncludeShip(n1Ship),
  `Requires the N-1 ship ~${n1Ship.ship}; run with N1_SHIP=${n1Ship.ship}`
);

// Group create + invite + accept + two-way post + a DM each way, across two
// ships, with a cross-ship sync between every step.
test.setTimeout(300_000);

const groupName = `~${n1Ship.ship}, ~${currentShip.ship}`;

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

test('current client interoperates with a ship on the N-1 desk', async ({
  zodSetup,
  budSetup,
}) => {
  const zodPage = zodSetup.page;
  const budPage = budSetup.page;

  // --- startup -----------------------------------------------------------
  // Reaching 'Home' at all is the startup proof: the fixture navigated to the
  // app on a ship one desk release behind and it rendered the home screen
  // rather than a compatibility gate. MIN_GROUPS_VERSION is the floor, not
  // below it, so ~bud must be treated as supported.
  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(budPage.getByText('Home')).toBeVisible();

  // --- the version boundary is real --------------------------------------
  // Without this the whole spec could pass against two identical ships and
  // prove nothing. The manifest's label cannot show it; the ship must.
  const budVersion = await reportedDeskVersion(budPage, n1Ship);
  const zodVersion = await reportedDeskVersion(zodPage, currentShip);
  expect(budVersion).toBe(MIN_GROUPS_VERSION);
  expect(budVersion).not.toBe(zodVersion);

  // --- group: ~zod hosts, ~bud joins -------------------------------------
  await helpers.createGroup(zodPage);
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

  // --- posts travel both ways --------------------------------------------
  const zodPost = 'Current desk speaking to the N-1 desk';
  const budPost = 'N-1 desk answering the current desk';

  await budPage.getByTestId('GroupListItem-Untitled group-unpinned').click();
  await helpers.navigateToChannel(budPage, 'General');

  await helpers.sendMessage(zodPage, zodPost);
  await expect(budPage.getByText(zodPost).first()).toBeVisible({
    timeout: 20000,
  });

  await helpers.sendMessage(budPage, budPost);
  await expect(zodPage.getByText(budPost).first()).toBeVisible({
    timeout: 20000,
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

  // 1. the current desk opens, the N-1 desk accepts.
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

  // 2. the N-1 desk opens, the current desk accepts.
  await exchangeDm(
    budPage,
    zodPage,
    'N-1 desk opening a DM to the current desk',
    'Current desk accepting and replying'
  );
});
