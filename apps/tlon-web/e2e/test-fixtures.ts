import {
  Browser,
  BrowserContext,
  Page,
  TestInfo,
  test as base,
  expect as baseExpect,
} from '@playwright/test';
import { PATP_REGEX } from '@tloncorp/api/client/utils';
import { valid } from '@urbit/aura';

import * as helpers from './helpers';
import { RuntimeErrorDetector } from './runtime-error-detector';
import shipManifest from './shipManifest.json';

type ShipSetup = { context: BrowserContext; page: Page };

type TestFixtures = {
  zodSetup: ShipSetup;
  tenSetup: ShipSetup;
  busSetup: ShipSetup;
  budSetup: ShipSetup;
  zodPage: Page;
  tenPage: Page;
  busPage: Page;
  budPage: Page;
};

async function markContextAsE2E(context: BrowserContext) {
  await context.addInitScript(() => {
    (globalThis as any).TLON_IS_E2E = true;
  });
}

async function performCleanup(page: Page, shipName: string) {
  try {
    // Dismiss any lingering modals from failed cleanup
    try {
      const cancelButton = page.getByText('Cancel');
      if (await cancelButton.isVisible({ timeout: 2000 })) {
        await cancelButton.click();
        // Wait for modal to disappear
        await cancelButton.waitFor({ state: 'hidden', timeout: 3000 });
      }
    } catch {
      // No modal present, continue
    }

    if (shipName === 'zod') {
      if (await page.getByTestId('ChannelListItem-~ten').isVisible()) {
        await helpers.leaveDM(page, '~ten');
      }
      if (await page.getByTestId('ChannelListItem-~bus').isVisible()) {
        await helpers.leaveDM(page, '~bus');
      }
      if (await page.getByTestId('ChannelListItem-~bud').isVisible()) {
        await helpers.leaveDM(page, '~bud');
      }
      await helpers.cleanupExistingGroup(page, 'My Group');
      await helpers.cleanupExistingGroup(
        page,
        helpers.memberListTitle('~ten', '~zod')
      );
      await helpers.cleanupExistingGroup(
        page,
        helpers.memberListTitle('~bus', '~zod')
      );
      // ~zod hosts the group in the N-1 desk spec, so ~zod is the one that can
      // delete it; ~bud only leaves. That spec renames the group partway
      // through, so both names have to be swept — a run that fails before the
      // rename leaves the first, a run that fails after leaves the second.
      // Deleting the group takes its channels and roles with it, so the
      // notebook, gallery and renamed channels need no separate cleanup.
      await helpers.cleanupExistingGroup(
        page,
        helpers.memberListTitle('~bud', '~zod')
      );
      await helpers.cleanupExistingGroup(page, 'N-1 Interop Group');
      await helpers.cleanupExistingGroup(page);
      await helpers.cleanupExistingGroup(page, 'Invite Test');
      // Template group cleanups
      await helpers.cleanupExistingGroup(page, 'Basic Group');
      await helpers.cleanupExistingGroup(page, 'Book Club');
    } else if (shipName === 'ten') {
      if (await page.getByTestId('ChannelListItem-~zod').isVisible()) {
        await helpers.leaveDM(page, '~zod');
      }
      await helpers.rejectGroupInvite(page);
      await helpers.leaveGroup(page, helpers.memberListTitle('~ten', '~zod'));
    } else if (shipName === 'bus') {
      if (await page.getByTestId('ChannelListItem-~zod').isVisible()) {
        await helpers.leaveDM(page, '~zod');
      }
      await helpers.rejectGroupInvite(page);
      await helpers.leaveGroup(page, helpers.memberListTitle('~bus', '~zod'));
    } else if (shipName === 'bud') {
      if (await page.getByTestId('ChannelListItem-~zod').isVisible()) {
        await helpers.leaveDM(page, '~zod');
      }
      await helpers.rejectGroupInvite(page);
      await helpers.leaveGroup(page, helpers.memberListTitle('~bud', '~zod'));
      await helpers.leaveGroup(page, 'N-1 Interop Group');
    }
  } catch (error) {
    console.log(
      `${shipName} cleanup failed (expected if context was closed):`,
      error.message
    );
  }
}

