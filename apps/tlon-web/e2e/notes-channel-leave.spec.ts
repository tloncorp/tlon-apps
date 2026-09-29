import { Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

const notebookTitle = 'Leave Test Notebook';
const notMemberGate = "You're not in this notebook";

type InitGroups = Record<
  string,
  {
    channels?: Record<string, { meta?: { title?: string } }>;
    'active-channels'?: string[];
  }
>;

// Whether the ship's %groups lists the notebook in the group's active-channels,
// which %notes reports into on join and leave. null when the group or
// notebook isn't there.
async function notebookIsActiveOnShip(page: Page, groupId: string) {
  return page.evaluate(
    async ([flag, title]) => {
      const response = await fetch('/~/scry/groups-ui/v10/init.json', {
        credentials: 'include',
      });
      const { groups = {} } = (await response.json()) as {
        groups?: InitGroups;
      };
      const group = groups[flag];
      const nest = Object.entries(group?.channels ?? {}).find(
        ([, channel]) => channel.meta?.title === title
      )?.[0];
      if (!group || !nest) {
        return null;
      }
      return (group['active-channels'] ?? []).includes(nest);
    },
    [groupId, notebookTitle] as const
  );
}

function notebookRow(page: Page) {
  return page.getByTestId(`ChannelListItem-${notebookTitle}`);
}

// Joining lands the notebook's snapshot, which fills in the row's subtitle and
// settles its place in the list; wait for that before pointing at the row.
async function expectNotebookJoined(page: Page, groupId: string) {
  await expect(notebookRow(page).getByText('No notes')).toBeVisible({
    timeout: 15000,
  });
  await expect(
    notebookRow(page).getByText('Join', { exact: true })
  ).not.toBeVisible();
  await expect
    .poll(() => notebookIsActiveOnShip(page, groupId), { timeout: 15000 })
    .toBe(true);
}

async function expectNotebookUnjoined(page: Page, groupId: string) {
  await expect(
    notebookRow(page).getByText('Join', { exact: true })
  ).toBeVisible({ timeout: 15000 });
  await expect
    .poll(() => notebookIsActiveOnShip(page, groupId), { timeout: 15000 })
    .toBe(false);
}

test('a member who does not host a notebook can leave it', async ({
  zodSetup,
  tenSetup,
}) => {
  const zodPage = zodSetup.page;
  const tenPage = tenSetup.page;
  const groupName = '~ten, ~zod';

  await expect(zodPage.getByText('Home')).toBeVisible();

  await helpers.createGroup(zodPage);
  await helpers.inviteMembersToGroup(zodPage, ['ten']);
  await helpers.navigateBack(zodPage);
  await helpers.navigateToGroupByTestId(zodPage, {
    expectedDisplayName: groupName,
  });

  await helpers.openGroupSettings(zodPage);
  await zodPage.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(zodPage, notebookTitle, 'notes');
  const groupId = helpers.groupIdFromUrl(zodPage);

  await expect(tenPage.getByText('Home')).toBeVisible();
  await helpers.acceptGroupInvite(tenPage, groupName);
  await expectNotebookJoined(tenPage, groupId);

  // Open the notebook, then bring the sidebar back to the channel list with
  // the notebook still showing beside it.
  await notebookRow(tenPage).click();
  const notebookSidebar = tenPage.getByTestId('NotebookSidebarBackHeader');
  await expect(notebookSidebar).toBeVisible({ timeout: 15000 });
  await notebookSidebar.getByTestId('HeaderBackButton').click();

  // Leave from the channel options sheet (right-click is web's long press).
  // The open notebook must show that it's been left, not rejoin itself.
  await notebookRow(tenPage).click({ button: 'right' });
  await tenPage.getByTestId('ActionSheetAction-Leave channel').click();
  await helpers.confirmLeaveChannel(tenPage);
  await expectNotebookUnjoined(tenPage, groupId);
  await expect(tenPage.getByText(notMemberGate)).toBeVisible({
    timeout: 10000,
  });

  // Rejoining from the channel list restores the open notebook
  await notebookRow(tenPage).click();
  await expectNotebookJoined(tenPage, groupId);
  await expect(tenPage.getByText('Select a note')).toBeVisible({
    timeout: 15000,
  });

  // Leave from the channel info screen
  await notebookRow(tenPage).click({ button: 'right' });
  await tenPage
    .getByTestId('ActionSheetAction-Channel info & settings')
    .click();
  await expect(tenPage.getByText('Channel info', { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await tenPage.getByTestId('ChannelLeaveAction-Leave channel').click();
  await helpers.confirmLeaveChannel(tenPage);
  await expectNotebookUnjoined(tenPage, groupId);

  // The host still can't leave their own notebook
  await expectNotebookJoined(zodPage, groupId);
  await notebookRow(zodPage).click({ button: 'right' });
  await expect(zodPage.getByText('Cannot leave channel')).toBeVisible({
    timeout: 5000,
  });
  await expect(
    zodPage.getByTestId('ActionSheetAction-Leave channel')
  ).not.toBeVisible();
  await zodPage
    .getByTestId('ActionSheetAction-Channel info & settings')
    .click();
  await expect(
    zodPage.getByTestId('ChannelLeaveAction-Delete channel')
  ).toBeVisible({ timeout: 5000 });
  await expect(
    zodPage.getByTestId('ChannelLeaveAction-Leave channel')
  ).not.toBeVisible();
});
