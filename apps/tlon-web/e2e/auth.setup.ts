import { test as setup } from '@playwright/test';

import shipManifest from './shipManifest.json';

setup('authenticate zod', async ({ page }) => {
  await page.goto(`${shipManifest['~zod'].webUrl}/~/login`);
  await page
    .getByPlaceholder('sampel-ticlyt-migfun-falmel')
    .fill((shipManifest as Record<string, any>)['~zod'].code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(`${shipManifest['~zod'].webUrl}/apps/landscape/`);
  await page.context().storageState({ path: shipManifest['~zod'].authFile });
  await page.getByRole('link', { name: 'Tlon' }).waitFor();
});

// setup('authenticate bus', async ({ page }) => {
//   await page.goto(`${shipManifest['~bus'].webUrl}/~/login`);
//   await page
//     .getByPlaceholder('sampel-ticlyt-migfun-falmel')
//     .fill((shipManifest as Record<string, any>)['~bus'].code);
//   await page.getByRole('button', { name: 'Continue' }).click();
//   await page.waitForURL(`${shipManifest['~bus'].webUrl}/apps/landscape/`);
//   await page.context().storageState({ path: shipManifest['~bus'].authFile });
//   await page.getByRole('link', { name: 'Tlon' }).waitFor();
// });
