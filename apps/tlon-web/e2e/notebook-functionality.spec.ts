import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test notebook functionality', async ({ page }) => {
  await page.goto(zodUrl);
  await helpers.clickThroughWelcome(page);
  await page.evaluate(() => {
    window.toggleDevTools();
  });

  // Assert that we're on the Home page
  await expect(page.getByText('Home')).toBeVisible();

  // Clean up any existing group on zod
  await helpers.cleanupExistingGroup(page, 'Test Group');
  await helpers.cleanupExistingGroup(page, '~ten, ~zod');
  await helpers.cleanupExistingGroup(page);

  // Create a new group
  await helpers.createGroup(page);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);

  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group')).toBeVisible();
    await page.getByText('Untitled group').click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Create a new notebook channel
  await helpers.openGroupSettings(page);
  await page.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(page, 'Test Notebook', 'notebook');

  // navigate to the notebook channel
  await page
    .getByTestId('ChannelListItem-Test Notebook')
    .getByText('Test Notebook')
    .click();

  // create a new notebook post
  await helpers.createNotebookPost(page, 'New notebook post', 'Some text...');

  // verify the notebook post is created
  await expect(page.getByText('New notebook post')).toBeVisible();

  // navigate to the post
  await page.getByText('New notebook post').click();
  await expect(page.getByText('No replies yet')).toBeVisible();
  await expect(
    page.getByTestId('NotebookPostContent').getByText('Some text...')
  ).toBeVisible();
  await expect(page.getByTestId('MessageInput')).toBeVisible();

  // Add a reply to the post
  await helpers.sendMessage(page, 'This is a reply');

  // Edit the post
  await page.getByTestId('ChannelHeaderEditButton').click();
  await expect(
    page.getByRole('textbox', {
      name: 'New Title',
    })
  ).toBeVisible();
  await page.getByRole('textbox', { name: 'New Title' }).fill('Edited title');
  await page.locator('iframe').contentFrame().getByRole('paragraph').click();
  await page
    .locator('iframe')
    .contentFrame()
    .locator('div')
    .nth(2)
    .fill('Edited text...');
  await page.getByTestId('BigInputPostButton').click();
  await expect(
    page.getByTestId('NotebookPostHeaderDetailView').getByText('Edited title')
  ).toBeVisible();
  await expect(
    page.getByTestId('NotebookPostContent').getByText('Edited text...')
  ).toBeVisible();

  // Navigate back to the channel
  await helpers.navigateBack(page);

  // Hide the post
  await helpers.longPressMessage(page, 'Edited text...');
  await page.getByText('Hide post').click();
  await expect(page.getByText('Edited title')).not.toBeVisible();
  await expect(
    page.getByText('You have hidden or reported this post').first()
  ).toBeVisible();

  // Show the post
  await helpers.longPressMessage(page, 'You have hidden or reported this post');
  await page.getByText('Show post').click();
  await expect(page.getByText('Edited title')).toBeVisible();
  await expect(
    page.getByTestId('NotebookPostContentSummary').getByText('Edited text...')
  ).toBeVisible();

  // Report the post
  await helpers.longPressMessage(page, 'Edited text...');
  await page.getByText('Report post').click();
  await expect(page.getByText('Edited title')).not.toBeVisible();
  await expect(
    page.getByText('You have hidden or reported this post').first()
  ).toBeVisible();

  // clean up
  await helpers.cleanupExistingGroup(page);
});
