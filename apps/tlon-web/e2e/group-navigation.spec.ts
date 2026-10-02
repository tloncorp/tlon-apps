import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('returning to a group preserves the last selected channel instead of reopening a notebook', async ({
  zodPage,
}) => {
  const page = zodPage;

  await helpers.createGroup(page);
  await helpers.openGroupSettings(page);
  await page.getByTestId('GroupChannels').getByText('Channels').click();

  await page.getByText('New', { exact: true }).click();
  await page.getByText('New channel').first().click();
  await helpers.fillFormField(page, 'ChannelTitleInput', 'Project Notebook');
  await page.getByText('Notebook', { exact: true }).click();
  await page.getByText('Create channel').click();

  const notebook = page.getByTestId('ChannelListItem-Project Notebook');
  await expect(notebook).toBeVisible({ timeout: 15_000 });
  await notebook.click();
  await expect(page.getByTestId('NotebookSidebarBackHeader')).toBeVisible({
    timeout: 10_000,
  });

  await page
    .getByTestId('NotebookSidebarBackHeader')
    .getByTestId('HeaderBackButton')
    .click();
  await expect(page.getByTestId('ChannelListItem-General')).toBeVisible();

  await page.getByTestId('ChannelListItem-General').click();
  await expect(page.getByTestId('MessageInput')).toBeVisible({
    timeout: 10_000,
  });

  await page.getByTestId('HomeNavIcon').click();
  await expect(page.getByTestId('HomeSidebarHeader')).toBeVisible();
  await page.getByTestId('GroupListItem-Untitled group-unpinned').click();

  await expect(page.getByTestId('MessageInput')).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByTestId('NotebookSidebarBackHeader')).not.toBeVisible();
});
