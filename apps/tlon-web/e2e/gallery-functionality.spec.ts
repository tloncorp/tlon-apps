import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should test gallery functionality', async ({ zodSetup, tenSetup }) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(zodPage);
  // Note: Group name will update to '~ten, ~zod' after ~ten accepts the invitation (line 144)
  // For now, it remains 'Untitled group'
  let groupName = 'Untitled group';

  // Invite ~ten to the group
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to Home and navigate to group using stable testID
  await helpers.navigateBack(zodPage);
  groupName = '~ten, ~zod';
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });

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

  // Test editing from detail view header button
  const editButton = zodPage.getByTestId('ChannelHeaderEditButton');
  await expect(editButton).toBeVisible();
  await expect(editButton).toBeAttached();
  await editButton.click();

  // Wait for the Gallery editor to be ready - it should use DraftInputView with iframe
  await expect(zodPage.locator('iframe')).toBeVisible({ timeout: 10000 });

  // Wait for iframe content to be ready
  const iframe = zodPage.locator('iframe');
  await iframe.waitFor({ state: 'attached' });
  const contentFrame = iframe.contentFrame();
  if (!contentFrame) {
    throw new Error('Gallery editor iframe content frame not available');
  }

  // Wait for editor to be initialized
  await expect(contentFrame.getByRole('paragraph')).toBeVisible({
    timeout: 5000,
  });

  // Click in the editor area to focus and edit content
  await contentFrame.getByRole('paragraph').click();

  // Clear existing content and add new content
  const editorParagraph = contentFrame.getByRole('paragraph');
  await expect(editorParagraph).toBeVisible({ timeout: 3000 });

  const editedContentFromDetailView = 'Edited from detail view';
  await editorParagraph.fill(editedContentFromDetailView);

  // Ensure session is stable before saving
  await helpers.waitForSessionStability(zodPage);

  // Save the edit
  await zodPage.getByTestId('BigInputPostButton').click();

  // Wait for the edit to be processed
  await zodPage.waitForTimeout(1500);

  // Verify the edited content appears in the detail view
  await expect(
    zodPage
      .getByTestId('GalleryPostContent')
      .getByText(editedContentFromDetailView)
  ).toBeVisible({ timeout: 10000 });

  // Navigate back to the channel
  await helpers.navigateBack(zodPage);

  // Wait a bit longer for the content to sync and be visible in the gallery grid view
  await zodPage.waitForTimeout(2000);

  // Verify the edited content is visible in the gallery grid view
  await expect(
    zodPage
      .getByTestId('GalleryPostContentPreview')
      .getByText(editedContentFromDetailView)
  ).toBeVisible({ timeout: 10000 });

  // Test editing via long-press menu (using the content that was edited from detail view)
  await helpers.longPressMessage(zodPage, editedContentFromDetailView);
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
    .fill('Edited via long-press');
  await zodPage.getByTestId('BigInputPostButton').click();
  await expect(
    zodPage
      .getByTestId('GalleryPostContentPreview')
      .getByText('Edited via long-press')
  ).toBeVisible();

  // Navigate back to the channel
  await expect(
    zodPage
      .getByTestId('GalleryPostContentPreview')
      .getByText('Edited via long-press')
  ).toBeVisible();

  // Navigate to the group as ~ten
  await expect(tenPage.getByText('Home')).toBeVisible();

  // Accept the group invitation
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Navigate to the gallery channel
  await tenPage.getByTestId('ChannelListItem-Test Gallery').click();

  // Hide the post as ~ten
  await helpers.longPressMessage(tenPage, 'Edited via long-press');
  await tenPage.getByText('Hide post').click();
  await expect(
    tenPage
      .getByTestId('GalleryPostContentPreview')
      .getByText('Edited via long-press')
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
    tenPage
      .getByTestId('GalleryPostContentPreview')
      .getByText('Edited via long-press')
  ).toBeVisible();

  // Report the post as ~zod
  await helpers.longPressMessage(zodPage, 'Edited via long-press');
  await zodPage.getByText('Report post').click();
  await expect(
    zodPage
      .getByTestId('GalleryPostContentPreview')
      .getByText('Edited via long-press')
  ).not.toBeVisible();
  await expect(
    zodPage.getByText('You have hidden or reported this post').first()
  ).toBeVisible();

  // Delete the post
  await helpers.deletePost(zodPage, 'You have hidden or reported this post');
  await expect(
    zodPage.getByText('You have hidden or reported this post').first()
  ).not.toBeVisible();
});
