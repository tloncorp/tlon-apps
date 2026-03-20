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

test('builds a video upload intent from a normalized picker asset', () => {
  const uploadIntent = imagePickerAssetToUploadIntent(
    makeAsset({
      fileName: 'clip.MOV',
      fileSize: 4096,
      mimeType: 'video/quicktime',
      type: 'video',
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

test('uses web File and treats duration as seconds when image picker provides a File object', () => {
  const file = new File(['video-bytes'], 'clip.mp4', { type: 'video/mp4' });

  const uploadIntent = imagePickerAssetToUploadIntent(
    makeAsset({
      file,
      fileName: 'clip.mp4',
      type: 'video',
      uri: 'data:video/mp4;base64,AAAA',
      width: 1920,
      height: 1080,
      // Web: expo provides seconds from HTMLVideoElement.duration, not milliseconds
      duration: 7.0,
    })
  );

  expect(uploadIntent).toEqual({
    type: 'file',
    file,
    video: {
      width: 1920,
      height: 1080,
      duration: 7.0,
    },
  });
});

test('drops non-positive picker video metadata during upload intent conversion', () => {
  const uploadIntent = imagePickerAssetToUploadIntent(
    makeAsset({
      fileName: 'clip.mp4',
      fileSize: 4096,
      mimeType: 'video/mp4',
      type: 'video',
      width: 0,
      height: -5,
      duration: 0,
      uri: 'blob:https://example.com/clip.mp4',
    })
  );

  expect(uploadIntent).toEqual({
    type: 'fileUri',
    localUri: 'blob:https://example.com/clip.mp4',
    name: 'clip.mp4',
    size: 4096,
    mimeType: 'video/mp4',
    video: {
      width: undefined,
      height: undefined,
      duration: undefined,
    },
  });
});

test('normalizeUploadIntent keeps supported quicktime videos with known size', async () => {
  vi.mocked(getVideoPreviewData).mockResolvedValueOnce({});

  const result = await normalizeUploadIntent({
    type: 'fileUri',
    localUri: 'data:video/quicktime;base64,AAAA',
    name: undefined,
    size: 3,
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
