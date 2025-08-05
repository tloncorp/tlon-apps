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
      await helpers.cleanupExistingGroup(page, 'Invite Test');
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
    await page.waitForTimeout(1000);

    await performCleanup(page, 'zod');

    await use({ context, page });

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
    await page.waitForTimeout(1000);
    await performCleanup(page, 'ten');

    await use({ context, page });

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

    await page.waitForTimeout(1000);
    await performCleanup(page, 'bus');

    await use({ context, page });

    await performCleanup(page, 'bus');
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

export { expect } from '@playwright/test';
