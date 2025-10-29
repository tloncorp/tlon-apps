import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.only('should request to join a group', async ({ zodPage, busPage }) => {
  await helpers.createGroup(zodPage);
  await helpers.navigateBack(zodPage);
  if (await zodPage.getByText('Home').isVisible()) {
    await expect(zodPage.getByText('Untitled group')).toBeVisible();
    await zodPage.getByText('Untitled group').click();
    await expect(zodPage.getByText('Untitled group').first()).toBeVisible();
  }

  await helpers.openGroupCustomization(zodPage);
  await helpers.changeGroupName(zodPage, 'Private Group');

  await helpers.openGroupSettings(zodPage);
  await zodPage.getByText('Copy group ID').click();

  const groupId: string = await zodPage.evaluate(
    'navigator.clipboard.readText()'
  );
  expect(groupId).toBeDefined();

  await helpers.joinGroup(busPage, groupId);
});
