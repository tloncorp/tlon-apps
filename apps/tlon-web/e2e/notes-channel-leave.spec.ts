import { Page, expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

const notebookTitle = 'Leave Test Notebook';

async function confirmLeaveChannel(page: Page) {
  const dialog = page.getByRole('dialog');
  await expect(
    dialog.getByText('You will no longer receive updates from this channel.')
  ).toBeVisible({ timeout: 5000 });
  await dialog.getByText('Leave', { exact: true }).click();
}

type InitGroups = Record<
  string,
  {
    channels?: Record<string, { meta?: { title?: string } }>;
    'active-channels'?: string[];
  }
>;

// Whether the ship's %groups lists the notebook in its group's active-channels,
// which %notes reports into on join and leave. null when no group has it.
async function notebookIsActiveOnShip(page: Page) {
  return page.evaluate(async (title) => {
    const response = await fetch('/~/scry/groups-ui/v10/init.json', {
      credentials: 'include',
    });
    const { groups = {} } = (await response.json()) as { groups?: InitGroups };
    for (const group of Object.values(groups)) {
      for (const [nest, channel] of Object.entries(group.channels ?? {})) {
        if (channel.meta?.title === title) {
          return (group['active-channels'] ?? []).includes(nest);
        }
      }
    }
    return null;
  }, notebookTitle);
}

async function expectNotebookJoined(page: Page) {
  const row = page.getByTestId(`ChannelListItem-${notebookTitle}`);
  await expect(row).toBeVisible({ timeout: 15000 });
  await expect(row.getByText('Join')).not.toBeVisible({ timeout: 15000 });
  await expect
    .poll(() => notebookIsActiveOnShip(page), { timeout: 15000 })
    .toBe(true);
}

async function expectNotebookUnjoined(page: Page) {
  await expect(
    page.getByTestId(`ChannelListItem-${notebookTitle}`).getByText('Join')
  ).toBeVisible({ timeout: 15000 });
  await expect
    .poll(() => notebookIsActiveOnShip(page), { timeout: 15000 })
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

  await expect(tenPage.getByText('Home')).toBeVisible();
  await helpers.acceptGroupInvite(tenPage, groupName);
  await expectNotebookJoined(tenPage);

  // Both the channel options sheet (right-click is web's long press) and the
  // channel info screen offer Leave; they share the same confirm-and-leave path.
  await tenPage
    .getByTestId(`ChannelListItem-${notebookTitle}`)
    .click({ button: 'right' });
  await expect(
    tenPage.getByTestId('ActionSheetAction-Leave channel')
  ).toBeVisible({ timeout: 5000 });
  await tenPage
    .getByTestId('ActionSheetAction-Channel info & settings')
    .click();
  await expect(tenPage.getByText('Channel info')).toBeVisible({
    timeout: 5000,
  });
  await tenPage.getByTestId('ChannelLeaveAction-Leave channel').click();
  await confirmLeaveChannel(tenPage);
  await expectNotebookUnjoined(tenPage);
});
