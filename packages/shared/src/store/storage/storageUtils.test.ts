import { expect, test } from 'vitest';

import { ensureFileExtension, getExtensionFromMimeType } from './storageUtils';

test('getExtensionFromMimeType supports quicktime videos', () => {
  expect(getExtensionFromMimeType('video/quicktime')).toBe('.mov');
});

test('ensureFileExtension preserves quicktime extension', () => {
  expect(ensureFileExtension('clip.mov', 'video/quicktime')).toBe('clip.mov');
});

test('ensureFileExtension appends quicktime extension when missing', () => {
  expect(ensureFileExtension('clip', 'video/quicktime')).toBe('clip.mov');
});
