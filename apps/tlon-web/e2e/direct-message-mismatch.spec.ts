import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test direct message protocol mismatch', async ({ zodPage }) => {
  const page = zodPage;

  await helpers.createDirectMessage(page, '~bus');

  await helpers.sendMessage(page, 'Hello, ~bus!');

  // we need to reload the page to trigger the visible mismatch state
  // TODO: fix this
  await page.reload();

  await expect(page.getByTestId('read-only-notice-dm-mismatch')).toBeVisible();

  // we can't leave the DM when it's in a mismatch state. bug?
  //   await helpers.leaveDM(page, '~bus');
});
