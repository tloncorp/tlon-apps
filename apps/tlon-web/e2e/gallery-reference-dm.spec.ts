import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

// This test verifies that content references from public groups work correctly for non-members.
// Uses gallery as a representative case, but the fix applies to all channel types (chat, gallery, notebook).
// When a non-member clicks a content reference from a public group, they should see the group preview sheet.
test('Content reference in DM - non-member clicking should open group preview', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Assert that we're on the Home page
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Step 1: Create DM between ~zod and ~ten first (before group)
  await helpers.createDirectMessage(zodPage, '~ten');
  await expect(zodPage.getByTestId('ChannelListItem-~ten')).toBeVisible({
    timeout: 10000,
  });

  // Send initial message to establish DM
  await helpers.sendMessage(zodPage, 'Hey, check out this gallery post');

  // Navigate to Home
  await zodPage.getByTestId('HomeNavIcon').click();

  // Step 2: Accept the DM on ~ten's side
  await tenPage.reload();
  await tenPage.getByTestId('HomeNavIcon').click();
  await expect(tenPage.getByText('Home')).toBeVisible({ timeout: 10000 });
  await tenPage.getByTestId('ChannelListItem-~zod').click();
  await tenPage.getByText('Accept').click();
  await expect(tenPage.getByText('Accept')).not.toBeVisible({ timeout: 10000 });
  await tenPage.getByTestId('HomeNavIcon').click();

  // Step 3: Create a group with gallery channel (do NOT invite ~ten)
  await helpers.createGroup(zodPage);

  // Step 3b: Make the group PUBLIC so non-members can see content previews
  await helpers.openGroupSettings(zodPage);
  await helpers.setGroupPrivacy(zodPage, 'public');
  // Navigate back to group settings main screen
  await helpers.navigateBack(zodPage);

  // Step 4: Create gallery channel
  await zodPage.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(zodPage, 'Test Gallery', 'gallery');
  await zodPage.getByTestId('ChannelListItem-Test Gallery').click();

  // Step 5: Create a gallery post
  const galleryContent = 'Gallery post for reference test';
  await helpers.createGalleryPost(zodPage, galleryContent);
  await expect(
    zodPage.getByTestId('GalleryPostContentPreview').getByText(galleryContent)
  ).toBeVisible({ timeout: 10000 });

  // Step 6: Forward gallery post to DM with ~ten
  await helpers.forwardMessageToDM(zodPage, galleryContent, '~ten');

  // Verify toast
  await expect(zodPage.getByText('Forwarded post to ~ten')).toBeVisible({
    timeout: 10000,
  });

  // Step 7: Navigate to DM and verify reference appears
  // The visibility check below serves as a deterministic wait for cross-ship sync
  await zodPage.getByTestId('HomeNavIcon').click();
  await zodPage.getByTestId('ChannelListItem-~ten').click();

  // Verify "Gallery Post" reference header is visible (use exact match)
  // This also serves as a deterministic wait for sync instead of waitForTimeout
  await expect(
    zodPage.getByText('Gallery Post', { exact: true })
  ).toBeVisible({ timeout: 15000 });

  // Step 8: ~ten navigates to DM and sees the gallery reference
  await tenPage.getByTestId('ChannelListItem-~zod').click();
  await expect(
    tenPage.getByText('Gallery Post', { exact: true })
  ).toBeVisible({ timeout: 10000 });

  // Wait for the reference to finish loading (the content appears after the header)
  // The gallery post content should contain our test text
  await expect(tenPage.getByText(galleryContent)).toBeVisible({ timeout: 15000 });

  // Step 9: ~ten clicks the content reference (THE KEY TEST)
  // ~ten is NOT a member of the group, so clicking should open GroupPreviewSheet
  // This works for any content type (chat, gallery, notebook) - we use gallery as representative case
  const galleryRef = tenPage.getByText('Gallery Post', { exact: true });
  await galleryRef.click({ force: true });

  // Step 10: Verify GroupPreviewSheet opens
  // The sheet shows group info with "Join group" button for public groups
  // Note: Quick groups show the host ship name (~zod) as the title, not "Untitled group"
  await expect(tenPage.getByText('Join group')).toBeVisible({ timeout: 10000 });

  // Also verify we see the public group indicator
  await expect(tenPage.getByText('Public Group')).toBeVisible({ timeout: 5000 });

  // Close the sheet by clicking outside or pressing escape
  await tenPage.keyboard.press('Escape');

  // Cleanup: Delete the group
  await zodPage.getByTestId('HomeNavIcon').click();
  // Quick groups show as "~zod" in the sidebar, not "Untitled group"
  await expect(zodPage.getByText('Test Gallery')).toBeVisible({ timeout: 10000 });
  await zodPage.getByText('Test Gallery').first().click();
  // Navigate to group from channel
  await zodPage.getByTestId('ChannelHeaderTitle').click();
  await helpers.deleteGroup(zodPage);
});
