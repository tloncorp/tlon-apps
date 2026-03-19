import type { ImagePickerAsset } from 'expo-image-picker';
import { expect, test, vi } from 'vitest';
import { getVideoPreviewData } from '../ui/utils/videoPreviewData';
import {
  imagePickerAssetToUploadIntent,
  normalizeUploadIntent,
} from './filepicker';

vi.mock('expo-document-picker', () => ({
  getDocumentAsync: vi.fn(),
}));

vi.mock('../ui/utils/videoPreviewData', () => ({
  getVideoPreviewData: vi.fn(),
}));

vi.mock('./files', () => ({
  getFileSize: vi.fn(() => null),
}));

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

test('infers video upload intent when image picker asset type is missing', () => {
  const uploadIntent = imagePickerAssetToUploadIntent(
    makeAsset({
      fileName: 'clip.MOV',
      fileSize: 4096,
      uri: 'blob:https://example.com/clip.MOV',
      width: 1920,
      height: 1080,
      duration: 2500,
    })
  );

  expect(uploadIntent).toEqual({
    type: 'fileUri',
    localUri: 'blob:https://example.com/clip.MOV',
    name: 'clip.MOV',
    size: 4096,
    mimeType: 'video/quicktime',
    video: {
      width: 1920,
      height: 1080,
      duration: 2.5,
    },
  });
});

test('uses the web File for video upload intents when image picker provides one', () => {
  const file = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' });

  const uploadIntent = imagePickerAssetToUploadIntent(
    makeAsset({
      file,
      fileName: 'clip.mp4',
      fileSize: 4096,
      mimeType: undefined,
      uri: 'data:video/mp4;base64,AAAA',
      width: 1920,
      height: 1080,
      duration: 2500,
    })
  );

  expect(uploadIntent).toEqual({
    type: 'file',
    file,
    video: {
      width: 1920,
      height: 1080,
      duration: 2.5,
    },
  });
});

test('infers image mime type from data uri when image picker asset type is missing', () => {
  const uploadIntent = imagePickerAssetToUploadIntent(
    makeAsset({
      fileName: undefined,
      mimeType: undefined,
      uri: 'data:image/png;base64,AAAA',
    })
  );

  expect(uploadIntent).toMatchObject({
    type: 'image',
    asset: expect.objectContaining({
      mimeType: 'image/png',
      uri: 'data:image/png;base64,AAAA',
    }),
  });
});

test('normalizeUploadIntent keeps data-uri quicktime videos with inferred size', async () => {
  vi.mocked(getVideoPreviewData).mockResolvedValueOnce({});

  const result = await normalizeUploadIntent({
    type: 'fileUri',
    localUri: 'data:video/quicktime;base64,AAAA',
    name: undefined,
    size: -1,
    mimeType: 'video/quicktime',
    video: {
      width: 640,
      height: 360,
    },
  });

  expect(result).toEqual({
    uploadIntent: {
      type: 'fileUri',
      localUri: 'data:video/quicktime;base64,AAAA',
      name: undefined,
      size: 3,
      mimeType: 'video/quicktime',
      video: {
        width: 640,
        height: 360,
        duration: undefined,
        posterUri: undefined,
      },
    },
    errorMessage: null,
  });
});
