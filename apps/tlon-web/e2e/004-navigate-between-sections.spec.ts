import { expect, test } from '@playwright/test';

import shipManifest from './shipManifest.json';

// patbud is the testing ship
const testUrl = `${shipManifest['~habduc-patbud'].webUrl}/apps/groups/`;

// Authenticate as patbud
test.use({ storageState: 'e2e/.auth/habduc-patbud.json' });

test('Render AppNav correctly in different screen sizes', async ({ page }) => {
  await page.goto(testUrl);
  await page.setViewportSize({ width: 1200, height: 800 });
  const desktopNav = page.getByTestId('app-nav');
  await desktopNav.waitFor();
  await expect(desktopNav).toBeVisible();
  const desktopBoundingBox = await desktopNav.boundingBox();
  if (desktopBoundingBox) {
    expect(desktopBoundingBox.x).toBeCloseTo(0);
    expect(desktopBoundingBox.y).toBeCloseTo(0);
  } else {
    throw new Error('Desktop navigation bounding box is null');
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.getByTestId('app-nav');
  await mobileNav.waitFor();
  await expect(mobileNav).toBeVisible();
  const mobileBoundingBox = await mobileNav.boundingBox();
  if (mobileBoundingBox) {
    expect(mobileBoundingBox.x).toBeCloseTo(0);
    expect(mobileBoundingBox.y).toBeCloseTo(790);
  } else {
    throw new Error('Mobile navigation bounding box is null');
  }
});

test.describe('Tab navigation tests', () => {
  const tabMenuPairs = [
    { tab: 'groups-tab', menu: 'groups-menu' },
    { tab: 'messages-tab', menu: 'messages-menu' },
    { tab: 'notifications-tab', menu: 'notifications-screen' },
    { tab: 'profile-tab', menu: 'profile-menu' },
  ];

  tabMenuPairs.forEach((pair) => {
    test(`${pair.tab} navigation`, async ({ page }) => {
      await page.goto(testUrl);
      await page.setViewportSize({ width: 1200, height: 800 });
      const tab = page.getByTestId(pair.tab);
      await tab.waitFor();
      await tab.click();
      const menu = page.getByTestId(pair.menu);
      await menu.waitFor();
      await expect(menu).toBeVisible();
    });
  });
});
