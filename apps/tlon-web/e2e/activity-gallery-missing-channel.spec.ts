import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.skip('should handle gallery posts in activity without crashing', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;

  // Verify we're on Home
  await expect(zodPage.getByText('Home')).toBeVisible();

  // Create a group as ~zod
  await helpers.createGroup(zodPage);
  const groupName = '~ten, ~zod';

  // Invite ~ten to the group immediately
  await helpers.inviteMembersToGroup(zodPage, ['ten']);

  // Navigate back to the group using stable testID
  await helpers.navigateBack(zodPage);
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });

  // Create a gallery channel
  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(zodPage, 'Gallery Test', 'gallery');

  // Navigate to the gallery and create a post
  await zodPage.getByTestId('ChannelListItem-Gallery Test').click();
  await helpers.createGalleryPost(zodPage, 'Test gallery post content');

  // Meanwhile, ~ten accepts the group invitation
  await expect(tenPage.getByText('Home')).toBeVisible();
  await helpers.acceptGroupInvite(tenPage, groupName);

  // Create another gallery post to generate activity
  await helpers.createGalleryPost(zodPage, 'Second gallery post for activity');

  // Give time for the activity to propagate
  await tenPage.waitForTimeout(5000);

  // Navigate ~ten to the activity screen
  await tenPage.getByTestId('ActivityNavIcon').click();

  // Verify the activity screen loads without crashing
  await expect(tenPage.getByText('Activity', { exact: true })).toBeVisible({
    timeout: 10000,
  });

  // Verify the activity screen is functional by checking for the tabs
  await expect(tenPage.getByText('All', { exact: true })).toBeVisible();
});