/**
 * Text that may still show a ship name until a later phase of the no-bare-@p
 * work (TLON-6689) lands. Each selector's subtree is left out of the check.
 */
const SHIP_NAME_ALLOWED_SELECTORS: string[] = [];

/**
 * Fails the test when the page shows a ship name as text. People without a
 * nickname are shown by number; ~ship is a wire identifier only.
 * A test opts out with a `ship-names` annotation saying why.
 */
async function expectNoShipNames(page: Page, testInfo: TestInfo) {
  if (
    testInfo.status !== testInfo.expectedStatus ||
    testInfo.annotations.some((a) => a.type === 'ship-names') ||
    page.isClosed()
  ) {
    return;
  }
  const text = await page.evaluate((allowed) => {
    let visible = document.body.innerText;
    const excludedElements = allowed.length
      ? document.querySelectorAll<HTMLElement>(allowed.join(','))
      : [];
    for (const el of excludedElements) {
      const excluded = el.innerText;
      if (excluded) {
        visible = visible.split(excluded).join('');
      }
    }
    return visible;
  }, SHIP_NAME_ALLOWED_SELECTORS);
  // Each ship name with the text around it, so a failure says where it is.
  const shipNames = [...text.matchAll(new RegExp(PATP_REGEX.source, 'gi'))]
    .filter((match) => valid('p', match[0].toLowerCase()))
    .map((match) =>
      text
        .slice(
          Math.max(0, match.index - 40),
          match.index + match[0].length + 40
        )
        .replace(/\s+/g, ' ')
    );
  baseExpect(
    shipNames,
    `${page.url()} shows ship names as text; show a nickname or the ship's number`
  ).toEqual([]);
}

/**
 * One ship's browser context: an authenticated page on that ship's web server,
 * cleaned up before and after the test. Every ship gets the same treatment, so
 * this is written once and bound per ship below.
 */
const shipFixture =
  (
    manifestKey: keyof typeof shipManifest,
    options?: { installClock?: boolean }
  ) =>
  async (
    { browser }: { browser: Browser },
    use: (setup: ShipSetup) => Promise<void>,
    testInfo: TestInfo
  ) => {
    const ship = shipManifest[manifestKey];
    const context = await browser.newContext({
      storageState: ship.authFile,
    });
    await markContextAsE2E(context);
    const page = await context.newPage();
    if (options?.installClock) {
      await page.clock.install();
    }

    // Attach error detector if in production mode
    const errorDetector = new RuntimeErrorDetector();
    if (process.env.USE_PRODUCTION_BUILD === 'true') {
      await errorDetector.attachToPage(page);
    }

    await page.goto(`${ship.webUrl}/apps/groups/`);
    await page.waitForSelector('text=Home', { state: 'visible' });
    await page.evaluate(() => {
      window.toggleDevTools();
    });
    await page.waitForTimeout(1000);

    await performCleanup(page, ship.ship);

    await use({ context, page });

    // Checked before cleanup, which navigates away, but thrown after it so a
    // failure doesn't leave state behind for the next test.
    const shipNameCheck = await expectNoShipNames(page, testInfo).then(
      () => null,
      (error: Error) => error
    );

    await performCleanup(page, ship.ship);

    // Check for errors after test
    if (process.env.USE_PRODUCTION_BUILD === 'true') {
      await errorDetector.checkForErrors(page).catch((error) => {
        console.error('Runtime errors detected in ship:', error.message);
        throw error;
      });
    }

    await context.close();

    if (shipNameCheck) {
      throw shipNameCheck;
    }
  };

export const testWithOptions = (options?: { installClock?: boolean }) =>
  base.extend<TestFixtures>({
    zodSetup: shipFixture('~zod', options),
    tenSetup: shipFixture('~ten', options),
    busSetup: shipFixture('~bus', options),
    budSetup: shipFixture('~bud', options),

    zodPage: async ({ zodSetup }, use) => {
      await use(zodSetup.page);
    },

    tenPage: async ({ tenSetup }, use) => {
      await use(tenSetup.page);
    },

    busPage: async ({ busSetup }, use) => {
      await use(busSetup.page);
    },

    budPage: async ({ budSetup }, use) => {
      await use(budSetup.page);
    },
  });

export const test = testWithOptions();

export { expect } from '@playwright/test';
