import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test gallery functionality', async ({ zodSetup, tenSetup }) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Clean up any existing group on zod
  await helpers.cleanupExistingGroup(zodPage, 'Test Group');
  await helpers.cleanupExistingGroup(zodPage, '~ten, ~zod');
  await helpers.cleanupExistingGroup(zodPage);

  // Create a new group
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(zodPage);

  if (await zodPage.getByText('Home').isVisible()) {
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
    await zodPage.getByText(groupName).first().click();
    await expect(zodPage.getByText(groupName).first()).toBeVisible();
  }

  // Create a new gallery channel
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(zodPage, 'Test Gallery', 'gallery');

  // Navigate to the gallery channel
  await zodPage.getByTestId('ChannelListItem-Test Gallery').click();

  // Create a new gallery post
  await helpers.createGalleryPost(zodPage, 'Test Gallery Post Content');

  // Navigate to the post
  await zodPage
    .getByText('Test Gallery Post Content')
    .first()
    .click({ force: true });
  await zodPage.waitForTimeout(2000);
  await expect(
    zodPage
      .getByTestId('GalleryPostContent')
      .getByText('Test Gallery Post Content')
  ).toBeVisible();
  await expect(zodPage.getByTestId('MessageInput')).toBeVisible();

  // Add a reply to the post
  await helpers.sendMessage(zodPage, 'This is a reply');

  // Navigate back to the channel
  await helpers.navigateBack(zodPage);

  // Edit the post
  await helpers.longPressMessage(zodPage, 'Test Gallery Post Content');
  await zodPage.getByText('Edit post').click();
  await expect(
    zodPage.locator('iframe').contentFrame().getByRole('paragraph')
  ).toBeVisible();
  await zodPage.locator('iframe').contentFrame().getByRole('paragraph').click();
  await zodPage
    .locator('iframe')
    .contentFrame()
    .locator('div')
    .nth(2)
    .fill('Edited text...');
  await zodPage.getByTestId('BigInputPostButton').click();
  await expect(
    zodPage.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).toBeVisible();

  // Navigate back to the channel
  await expect(
    zodPage.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).toBeVisible();

  // Navigate to the group as ~ten
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Wait for the group invitation and accept it
  await tenPage.waitForTimeout(3000);
  await expect(tenPage.getByText('Group invitation')).toBeVisible();
  await tenPage.getByText('Group invitation').click();

  // Accept the invitation
  if (await tenPage.getByText('Accept invite').isVisible()) {
    await tenPage.getByText('Accept invite').click();
  }

  // Wait for joining process and go to group
  await tenPage.waitForSelector('text=Joining, please wait...');
  await tenPage.waitForSelector('text=Go to group', { state: 'visible' });

  if (await tenPage.getByText('Go to group').isVisible()) {
    await tenPage.getByText('Go to group').click();
  } else {
    await tenPage.getByText(groupName).first().click();
  }

  await expect(tenPage.getByText(groupName).first()).toBeVisible();

  // Navigate to the gallery channel
  await tenPage.getByTestId('ChannelListItem-Test Gallery').click();

  // Hide the post as ~ten
  await helpers.longPressMessage(tenPage, 'Edited text...');
  await tenPage.getByText('Hide post').click();
  await expect(
    tenPage.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).not.toBeVisible();
  await expect(
    tenPage.getByText('You have hidden or reported this post').first()
  ).toBeVisible();

  // Show the post as ~ten
  await helpers.longPressMessage(
    tenPage,
    'You have hidden or reported this post'
  );
  await tenPage.getByText('Show post').click();
  await expect(
    tenPage.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).toBeVisible();

  // Report the post as ~zod
  await helpers.longPressMessage(zodPage, 'Edited text...');
  await zodPage.getByText('Report post').click();
  await expect(
    zodPage.getByTestId('GalleryPostContentPreview').getByText('Edited text...')
  ).not.toBeVisible();
  await expect(
    zodPage.getByText('You have hidden or reported this post').first()
  ).toBeVisible();

  // Delete the post
  await helpers.deletePost(zodPage, 'You have hidden or reported this post');
  await expect(
    zodPage.getByText('You have hidden or reported this post').first()
  ).not.toBeVisible();

  // Clean up
  await helpers.cleanupExistingGroup(zodPage);
});
