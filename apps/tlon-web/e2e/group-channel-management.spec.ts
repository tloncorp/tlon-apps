import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should handle channel management operations', async ({ zodPage }) => {
  const page = zodPage;

  await expect(page.getByText('Home')).toBeVisible();

  // Create a new group
  await helpers.createGroup(page);

  // Handle welcome message if present
  if (await page.getByText('Untitled group').first().isVisible()) {
    await expect(page.getByText('Welcome to your group!')).toBeVisible();
  }

  // Navigate back to Home and verify group creation
  await helpers.navigateBack(page);
  if (await page.getByText('Home').isVisible()) {
    await expect(page.getByText('Untitled group').first()).toBeVisible();
    await page.getByText('Untitled group').first().click();
    await expect(page.getByText('Untitled group').first()).toBeVisible();
  }

  // Open group settings
  await helpers.openGroupSettings(page);
  await expect(page.getByText('Group info')).toBeVisible();

  // Test channel management
  await page.getByTestId('GroupChannels').getByText('Channels').click();
  await expect(
    page.getByTestId('ScreenHeaderTitle').first().getByText('Channels')
  ).toBeVisible();
  await expect(
    page
      .locator('div')
      .filter({ hasText: /^GeneralChat$/ })
      .first()
  ).toBeVisible();

  // Create new channel
  await helpers.createChannel(page, 'Second chat channel');

  await helpers.navigateBack(page);
  await page.waitForTimeout(500);
  await helpers.verifyElementCount(page, 'GroupChannels', 2);

  // Test channel reordering
  await page.getByTestId('GroupChannels').click();

  // Wait for both channels to be visible
  await expect(page.getByTestId('ChannelItem-General-0')).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByTestId('ChannelItem-Second chat channel-1')
  ).toBeVisible({ timeout: 10000 });

  // Enter sort/edit mode
  await page.getByText('Sort', { exact: true }).click();
  await page.waitForTimeout(500);

  // Drag "General" (at position 0) below "Second chat channel" (at position 1)
  // Use manual mouse operations on the drag handle for @dnd-kit compatibility
  const generalDragHandle = page.getByTestId('ChannelDragHandle-General-0');
  const secondDragHandle = page.getByTestId(
    'ChannelDragHandle-Second chat channel-1'
  );

  const generalHandleBox = await generalDragHandle.boundingBox();
  const secondHandleBox = await secondDragHandle.boundingBox();

  if (generalHandleBox && secondHandleBox) {
    // Start drag from center of General's drag handle
    const startX = generalHandleBox.x + generalHandleBox.width / 2;
    const startY = generalHandleBox.y + generalHandleBox.height / 2;

    // End drag below Second chat channel's drag handle
    const endX = secondHandleBox.x + secondHandleBox.width / 2;
    const endY = secondHandleBox.y + secondHandleBox.height + 20;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.move(endX, endY, { steps: 15 });
    await page.waitForTimeout(150);
    await page.mouse.up();
  }

  await page.waitForTimeout(1000);

  // Wait for the reorder to take effect
  await expect(
    page.getByTestId('ChannelItem-Second chat channel-0')
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('ChannelItem-General-1')).toBeVisible({
    timeout: 10000,
  });

  // Drag back to original order - drag Second chat channel down below General
  const secondDragHandleNew = page.getByTestId(
    'ChannelDragHandle-Second chat channel-0'
  );
  const generalDragHandleNew = page.getByTestId('ChannelDragHandle-General-1');

  const secondNewBox = await secondDragHandleNew.boundingBox();
  const generalNewBox = await generalDragHandleNew.boundingBox();

  if (secondNewBox && generalNewBox) {
    // Start drag from center of Second chat channel's drag handle (now at position 0)
    const startX = secondNewBox.x + secondNewBox.width / 2;
    const startY = secondNewBox.y + secondNewBox.height / 2;

    // End drag below General's drag handle (now at position 1)
    const endX = generalNewBox.x + generalNewBox.width / 2;
    const endY = generalNewBox.y + generalNewBox.height + 20;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.move(endX, endY, { steps: 15 });
    await page.waitForTimeout(150);
    await page.mouse.up();
  }

  await page.waitForTimeout(1000);

  // Verify back to original order
  await expect(page.getByTestId('ChannelItem-General-0')).toBeVisible({
    timeout: 10000,
  });
  await expect(
    page.getByTestId('ChannelItem-Second chat channel-1')
  ).toBeVisible({ timeout: 10000 });

  // Exit sort/edit mode
  await page.getByText('Done', { exact: true }).click();

  // Channel settings
  await helpers.editChannel(
    page,
    'Second chat channel',
    'Testing channel renaming',
    'Testing channel description'
  );

  // editChannel saves and returns to Channels screen
  // Wait for save to complete and verify the renamed channel appears
  await page.waitForTimeout(1000);
  await expect(
    page.getByTestId('ChannelItem-Testing channel renaming-1')
  ).toBeVisible({ timeout: 10000 });

  // Create channel section
  await helpers.createChannelSection(page, 'Testing section');

  // Test section reordering
  // Enter sort mode
  await page.getByText('Sort', { exact: true }).click();
  await page.waitForTimeout(500);

  // Verify both sections visible with correct indices
  // "Sectionless" is the default section name
  await expect(page.getByTestId('SectionDragHandle-Sectionless-0')).toBeVisible(
    { timeout: 10000 }
  );
  await expect(
    page.getByTestId('SectionDragHandle-Testing section-1')
  ).toBeVisible({ timeout: 10000 });

  // Drag "Testing section" above "Sectionless"
  const testingSectionHandle = page.getByTestId(
    'SectionDragHandle-Testing section-1'
  );
  const sectionlessHandle = page.getByTestId('SectionDragHandle-Sectionless-0');

  const testingBox = await testingSectionHandle.boundingBox();
  const sectionlessBox = await sectionlessHandle.boundingBox();

  if (testingBox && sectionlessBox) {
    const startX = testingBox.x + testingBox.width / 2;
    const startY = testingBox.y + testingBox.height / 2;
    const endX = sectionlessBox.x + sectionlessBox.width / 2;
    const endY = sectionlessBox.y - 20; // Drop above Sectionless

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(150);
    await page.mouse.move(endX, endY, { steps: 15 });
    await page.waitForTimeout(150);
    await page.mouse.up();
  }

  await page.waitForTimeout(1000);

  // Verify sections reordered
  await expect(
    page.getByTestId('SectionDragHandle-Testing section-0')
  ).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId('SectionDragHandle-Sectionless-1')).toBeVisible(
    { timeout: 10000 }
  );

  // Exit sort mode
  await page.getByText('Done', { exact: true }).click();

  // Test section name editing
  // After reordering, "Testing section" is at position 0
  await page
    .getByTestId('NavSection-Testing section')
    .getByTestId('SectionMenuButton')
    .click();
  await expect(page.getByText('Edit name')).toBeVisible({ timeout: 5000 });
  await page.getByText('Edit name').click();

  // Wait for the edit sheet to open
  await expect(page.getByText('Change section name')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.getByTestId('SectionNameInput')).toBeVisible();

  // Clear the input and enter new name
  await page.getByTestId('SectionNameInput').fill('Renamed section');
  await page.getByText('Save', { exact: true }).click();

  // Verify section was renamed
  await page.waitForTimeout(500);
  await expect(page.getByTestId('NavSection-Renamed section')).toBeVisible({
    timeout: 5000,
  });
  await expect(
    page.getByTestId('NavSection-Testing section')
  ).not.toBeVisible();

  // Test section deletion
  // Open the section menu for "Renamed section"
  await page
    .getByTestId('NavSection-Renamed section')
    .getByTestId('SectionMenuButton')
    .click();
  await expect(page.getByText('Delete section')).toBeVisible({ timeout: 5000 });
  await page.getByText('Delete section').click();

  // Verify section was deleted
  await page.waitForTimeout(500);
  await expect(
    page.getByTestId('NavSection-Renamed section')
  ).not.toBeVisible();
  // "Sectionless" should still exist
  await expect(page.getByTestId('NavSection-Sectionless')).toBeVisible();

  await helpers.navigateBack(page);

  // Test notification settings (moved here as it's part of channel settings)
  await helpers.setGroupNotifications(page, 'All activity');
  await helpers.navigateBack(page, 1);
  await expect(
    page.getByTestId('GroupNotifications').getByText('All activity')
  ).toBeVisible();

  // Navigate back to verify multi-channel navigation
  // this is mobile only
  // await page.getByTestId('HeaderBackButton').first().click();
  // await expect(page.getByText('General')).toBeVisible();
  // await page.getByTestId('HeaderBackButton').first().click();
  // await expect(page.getByText('Home')).toBeVisible();

  // await page.getByText('Untitled group').click();
  // await expect(page.getByText('Untitled group')).toBeVisible();
  // await expect(page.getByText('General')).toBeVisible();
  // await expect(
  //   page.getByText('Testing channel renaming').first()
  // ).toBeVisible();

  // await page.getByText('General').click();
  // await page.getByTestId('ChannelHeaderOverflowMenuButton').click();
  // await page.getByText('Group info & settings').click();

  // Delete channel and verify count update
  await page.waitForTimeout(2000);
  await page.getByTestId('GroupChannels').click();

  // After renaming, the channel should preserve its position at index 1
  // Verify the channel is still at position 1 before deleting
  await expect(
    page.getByTestId('ChannelItem-Testing channel renaming-1')
  ).toBeVisible({ timeout: 5000 });

  await helpers.deleteChannel(page, 'Testing channel renaming', 1);

  // Verify we're still on the Channels screen and the channel was deleted
  await expect(
    page.getByTestId('ScreenHeaderTitle').first().getByText('Channels')
  ).toBeVisible();
  await expect(
    page.getByTestId('ChannelItem-Testing channel renaming-1')
  ).not.toBeVisible();

  // Navigate back (goes to main group view) and open group settings to verify channel count
  await helpers.navigateBack(page);
  await helpers.openGroupSettings(page);
  await helpers.verifyElementCount(page, 'GroupChannels', 1);
});
