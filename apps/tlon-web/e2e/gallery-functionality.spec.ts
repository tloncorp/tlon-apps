import { expect, test } from '@playwright/test';

import * as helpers from './helpers';
import shipManifest from './shipManifest.json';

const zodUrl = `${shipManifest['~zod'].webUrl}/apps/groups/`;

test.use({ storageState: shipManifest['~zod'].authFile });

test('should test gallery functionality', async ({ page }) => {
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

  // Create a new gallery channel
  await helpers.openGroupSettings(page);
  await page.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(page, 'Test Gallery', 'gallery');

  // Navigate to the gallery channel
  await page.getByTestId('ChannelListItem-Test Gallery').click();

  // Create a new gallery post
  await helpers.createGalleryPost(page, 'Test Gallery Post Content');

  // Navigate to the post
  await page
    .getByText('Test Gallery Post Content')
    .first()
    .click({ force: true });
  await expect(
    page
      .getByTestId('GalleryPostContent')
      .getByText('Test Gallery Post Content')
  ).toBeVisible();
  await expect(page.getByTestId('MessageInput')).toBeVisible();

  // Add a reply to the post
  await helpers.sendMessage(page, 'This is a reply');

  // Navigate back to the channel
  await helpers.navigateBack(page);

  // Edit the post
  await helpers.longPressMessage(page, 'Test Gallery Post Content');
  await page.getByText('Edit post').click();
  await expect(
    page.locator('iframe').contentFrame().getByRole('paragraph')
  ).toBeVisible();
  await page.locator('iframe').contentFrame().getByRole('paragraph').click();
  await page
    .locator('iframe')
    .contentFrame()
    .locator('div')
    .nth(2)
    .fill('Edited text...');
  await page.getByTestId('BigInputPostButton').click();
  await expect(
    page.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).toBeVisible();

  // Navigate back to the channel
  await expect(
    page.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).toBeVisible();

  // Hide the post
  await helpers.longPressMessage(page, 'Edited text...');
  await page.getByText('Hide post').click();
  await expect(
    page.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).not.toBeVisible();
  await expect(
    page.getByText('You have hidden or reported this post').first()
  ).toBeVisible();

  // Show the post
  await helpers.longPressMessage(page, 'You have hidden or reported this post');
  await page.getByText('Show post').click();
  await expect(
    page.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).toBeVisible();

  // Report the post
  await helpers.longPressMessage(page, 'Edited text...');
  await page.getByText('Report post').click();
  await expect(
    page.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).not.toBeVisible();
  await expect(
    page.getByText('You have hidden or reported this post').first()
  ).toBeVisible();

  // Delete the post
  await helpers.deletePost(page, 'You have hidden or reported this post');
  await expect(
    page.getByText('You have hidden or reported this post').first()
  ).not.toBeVisible();

  // Clean up
  await helpers.cleanupExistingGroup(page);
});
