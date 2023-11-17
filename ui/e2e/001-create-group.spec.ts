import { test, expect } from '@playwright/test';

test('Create a group', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'Create Group' }).waitFor();
  await page.getByRole('link', { name: 'Create Group' }).click();
  await page.getByPlaceholder('e.g. Urbit Fan Club').click();
  await page.getByPlaceholder('e.g. Urbit Fan Club').fill('Bus Club');
  await page.locator('textarea[name="description"]').click();
  await page.locator('textarea[name="description"]').fill('Get in.');
  await page.getByRole('button', { name: 'Next: Privacy' }).click();
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Create Group' }).click();
  await page.getByRole('heading', { name: 'or drag a Channel here' }).waitFor();
});

test('Create a chat channel', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'B Bus Club' }).waitFor();
  await page.getByRole('link', { name: 'B Bus Club' }).click();
  await page.getByRole('heading', { name: 'or drag a Channel here' }).waitFor();
  await page.getByRole('link', { name: 'New Channel' }).nth(1).click();
  await page
    .locator('label')
    .filter({ hasText: 'ChatA simple, standard text chat' })
    .click();
  await page.getByLabel('Channel Name*').click();
  await page.getByLabel('Channel Name*').fill('bus chat');
  await page.getByLabel('Channel Description').click();
  await page.getByLabel('Channel Description').fill('the bus is coming');
  await page.getByRole('button', { name: 'Add Channel' }).click();
  await page.getByRole('link', { name: 'bus chat' }).waitFor();
  await page.getByRole('link', { name: 'bus chat' }).click();
  await page.getByLabel('Send message').waitFor();
  await page.locator('.ProseMirror').click();
  await page.locator('.ProseMirror').fill("hi, it's me, ~bus");
  // first enter is for the mention
  await page.locator('.ProseMirror').press('Enter');
  await page.locator('.ProseMirror').press('Enter');
  await expect(page.getByText("hi, it's me, ~bus")).toBeVisible();
});

test('Create a notebook channel and post to it.', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'B Bus Club' }).waitFor();
  await page.getByRole('link', { name: 'B Bus Club' }).click();
  await page.getByRole('link', { name: 'All Channels' }).click();
  await page.getByRole('link', { name: 'New Channel' }).click();
  await page
    .locator('label')
    .filter({ hasText: 'NotebookLongform publishing and discussion' })
    .click();
  await page.getByLabel('Channel Name*').click();
  await page.getByLabel('Channel Name*').fill('bus notes');
  await page.getByLabel('Channel Description').click();
  await page.getByLabel('Channel Description').fill('news from the bus');
  await page.getByRole('button', { name: 'Add Channel' }).click();
  await page.getByRole('link', { name: 'bus notes' }).waitFor();
  await page.getByRole('link', { name: 'bus notes' }).click();
  await page.getByRole('link', { name: 'Add Note' }).waitFor();
  await page.getByRole('link', { name: 'Add Note' }).click();
  await page.getByPlaceholder('New Title').click();
  await page.getByPlaceholder('New Title').fill('A bus note');
  await page.getByRole('paragraph').click();
  await page.locator('.ProseMirror').fill('With some bus content.');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(
    page.getByRole('link').filter({ hasText: 'A bus note' })
  ).toBeVisible();
});

test('Invite to a group', async ({ page }) => {
  test.skip(process.env.SHIP === '~zod', 'skip on ~zod');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page.getByRole('link', { name: 'B Bus Club' }).waitFor();
  await page.getByRole('link', { name: 'B Bus Club' }).click();
  await page.getByRole('link', { name: 'Invite People' }).waitFor();
  await page.getByRole('link', { name: 'Invite People' }).click();
  await page.getByLabel('Ships').click({ force: true });
  await page.getByRole('combobox', { name: 'Ships' }).fill('~zod');
  await page.getByText('zod', { exact: true }).click();
  await page.getByRole('button', { name: 'Send Invites' }).click();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.getByRole('button', { name: 'B Bus Club' }).click();
  await page.getByRole('menuitem', { name: 'Group Settings' }).click();
  await page.getByRole('link', { name: 'Members' }).click();
  await page
    .getByRole('region', { name: 'Members' })
    .getByText('zod')
    .waitFor();
});

test('accept group invite', async ({ page }) => {
  test.skip(process.env.SHIP === '~bus', 'skip on ~bus');
  test.skip(process.env.APP === 'chat', 'skip on talk');
  await page.goto('');
  await page
    .getByTestId('group-invite')
    .filter({ hasText: 'Bus Club' })
    .waitFor();
  const groupInvite = page
    .getByTestId('group-invite')
    .filter({ hasText: 'Bus Club' });
  await groupInvite.getByRole('button', { name: 'Accept' }).first().click();
  await page.getByText('Join This Group').waitFor();
  await page.getByRole('button', { name: 'Join Group' }).first().click();
  await page.getByText('bus chat').first().waitFor();
  await page.getByText('bus chat').first().click();
  await page.getByText("hi, it's me, ~bus").waitFor();
});
