import { expect, test } from 'vitest';

import { Attachment } from '../types/attachment';

test('video finalization preserves local poster during upload', () => {
  const uploadIntent: Attachment.UploadIntent = {
    type: 'fileUri',
    localUri: 'file:///tmp/video.mp4',
    size: 42,
    mimeType: 'video/mp4',
    video: {
      width: 1920,
      height: 1080,
      duration: 7.5,
      posterUri: 'file:///tmp/video-poster.jpg',
    },
  };

  const finalized = Attachment.UploadIntent.toFinalizedAttachment(
    uploadIntent,
    {
      status: 'uploading',
      localUri: 'file:///tmp/video.mp4',
    }
  );

  expect(finalized).toMatchObject({
    type: 'video',
    posterUri: 'file:///tmp/video-poster.jpg',
    uploadState: {
      status: 'uploading',
      localUri: 'file:///tmp/video.mp4',
    },
  });
});

test('video finalization prefers uploaded poster URI when available', () => {
  const uploadIntent: Attachment.UploadIntent = {
    type: 'fileUri',
    localUri: 'file:///tmp/video.mp4',
    size: 42,
    mimeType: 'video/mp4',
    video: {
      posterUri: 'file:///tmp/video-poster.jpg',
    },
  };

  const finalized = Attachment.UploadIntent.toFinalizedAttachment(
    uploadIntent,
    {
      status: 'success',
      remoteUri: 'https://cdn.example.com/video.mp4',
      posterUri: 'https://cdn.example.com/video-poster.jpg',
    }
  );

  expect(finalized).toMatchObject({
    type: 'video',
    posterUri: 'https://cdn.example.com/video-poster.jpg',
    uploadState: {
      status: 'success',
      remoteUri: 'https://cdn.example.com/video.mp4',
      posterUri: 'https://cdn.example.com/video-poster.jpg',
    },
  });
});

test('video finalization drops local-only poster URI when upload succeeds without poster upload', () => {
  const uploadIntent: Attachment.UploadIntent = {
    type: 'fileUri',
    localUri: 'file:///tmp/video.mp4',
    size: 42,
    mimeType: 'video/mp4',
    video: {
      posterUri: 'file:///tmp/video-poster.jpg',
    },
  };

  const finalized = Attachment.UploadIntent.toFinalizedAttachment(
    uploadIntent,
    {
      status: 'success',
      remoteUri: 'https://cdn.example.com/video.mp4',
    }
  );

  expect(finalized).toMatchObject({
    type: 'video',
    uploadState: {
      status: 'success',
      remoteUri: 'https://cdn.example.com/video.mp4',
    },
  });
  expect(
    (finalized as { posterUri?: string } | null)?.posterUri
  ).toBeUndefined();
});
