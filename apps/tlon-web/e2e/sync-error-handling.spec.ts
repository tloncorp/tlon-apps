import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.setTimeout(60_000);

test('shows error screen and logs to console when sync init fails', async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: shipManifest['~zod'].authFile,
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Intercept the changes scry (first API call in syncStart) and return 500
  // to simulate a sync init failure
  await page.route('**/~/scry/groups-ui/v7/changes/**', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'simulated sync failure' }),
    })
  );

  await page.goto(zodUrl);

  // The error screen should appear instead of spinning forever
  await expect(page.getByTestId('SyncErrorTitle')).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByTestId('SyncErrorMessage')).toBeVisible();

  // The error should have been logged to console
  expect(
    consoleErrors.some((e) => e.includes('sync since failed'))
  ).toBeTruthy();

  await context.close();
});
