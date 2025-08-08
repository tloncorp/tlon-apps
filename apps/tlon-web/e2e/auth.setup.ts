import { test as setup } from '@playwright/test';

import shipManifest from './shipManifest.json';

Object.entries(shipManifest).forEach(([key, ship]) => {
  if (ship.skipSetup || ship.skipAuth) {
    return;
  }

  setup(`authenticate ${ship.ship}`, async ({ page }) => {
    await page.goto(`${ship.webUrl}/~/login`);
    await page.getByPlaceholder('sampel-ticlyt-migfun-falmel').fill(ship.code);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(`${ship.webUrl}/apps/landscape/`);
    await page.context().storageState({ path: ship.authFile });
    await page.getByRole('link', { name: 'Tlon' }).waitFor();
  });
});
