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

test('ensureFileExtension falls back to .jpg when no content type', () => {
  expect(ensureFileExtension('clip')).toBe('clip.jpg');
});

test('ensureFileExtension honors a custom fallback extension', () => {
  expect(ensureFileExtension('clip', undefined, '.mp4')).toBe('clip.mp4');
});

test('ensureFileExtension prefers content type over fallback extension', () => {
  expect(ensureFileExtension('clip', 'video/webm', '.mp4')).toBe('clip.webm');
});
