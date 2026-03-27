import { expect } from '@playwright/test';

import * as helpers from './helpers';
import { test } from './test-fixtures';

test('should open and close the gallery image media viewer on web', async ({
  zodSetup,
}) => {
  const page = zodSetup.page;
  const caption = `Media viewer image ${Date.now()}`;
  const isStorageConfigured =
    !!process.env.E2E_S3_ENDPOINT &&
    !!process.env.E2E_S3_ACCESS_KEY_ID &&
    !!process.env.E2E_S3_SECRET_ACCESS_KEY &&
    !!process.env.E2E_S3_BUCKET_NAME;

  test.skip(
    !isStorageConfigured,
    'Requires S3-backed upload config to create an image post in web e2e'
  );

  await expect(page.getByText('Home')).toBeVisible();
  await helpers.createGroup(page);
  await helpers.openGroupSettings(page);
  await page.getByTestId('GroupChannels').getByText('Channels').click();
  await helpers.createChannel(page, 'Media Viewer Gallery', 'gallery');
  await helpers.navigateToChannel(page, 'Media Viewer Gallery');

  await helpers.createGalleryImagePost(page, caption);

  await expect(page.getByTestId('Post').first()).toBeVisible({
    timeout: 10000,
  });
  await page.getByTestId('Post').first().click();

  await expect(page.getByTestId('GalleryPostContent')).toBeVisible({
    timeout: 10000,
  });

  const detailImage = page.getByTestId('GalleryPostContent').locator('img').first();
  await expect(detailImage).toBeVisible();
  await detailImage.click();

  await expect(page.getByTestId('image-viewer')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId('MediaViewerCloseButton')).toBeVisible();

  await page.getByTestId('MediaViewerCloseButton').click();

  await expect(page.getByTestId('image-viewer')).not.toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByTestId('GalleryPostContent')).toBeVisible();
  await expect(page.getByText(caption).first()).toBeVisible();
});
