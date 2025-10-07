import { test as setup } from '@playwright/test';

import shipManifest from './shipManifest.json';

const INCLUDE_OPTIONAL_SHIPS = process.env.INCLUDE_OPTIONAL_SHIPS === 'true';

Object.entries(shipManifest).forEach(([_key, ship]: [string, any]) => {
  if (ship.skipSetup || ship.skipAuth) {
    return;
  }
  // Skip optional ships unless explicitly included
  if (ship.optional && !INCLUDE_OPTIONAL_SHIPS) {
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
