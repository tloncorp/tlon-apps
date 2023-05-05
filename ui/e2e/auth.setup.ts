import { test as setup } from '@playwright/test';
import shipManifest from './shipManifest.json';

const authFile = 'e2e/.auth/user.json';
const ship = process.env.SHIP || '~zod';

setup('authenticate', async ({ page }) => {
  await page.goto('http://localhost:3000/~/login');
  await page
    .getByPlaceholder('sampel-ticlyt-migfun-falmel')
    .fill((shipManifest as Record<string, any>)[ship].code);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.waitForURL('http://localhost:3000/apps/grid/');
  await page.context().storageState({ path: authFile });
});
