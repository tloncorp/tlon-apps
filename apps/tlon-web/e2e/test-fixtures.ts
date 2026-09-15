import { Browser, BrowserContext, Page, test as base } from '@playwright/test';

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
      await helpers.cleanupExistingGroup(page, '~ten, ~zod');
      await helpers.cleanupExistingGroup(page, '~bus, ~zod');
      // ~zod hosts the group in the N-1 desk spec, so ~zod is the one that can
      // delete it; ~bud only leaves.
      await helpers.cleanupExistingGroup(page, '~bud, ~zod');
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
      await helpers.leaveGroup(page, '~ten, ~zod');
    } else if (shipName === 'bus') {
      if (await page.getByTestId('ChannelListItem-~zod').isVisible()) {
        await helpers.leaveDM(page, '~zod');
      }
      await helpers.rejectGroupInvite(page);
      await helpers.leaveGroup(page, '~bus, ~zod');
    } else if (shipName === 'bud') {
      if (await page.getByTestId('ChannelListItem-~zod').isVisible()) {
        await helpers.leaveDM(page, '~zod');
      }
      await helpers.rejectGroupInvite(page);
      await helpers.leaveGroup(page, '~bud, ~zod');
    }
  } catch (error) {
    console.log(
      `${shipName} cleanup failed (expected if context was closed):`,
      error.message
    );
  }
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
    use: (setup: ShipSetup) => Promise<void>
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

    await performCleanup(page, ship.ship);

    // Check for errors after test
    if (process.env.USE_PRODUCTION_BUILD === 'true') {
      await errorDetector.checkForErrors(page).catch((error) => {
        console.error('Runtime errors detected in ship:', error.message);
        throw error;
      });
    }

    await context.close();
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
