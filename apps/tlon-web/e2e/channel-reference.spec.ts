import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test.describe('Channel Reference', () => {
  test.setTimeout(120000);

  test('forwards a channel reference to a DM, renders a card, and opens the channel on tap', async ({
    zodSetup,
    tenSetup,
  }) => {
    const zodPage = zodSetup.page;
    const tenPage = tenSetup.page;

    // Step 1: Create DM between ~zod and ~ten
    await helpers.createDirectMessage(zodPage, '~ten');
    await helpers.sendMessage(
      zodPage,
      'Setting up DM for channel reference test'
    );
    await zodPage.getByTestId('HomeNavIcon').click();

    // Step 2: ~ten accepts the DM
    await tenPage.reload();
    await tenPage.getByTestId('HomeNavIcon').click();
    await expect(tenPage.getByText('Home')).toBeVisible({ timeout: 10000 });
    await tenPage.getByTestId('ChannelListItem-~zod').click();
    await tenPage.getByText('Accept').click();
    await expect(tenPage.getByText('Accept')).not.toBeVisible({
      timeout: 10000,
    });
    await tenPage.getByTestId('HomeNavIcon').click();

    // Step 3: Create a public multi-channel group (lands in General) and open
    // channel details. New groups default to secret, and the host refuses
    // channel previews to non-members of a secret group, so ~ten could never
    // load the card.
    await helpers.createGroup(zodPage);
    await helpers.openGroupSettings(zodPage);
    await helpers.setGroupPrivacy(zodPage, 'public');
    await helpers.setupMultiChannelGroup(zodPage);
    await zodPage
      .getByTestId('ChannelHeaderTitle')
      .getByTestId('ScreenHeaderTitle')
      .click();
    await expect(zodPage.getByText('Channel info')).toBeVisible({
      timeout: 5000,
    });
    await expect(
      zodPage.getByTestId('ChannelQuickAction-Copy link to channel')
    ).toBeVisible({ timeout: 5000 });

    // Step 4: Forward the channel reference to the DM with ~ten
    await zodPage.getByTestId('ChannelQuickAction-Forward reference').click();
    await expect(zodPage.getByText('Forward channel')).toBeVisible({
      timeout: 5000,
    });
    await zodPage.getByPlaceholder('Search channels').fill('~ten');
    await expect(zodPage.getByTestId('ChannelListItem-~ten')).toBeVisible({
      timeout: 5000,
    });
    await zodPage.getByTestId('ChannelListItem-~ten').click();
    await zodPage.getByText('Forward to ~ten').click();
    await expect(zodPage.getByText('Forwarded')).toBeVisible({ timeout: 5000 });

    // Step 5: ~ten (not a group member) sees the loaded channel card, not the
    // upgrade fallback
    await tenPage.getByTestId('ChannelListItem-~zod').click();
    const tenCard = tenPage.getByTestId('ChannelLinkReference');
    await expect(tenCard.getByText('General', { exact: true })).toBeVisible({
      timeout: 15000,
    });
    await expect(tenCard.getByText('Channel', { exact: true })).toBeVisible();
    await expect(
      tenPage.getByText('Upgrade your app to see this reference')
    ).not.toBeVisible();

    // Step 5b: tapping the card as a non-member opens the group preview
    // Use force click to bypass opacity animation on reference frame
    await tenCard.click({ force: true });
    await expect(tenPage.getByTestId('ActionButton-Join group')).toBeVisible({
      timeout: 10000,
    });
    await tenPage.keyboard.press('Escape');
    await expect(
      tenPage.getByTestId('ActionButton-Join group')
    ).not.toBeVisible({ timeout: 5000 });

    // Step 6: ~zod (a member) taps the card in the DM and lands in General
    await zodPage.getByTestId('HomeNavIcon').click();
    await zodPage.getByTestId('ChannelListItem-~ten').click();
    const zodCard = zodPage.getByTestId('ChannelLinkReference');
    await expect(zodCard).toBeVisible({ timeout: 10000 });
    await expect(zodCard.getByText('General', { exact: true })).toBeVisible({
      timeout: 10000,
    });
    // Use force click to bypass opacity animation on reference frame
    await zodCard.click({ force: true });
    // The web stack keeps the DM screen mounted underneath, so match only the
    // visible channel screen
    await expect(
      zodPage
        .getByTestId('ChannelHeaderTitle')
        .getByTestId('ScreenHeaderTitle')
        .filter({ visible: true })
    ).toHaveText('General', { timeout: 10000 });
    await expect(
      zodPage.getByTestId('MessageInput').filter({ visible: true })
    ).toBeVisible({
      timeout: 5000,
    });
  });
});
