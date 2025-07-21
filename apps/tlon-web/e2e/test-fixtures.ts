import { Browser, BrowserContext, Page, test as base } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

type TestFixtures = {
  zodSetup: { context: BrowserContext; page: Page };
  tenSetup: { context: BrowserContext; page: Page };
};

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;
const tenUrl = `${shipManifest['~ten'].webUrl}/apps/groups/`;

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

    // Cleanup for pier reuse
    try {
      if (!page.isClosed() && !context.closed) {
        await page.goto(zodUrl);
        await page.waitForSelector('text=Home', { state: 'visible', timeout: 5000 });
        await helpers.cleanupExistingGroup(page, '~ten, ~zod');
        await helpers.cleanupExistingGroup(page, 'Untitled group');
      }
    } catch (error) {
      console.log('Zod cleanup failed (expected):', error.message);
    }
  },

  tenSetup: async ({ browser }, use) => {
    const context = await browser.newContext({
      storageState: shipManifest['~ten'].authFile,
    });
    const page = await context.newPage();

    await page.goto(tenUrl);
    await page.waitForSelector('text=Home', { state: 'visible' });

    await use({ context, page });

    // Cleanup for pier reuse
    try {
      if (!page.isClosed() && !context.closed) {
        await page.goto(tenUrl);
        await page.waitForSelector('text=Home', { state: 'visible', timeout: 5000 });
        await helpers.rejectGroupInvite(page);
        await helpers.leaveGroup(page, '~ten, ~zod');
      }
    } catch (error) {
      console.log('Ten cleanup failed (expected):', error.message);
    }
  },
});

export { expect } from '@playwright/test';
