import type { ImagePickerAsset } from 'expo-image-picker';
import { expect, test } from 'vitest';

import { normalizeImagePickerAssetForUpload } from './imagePickerAsset.web';

function makeAsset(
  overrides: Partial<ImagePickerAsset> = {}
): ImagePickerAsset {
  return {
    assetId: null,
    base64: null,
    duration: null,
    exif: null,
    fileName: 'image.jpg',
    fileSize: 1024,
    height: 100,
    mimeType: null,
    type: undefined,
    uri: 'file:///tmp/image.jpg',
    width: 100,
    ...overrides,
  } as ImagePickerAsset;
}

test('infers missing video fields for web-picked mov assets', () => {
  const normalizedAsset = normalizeImagePickerAssetForUpload(
    makeAsset({
      fileName: 'clip.MOV',
      fileSize: undefined,
      mimeType: undefined,
      type: undefined,
      uri: 'data:video/quicktime;base64,AAAA',
    })
  );

  expect(normalizedAsset).toMatchObject({
    fileName: 'clip.MOV',
    fileSize: 3,
    mimeType: 'video/quicktime',
    type: 'video',
  });
});

test('normalizes web File metadata onto the picked asset', () => {
  const file = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' });

  const normalizedAsset = normalizeImagePickerAssetForUpload(
    makeAsset({
      file,
      fileName: undefined,
      fileSize: undefined,
      mimeType: undefined,
      type: undefined,
      uri: 'data:video/mp4;base64,AAAA',
    })
  );

  expect(normalizedAsset).toMatchObject({
    fileName: 'clip.mp4',
    fileSize: file.size,
    mimeType: 'video/mp4',
    type: 'video',
  });
  expect(normalizedAsset.file).toBeInstanceOf(File);
  expect((normalizedAsset.file as File).name).toBe('clip.mp4');
  expect((normalizedAsset.file as File).type).toBe('video/mp4');
});

test('infers image mime type from a data uri', () => {
  const normalizedAsset = normalizeImagePickerAssetForUpload(
    makeAsset({
      fileName: undefined,
      mimeType: undefined,
      type: undefined,
      uri: 'data:image/png;base64,AAAA',
    })
  );

  expect(normalizedAsset).toMatchObject({
    mimeType: 'image/png',
    type: 'image',
  });
});
