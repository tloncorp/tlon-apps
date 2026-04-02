import { Attachment } from '@tloncorp/shared';
import { expect, test } from 'vitest';

import {
  VIDEO_COMPOSITION_ERROR,
  VIDEO_VALIDATION_ERROR,
  canAddAttachment,
  inferAllowedVideoMimeType,
} from './attachmentRules';

function makeVideo(
  overrides: Partial<Extract<Attachment, { type: 'video' }>> = {}
): Extract<Attachment, { type: 'video' }> {
  return {
    type: 'video',
    localFile: 'file:///tmp/clip.mp4',
    size: 1024,
    mimeType: 'video/mp4',
    name: 'clip.mp4',
    ...overrides,
  };
}

function makeImage(
  overrides: Partial<Extract<Attachment, { type: 'image' }>> = {}
): Extract<Attachment, { type: 'image' }> {
  return {
    type: 'image',
    file: {
      uri: 'file:///tmp/image.jpg',
      width: 100,
      height: 100,
    },
    ...overrides,
  };
}

test('allows one video with optional text', () => {
  expect(canAddAttachment([], makeVideo())).toEqual({ ok: true });
  expect(
    canAddAttachment([makeVideo()], { type: 'text', text: 'caption' })
  ).toEqual({ ok: true });
});

test('rejects video mixed with non-text media', () => {
  expect(canAddAttachment([makeImage()], makeVideo())).toEqual({
    ok: false,
    reason: VIDEO_COMPOSITION_ERROR,
    kind: 'composition',
  });
  expect(canAddAttachment([makeVideo()], makeImage())).toEqual({
    ok: false,
    reason: VIDEO_COMPOSITION_ERROR,
    kind: 'composition',
  });
});

test('rejects unknown-size local video', () => {
  expect(canAddAttachment([], makeVideo({ size: -1 }))).toEqual({
    ok: false,
    reason: VIDEO_VALIDATION_ERROR,
    kind: 'validation',
  });
});

test('rejects unknown-size remote video', () => {
  expect(
    canAddAttachment(
      [],
      makeVideo({
        localFile: 'https://cdn.example.com/clip.mp4',
        size: -1,
        mimeType: undefined,
      })
    )
  ).toEqual({
    ok: false,
    reason: VIDEO_VALIDATION_ERROR,
    kind: 'validation',
  });
});

test('allows fallback to supported extension when MIME type is unsupported', () => {
  expect(canAddAttachment([], makeVideo({ mimeType: 'video/avi' }))).toEqual({
    ok: true,
  });
});

test('rejects unsupported extension when MIME is missing', () => {
  expect(
    canAddAttachment([], makeVideo({ mimeType: undefined, name: 'clip.bin' }))
  ).toEqual({
    ok: false,
    reason: VIDEO_VALIDATION_ERROR,
    kind: 'validation',
  });
});

test('inferAllowedVideoMimeType reuses allowlisted mime when present', () => {
  expect(inferAllowedVideoMimeType({ mimeType: 'video/quicktime' })).toBe(
    'video/quicktime'
  );
});

test('inferAllowedVideoMimeType infers from extension', () => {
  expect(
    inferAllowedVideoMimeType({
      uri: 'https://cdn.example.com/clip.MOV?token=abc',
    })
  ).toBe('video/quicktime');
});
