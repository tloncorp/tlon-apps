import { test as setup } from '@playwright/test';

import { shouldIncludeShip } from '../rube/shipSelection';
import shipManifest from './shipManifest.json';

Object.entries(shipManifest).forEach(([_key, ship]: [string, any]) => {
  if (ship.skipAuth || !shouldIncludeShip(ship)) {
    return;
  }

  setup(`authenticate ${ship.ship}`, async ({ page }) => {
    await page.goto(`${ship.webUrl}/~/login`);
    await page.getByPlaceholder('sampel-ticlyt-migfun-falmel').fill(ship.code);
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.waitForURL(`${ship.webUrl}/apps/landscape/`);
    await page.context().storageState({ path: ship.authFile });
  });
});
