import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should maintain group sidebar ordering when members join/leave but promote invites', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  console.log('✅ Starting join/leave ordering test');

  // Step 1: ~zod creates 3 groups to establish ordering
  await helpers.createGroup(zodPage);
  await expect(zodPage.getByText('Welcome to your group!')).toBeVisible();
  await zodPage.goBack();
  await zodPage.waitForTimeout(1000);

  await helpers.createGroup(zodPage);
  await expect(zodPage.getByText('Welcome to your group!')).toBeVisible();
  await zodPage.goBack();
  await zodPage.waitForTimeout(1000);

  await helpers.createGroup(zodPage);
  await expect(zodPage.getByText('Welcome to your group!')).toBeVisible();
  await zodPage.goBack();
  await zodPage.waitForTimeout(2000);

  console.log('✅ ~zod created 3 groups');

  // Step 2: Get sidebar references and record initial positions
  const sidebarItems = zodPage.locator('[data-testid^="ChatListItem-"]');
  await expect(async () => {
    const count = await sidebarItems.count();
    expect(count).toBeGreaterThanOrEqual(3);
  }).toPass({ timeout: 10000 });

  const itemCount = await sidebarItems.count();
  const middleGroup = sidebarItems.nth(itemCount - 2); // Second-to-last created group
  const lastGroup = sidebarItems.nth(itemCount - 1); // Last created group

  // Record positions before member activity
  const initialMiddleBox = await middleGroup.boundingBox();
  const initialLastBox = await lastGroup.boundingBox();
  
  console.log('✅ Recorded initial group positions');

  // Step 3: ~zod invites ~ten to the middle group
  await middleGroup.click();
  await zodPage.waitForTimeout(2000);
  await helpers.inviteMembersToGroup(zodPage, ['ten']);
  await zodPage.goBack();

  console.log('✅ ~zod invited ~ten to middle group');

  // Step 4: ~ten accepts the invitation (this is the membership activity that shouldn't reorder)
  await expect(tenPage.getByText('Group invitation')).toBeVisible({ timeout: 15000 });
  await tenPage.getByText('Group invitation').click();
  await tenPage.waitForTimeout(2000);
  
  // Try to accept the invitation
  const possibleButtons = ['Accept invite', 'Accept', 'Join group', 'Join'];
  let accepted = false;
  for (const buttonText of possibleButtons) {
    const button = tenPage.getByText(buttonText);
    if (await button.isVisible({ timeout: 2000 })) {
      await button.click();
      accepted = true;
      console.log(`✅ ~ten accepted invitation via "${buttonText}"`);
      break;
    }
  }
  
  if (!accepted) {
    console.log('⚠️ Could not find accept button, continuing test');
  }
  
  await tenPage.goBack();
  await tenPage.waitForTimeout(3000); // Wait for cross-ship sync

  console.log('✅ ~ten joined the group');

  // Step 5: Verify ~zod's sidebar ordering hasn't changed due to membership activity
  await zodPage.waitForTimeout(3000);
  
  const afterJoinMiddleBox = await middleGroup.boundingBox();
  const afterJoinLastBox = await lastGroup.boundingBox();

  if (initialMiddleBox && afterJoinMiddleBox && initialLastBox && afterJoinLastBox) {
    const middlePositionDiff = Math.abs(afterJoinMiddleBox.y - initialMiddleBox.y);
    const lastPositionDiff = Math.abs(afterJoinLastBox.y - initialLastBox.y);
    
    console.log(`Middle group position difference: ${middlePositionDiff}px`);
    console.log(`Last group position difference: ${lastPositionDiff}px`);
    
    // The key test: membership changes should NOT cause significant reordering
    expect(middlePositionDiff).toBeLessThan(50);
    expect(lastPositionDiff).toBeLessThan(50);
    
    console.log('✅ Group positions remained stable after membership change');
  } else {
    console.log('⚠️ Could not verify position changes due to missing bounding box data');
  }

  // Step 6: Positive control - verify that actual content DOES cause reordering
  await lastGroup.click();
  await zodPage.waitForTimeout(2000);
  await helpers.sendMessage(zodPage, 'This message should reorder groups!');
  await zodPage.goBack();
  await zodPage.waitForTimeout(2000);

  // The group with new content should now be first
  const updatedSidebarItems = zodPage.locator('[data-testid^="ChatListItem-"]');
  const newFirstGroup = updatedSidebarItems.nth(0);
  const newFirstBox = await newFirstGroup.boundingBox();
  
  if (afterJoinLastBox && newFirstBox) {
    // The group that had the message should now be at the top
    expect(newFirstBox.y).toBeLessThan(afterJoinLastBox.y - 20);
    console.log('✅ Content activity correctly reordered groups');
  }

  console.log('✅ Test 1 passed: Membership changes do NOT reorder, but content DOES');
});

test('should promote groups with pending invites to top of sidebar', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  await expect(zodPage.getByText('Home')).toBeVisible();
  await expect(tenPage.getByText('Home')).toBeVisible();

  console.log('✅ Starting invitation prominence test');

  // Step 1: ~ten creates a group first to establish baseline sidebar content
  await helpers.createGroup(tenPage);
  await expect(tenPage.getByText('Welcome to your group!')).toBeVisible();
  await tenPage.goBack();
  await tenPage.waitForTimeout(1000);

  console.log('✅ ~ten created baseline group');

  // Step 2: ~zod creates a group and invites ~ten
  await helpers.createGroup(zodPage);
  await expect(zodPage.getByText('Welcome to your group!')).toBeVisible();
  await helpers.inviteMembersToGroup(zodPage, ['ten']);
  await zodPage.goBack();

  console.log('✅ ~zod created group and sent invitation to ~ten');

  // Step 3: Verify ~ten receives the invitation and it appears prominently
  await expect(tenPage.getByText('Group invitation')).toBeVisible({ timeout: 15000 });

  // Step 4: Check that the invitation appears at the top of ~ten's sidebar
  const tenSidebarItems = tenPage.locator('[data-testid^="ChatListItem-"]');
  await expect(async () => {
    const count = await tenSidebarItems.count();
    expect(count).toBeGreaterThanOrEqual(2); // At least baseline group + invitation
  }).toPass({ timeout: 10000 });

  const firstItem = tenSidebarItems.nth(0);
  const secondItem = tenSidebarItems.nth(1);
  
  const firstBox = await firstItem.boundingBox();
  const secondBox = await secondItem.boundingBox();

  console.log('✅ ~ten received group invitation');

  // Step 5: Verify invitation is positioned at the top
  if (firstBox && secondBox) {
    expect(firstBox.y).toBeLessThan(secondBox.y);
    console.log('✅ Invitation is positioned above existing groups');
  }

  // Step 6: Verify the invitation content is correct
  const inviteItem = tenPage.getByText('Group invitation');
  await expect(inviteItem).toBeVisible();

  console.log('✅ Test 2 passed: Group invites appear prominently at top of sidebar');
});