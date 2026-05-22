import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createImageAssetFromClipboardData } from './clipboardUtils';

const fileSystemMocks = vi.hoisted(() => ({
  EncodingType: {
    Base64: 'base64',
  },
  cacheDirectory: 'file:///cache/',
  makeDirectoryAsync: vi.fn(),
  writeAsStringAsync: vi.fn(),
}));

const imageMocks = vi.hoisted(() => ({
  imageSize: vi.fn(),
}));

const fileMocks = vi.hoisted(() => ({
  getFileSize: vi.fn(),
}));

vi.mock('expo-file-system/legacy', () => fileSystemMocks);
vi.mock('../../utils/images', () => imageMocks);
vi.mock('../../utils/files', () => fileMocks);
vi.mock('expo-clipboard', () => ({}));
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

beforeEach(() => {
  fileSystemMocks.makeDirectoryAsync.mockReset();
  fileSystemMocks.writeAsStringAsync.mockReset();
  imageMocks.imageSize.mockReset();
  imageMocks.imageSize.mockResolvedValue([640, 480]);
  fileMocks.getFileSize.mockReset();
  fileMocks.getFileSize.mockReturnValue(3);
  vi.spyOn(Date, 'now').mockReturnValue(123);
});

afterEach(() => {
  vi.restoreAllMocks();
});

test('writes base64 clipboard images to a cache file', async () => {
  const asset = await createImageAssetFromClipboardData({
    data: 'AAAA',
    mimeType: 'image/png',
  });

  expect(fileSystemMocks.makeDirectoryAsync).toHaveBeenCalledWith(
    'file:///cache/clipboard-images/',
    { intermediates: true }
  );
  expect(fileSystemMocks.writeAsStringAsync).toHaveBeenCalledWith(
    'file:///cache/clipboard-images/clipboard-123.png',
    'AAAA',
    { encoding: 'base64' }
  );
  expect(imageMocks.imageSize).toHaveBeenCalledWith(
    'file:///cache/clipboard-images/clipboard-123.png'
  );
  expect(asset).toMatchObject({
    assetId: 'clipboard-123',
    uri: 'file:///cache/clipboard-images/clipboard-123.png',
    width: 640,
    height: 480,
    fileName: 'clipboard-image.png',
    fileSize: 3,
    mimeType: 'image/png',
    type: 'image',
  });
});

test('uses the mime type embedded in data uris', async () => {
  const asset = await createImageAssetFromClipboardData({
    data: 'data:image/jpeg;base64,AAAA',
    mimeType: 'image/png',
  });

  expect(fileSystemMocks.writeAsStringAsync).toHaveBeenCalledWith(
    'file:///cache/clipboard-images/clipboard-123.jpg',
    'AAAA',
    { encoding: 'base64' }
  );
  expect(asset).toMatchObject({
    uri: 'file:///cache/clipboard-images/clipboard-123.jpg',
    fileName: 'clipboard-image.jpg',
    mimeType: 'image/jpeg',
  });
});
