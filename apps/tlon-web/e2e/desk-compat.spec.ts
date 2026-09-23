import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

// The startup probe reads the %groups version out of the docket charge, so
// rewriting that one response is enough to make a healthy ship look outdated.
const CHARGES_SCRY = /\/~\/scry\/docket\/charges\.json/;
const INIT_SCRY = /\/~\/scry\/groups-ui\/v10\/init\.json/;
const OUTDATED_VERSION = '0.0.1';

test('blocks startup when the ship reports an outdated %groups desk', async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: shipManifest['~zod'].authFile,
  });
  await context.addInitScript(() => {
    (globalThis as any).TLON_IS_E2E = true;
  });
  const page = await context.newPage();

  const initRequests: string[] = [];
  page.on('request', (request) => {
    if (INIT_SCRY.test(request.url())) {
      initRequests.push(request.url());
    }
  });

  // Installed before the first navigation: the probe runs at the very start of
  // sync, so a route added afterwards would be too late.
  await page.route(CHARGES_SCRY, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        initial: { groups: { version: OUTDATED_VERSION } },
      }),
    })
  );

  try {
    await page.goto(zodUrl);

    await expect(page.getByTestId('desk-outdated-screen')).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByTestId('desk-outdated-current')).toHaveText(
      OUTDATED_VERSION
    );
    // Asserted as a shape rather than a literal so bumping the minimum doesn't
    // drag this test along with it.
    await expect(page.getByTestId('desk-outdated-minimum')).toHaveText(
      /^\d+\.\d+\.\d+$/
    );

    // The whole point of the gate: nothing that an old desk would reject.
    expect(initRequests).toHaveLength(0);

    // Now let the ship report its real version, as an update would.
    await page.unroute(CHARGES_SCRY);
    await page.getByTestId('desk-outdated-retry').click();

    // Recovers in place, with no reload.
    await expect(page.getByText('Home')).toBeVisible({ timeout: 30000 });
    await expect(page.getByTestId('desk-outdated-screen')).toHaveCount(0);
    expect(initRequests.length).toBeGreaterThan(0);
  } finally {
    await context.close();
  }
});
