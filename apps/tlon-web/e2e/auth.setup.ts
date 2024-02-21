import { test as setup } from '@playwright/test';

import shipManifest from './shipManifest.json';

setup('authenticate patbud', async ({ page }) => {
  await page.goto(`${shipManifest['~habduc-patbud'].webUrl}/~/login`);
  await page
    .getByPlaceholder('sampel-ticlyt-migfun-falmel')
    .fill((shipManifest as Record<string, any>)['~habduc-patbud'].code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(
    `${shipManifest['~habduc-patbud'].webUrl}/apps/landscape/`
  );
  await page
    .context()
    .storageState({ path: shipManifest['~habduc-patbud'].authFile });
  await page.getByRole('link', { name: 'Tlon' }).waitFor();
});

setup('authenticate mardev', async ({ page }) => {
  await page.goto(`${shipManifest['~naldeg-mardev'].webUrl}/~/login`);
  await page
    .getByPlaceholder('sampel-ticlyt-migfun-falmel')
    .fill((shipManifest as Record<string, any>)['~naldeg-mardev'].code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL(
    `${shipManifest['~naldeg-mardev'].webUrl}/apps/landscape/`
  );
  await page
    .context()
    .storageState({ path: shipManifest['~naldeg-mardev'].authFile });
  await page.getByRole('link', { name: 'Tlon' }).waitFor();
});
