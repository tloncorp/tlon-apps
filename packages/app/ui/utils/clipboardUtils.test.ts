import { afterEach, beforeEach, expect, test, vi } from 'vitest';

import { createImageAssetFromClipboardData } from './clipboardUtils';

const fileSystemMocks = vi.hoisted(() => ({
  directoryCreate: vi.fn(),
  fileWrite: vi.fn(),
  fileInfo: vi.fn(),
  cacheDirectory: {
    uri: 'file:///cache/',
  },
}));

const imageMocks = vi.hoisted(() => ({
  imageSize: vi.fn(),
}));

vi.mock('expo-file-system', () => ({
  Paths: {
    cache: fileSystemMocks.cacheDirectory,
  },
  Directory: class MockDirectory {
    uri: string;

    constructor(parent: { uri: string } | string, path: string) {
      const parentUri = typeof parent === 'string' ? parent : parent.uri;
      this.uri = `${parentUri}${path}/`;
    }

    create = fileSystemMocks.directoryCreate;
  },
  File: class MockFile {
    uri: string;

    constructor(directory: { uri: string }, name: string) {
      this.uri = `${directory.uri}${name}`;
    }

    write = fileSystemMocks.fileWrite;
    info = fileSystemMocks.fileInfo;
  },
}));
vi.mock('../../utils/images', () => imageMocks);
vi.mock('expo-clipboard', () => ({}));
vi.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
  },
}));

beforeEach(() => {
  fileSystemMocks.directoryCreate.mockReset();
  fileSystemMocks.fileWrite.mockReset();
  fileSystemMocks.fileInfo.mockReset();
  fileSystemMocks.fileInfo.mockReturnValue({ size: 3 });
  imageMocks.imageSize.mockReset();
  imageMocks.imageSize.mockResolvedValue([640, 480]);
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

  expect(fileSystemMocks.directoryCreate).toHaveBeenCalledWith({
    intermediates: true,
    idempotent: true,
  });
  expect(fileSystemMocks.fileWrite).toHaveBeenCalledWith('AAAA', {
    encoding: 'base64',
  });
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

  expect(fileSystemMocks.fileWrite).toHaveBeenCalledWith('AAAA', {
    encoding: 'base64',
  });
  expect(asset).toMatchObject({
    uri: 'file:///cache/clipboard-images/clipboard-123.jpg',
    fileName: 'clipboard-image.jpg',
    mimeType: 'image/jpeg',
  });
});
