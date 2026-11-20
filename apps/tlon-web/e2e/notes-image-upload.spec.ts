import { expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should add an image to a note by dropping it on the body', async ({
  zodSetup,
}) => {
  const page = zodSetup.page;
  const isStorageConfigured =
    !!process.env.E2E_S3_ENDPOINT &&
    !!process.env.E2E_S3_ACCESS_KEY_ID &&
    !!process.env.E2E_S3_SECRET_ACCESS_KEY &&
    !!process.env.E2E_S3_BUCKET_NAME;

  test.skip(
    !isStorageConfigured,
    'Requires S3-backed upload config to upload a note image in web e2e'
  );

  await expect(page.getByText('Home')).toBeVisible();
  await helpers.createGroup(page);
  await helpers.openGroupSettings(page);
  await page.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(page, 'Image Notes', 'notes');
  await helpers.navigateToChannel(page, 'Image Notes');

  await page.getByTestId('NotesRootNewHeaderAction').click();
  await page.getByText('New note', { exact: true }).last().click();
  const body = page.getByTestId('NotesBodyInput');
  await expect(body).toBeVisible({ timeout: 10000 });
  await body.fill('Before the image.');

  const image = fs
    .readFileSync(path.join(__dirname, 'assets', 'test-group-icon.jpg'))
    .toString('base64');
  const dataTransfer = await page.evaluateHandle((base64) => {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([bytes], 'test-group-icon.jpg', { type: 'image/jpeg' })
    );
    return transfer;
  }, image);
  await body.dispatchEvent('drop', { dataTransfer });

  await expect(body).toHaveValue(
    /^Before the image\.\n\n!\[\]\(https?:\/\/\S+\)$/,
    { timeout: 30000 }
  );

  await page.getByTestId('NotesPreviewToggle').click();
  await expect(
    page.getByTestId('NotesPreviewContent').locator('img')
  ).toBeVisible({ timeout: 15000 });
});
