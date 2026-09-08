import { BrowserContext, Page, test as base } from '@playwright/test';

import * as helpers from './helpers';
import { startCreatedGroupCleanup } from './helpers/scrollerCreatedGroups';
import { dismissPersistedDevTools } from './helpers/scrollerWebAssets';
import { RuntimeErrorDetector } from './runtime-error-detector';
import shipManifest from './shipManifest.json';

type TestFixtures = {
  zodSetup: { context: BrowserContext; page: Page };
  tenSetup: { context: BrowserContext; page: Page };
  busSetup: { context: BrowserContext; page: Page };
  zodPage: Page;
  tenPage: Page;
  busPage: Page;
};

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;
const busUrl = `${shipManifest['~bus'].webUrl}/apps/groups/`;

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
      await helpers.cleanupExistingGroup(page, 'My Group');
      await helpers.cleanupExistingGroup(page, '~ten, ~zod');
      await helpers.cleanupExistingGroup(page, '~bus, ~zod');
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
    }
  } catch (error) {
    console.log(
      `${shipName} cleanup failed (expected if context was closed):`,
      error.message
    );
  }
}

export const testWithOptions = (options?: {
  installClock?: boolean;
  /** Scroller fixtures may clean only their acknowledged local group-create IDs. */
  createdGroupCleanup?: boolean;
  // App/database initialization precedes the scenario's measured actions.
  appReadyTimeoutMs?: number;
  /** Opt out when qualifying normal application sync and deferred UI paths. */
  e2eMode?: boolean;
}) =>
  base.extend<TestFixtures>({
    zodSetup: async ({ browser }, use, testInfo) => {
      const context = await browser.newContext({
        storageState: shipManifest['~zod'].authFile,
      });
      if (options?.e2eMode !== false) await markContextAsE2E(context);
      const page = await context.newPage();
      if (options?.installClock) {
        await page.clock.install();
      }

      // Attach error detector if in production mode
      const errorDetector = new RuntimeErrorDetector();
      if (process.env.USE_PRODUCTION_BUILD === 'true') {
        await errorDetector.attachToPage(page);
      }

      await page.goto(zodUrl);
      await page.waitForSelector('text=Home', {
        state: 'visible',
        timeout: options?.appReadyTimeoutMs,
      });
      await dismissPersistedDevTools(page);
      await page.waitForTimeout(1000);

      const created = options?.createdGroupCleanup
        ? await startCreatedGroupCleanup(page, shipManifest['~zod'])
        : undefined;
      if (!created) await performCleanup(page, 'zod');
      try {
        await use({ context, page });
      } finally {
        try {
          if (created) {
            const receipt = await created.finish();
            await testInfo.attach('scroller-created-group-cleanup', {
              body: JSON.stringify(receipt),
              contentType: 'application/json',
            });
            if (receipt.status !== 'complete')
              throw new Error(
                `Scoped fixture cleanup incomplete: ${receipt.errors.join('; ')}`
              );
          } else {
            await performCleanup(page, 'zod');
          }
          if (process.env.USE_PRODUCTION_BUILD === 'true') {
            await errorDetector.checkForErrors(page);
          }
        } finally {
          await context.close();
        }
      }
    },

    tenSetup: async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: shipManifest['~ten'].authFile,
      });
      if (options?.e2eMode !== false) await markContextAsE2E(context);
      const page = await context.newPage();
      if (options?.installClock) {
        await page.clock.install();
      }

      // Attach error detector if in production mode
      const errorDetector = new RuntimeErrorDetector();
      if (process.env.USE_PRODUCTION_BUILD === 'true') {
        await errorDetector.attachToPage(page);
      }

      await page.goto(tenUrl);
      await page.waitForSelector('text=Home', {
        state: 'visible',
        timeout: options?.appReadyTimeoutMs,
      });
      await dismissPersistedDevTools(page);
      await page.waitForTimeout(1000);
      await performCleanup(page, 'ten');

      await use({ context, page });

      await performCleanup(page, 'ten');

      // Check for errors after test
      if (process.env.USE_PRODUCTION_BUILD === 'true') {
        await errorDetector.checkForErrors(page).catch((error) => {
          console.error('Runtime errors detected in ship:', error.message);
          throw error;
        });
      }

      await context.close();
    },

    busSetup: async ({ browser }, use) => {
      const context = await browser.newContext({
        storageState: shipManifest['~bus'].authFile,
      });
      if (options?.e2eMode !== false) await markContextAsE2E(context);
      const page = await context.newPage();
      if (options?.installClock) {
        await page.clock.install();
      }

      // Attach error detector if in production mode
      const errorDetector = new RuntimeErrorDetector();
      if (process.env.USE_PRODUCTION_BUILD === 'true') {
        await errorDetector.attachToPage(page);
      }

      await page.goto(busUrl);
      await page.waitForSelector('text=Home', {
        state: 'visible',
        timeout: options?.appReadyTimeoutMs,
      });
      await dismissPersistedDevTools(page);

      await page.waitForTimeout(1000);
      await performCleanup(page, 'bus');

      await use({ context, page });

      await performCleanup(page, 'bus');

      // Check for errors after test
      if (process.env.USE_PRODUCTION_BUILD === 'true') {
        await errorDetector.checkForErrors(page).catch((error) => {
          console.error('Runtime errors detected in ship:', error.message);
          throw error;
        });
      }

      await context.close();
    },

    zodPage: async ({ zodSetup }, use) => {
      await use(zodSetup.page);
    },

    tenPage: async ({ tenSetup }, use) => {
      await use(tenSetup.page);
    },

    busPage: async ({ busSetup }, use) => {
      await use(busSetup.page);
    },
  });

export const test = testWithOptions();

export { expect } from '@playwright/test';
