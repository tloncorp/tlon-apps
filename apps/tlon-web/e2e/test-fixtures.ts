import { BrowserContext, Page, test as base } from '@playwright/test';

import * as helpers from './helpers';
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

// Helper function for common cleanup logic
async function performCleanup(page: Page, shipName: string) {
  try {
    await page.getByTestId('HomeNavIcon').click();
    if (shipName === 'zod') {
      if (await page.getByTestId('ChannelListItem-~ten').isVisible()) {
        await helpers.leaveDM(page, '~ten');
      }
      if (await page.getByTestId('ChannelListItem-~bus').isVisible()) {
        await helpers.leaveDM(page, '~bus');
      }
      await helpers.cleanupExistingGroup(page, '~ten, ~zod');
      await helpers.cleanupExistingGroup(page, '~bus, ~zod');
      await helpers.cleanupExistingGroup(page);
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

export const test = base.extend<TestFixtures>({
  zodSetup: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: shipManifest['~zod'].authFile,
    });
    const page = await context.newPage();

    await page.goto(zodUrl);
    await page.waitForSelector('text=Home', { state: 'visible' });
    await page.evaluate(() => {
      window.toggleDevTools();
    });

    await use({ context, page });

    // Cleanup happens automatically here - no need for manual checks
    // Playwright handles the cleanup even if tests fail
    await performCleanup(page, 'zod');
  },

  tenSetup: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: shipManifest['~ten'].authFile,
    });
    const page = await context.newPage();

    await page.goto(tenUrl);
    await page.waitForSelector('text=Home', { state: 'visible' });
    await page.evaluate(() => {
      window.toggleDevTools();
    });

    await use({ context, page });

    // Cleanup happens automatically here
    await performCleanup(page, 'ten');
  },

  busSetup: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: shipManifest['~bus'].authFile,
    });
    const page = await context.newPage();

    await page.goto(busUrl);
    await page.waitForSelector('text=Home', { state: 'visible' });
    await page.evaluate(() => {
      window.toggleDevTools();
    });

    await use({ context, page });

    // Cleanup happens automatically here
    await performCleanup(page, 'bus');
  },

  zodPage: async ({ zodSetup }, use) => {
    await use(zodSetup.page);
    // No explicit cleanup needed - Playwright handles page cleanup automatically
  },

  tenPage: async ({ tenSetup }, use) => {
    await use(tenSetup.page);
    // No explicit cleanup needed - Playwright handles page cleanup automatically
  },

  busPage: async ({ busSetup }, use) => {
    await use(busSetup.page);
    // No explicit cleanup needed - Playwright handles page cleanup automatically
  },
});

export { expect } from '@playwright/test';
