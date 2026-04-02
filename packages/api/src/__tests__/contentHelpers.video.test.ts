import { expect, test } from 'vitest';

import {
  appendVideoToPostBlob,
  parsePostBlob,
  toPostData,
} from '../lib/content-helpers';
import { UploadedVideoAttachment } from '../types/attachment';

test('appendVideoToPostBlob + parsePostBlob round-trips video metadata', () => {
  const blob = appendVideoToPostBlob(undefined, {
    fileUri: 'https://cdn.example.com/video.mp4',
    mimeType: 'video/mp4',
    name: 'clip.mp4',
    size: 12345,
    width: 1920,
    height: 1080,
    duration: 7.2,
    posterUri: 'https://cdn.example.com/video-poster.jpg',
  });

  expect(parsePostBlob(blob)).toEqual([
    {
      type: 'video',
      version: 1,
      fileUri: 'https://cdn.example.com/video.mp4',
      mimeType: 'video/mp4',
      name: 'clip.mp4',
      size: 12345,
      width: 1920,
      height: 1080,
      duration: 7.2,
      posterUri: 'https://cdn.example.com/video-poster.jpg',
    },
  ]);
});

test('parsePostBlob throws when blob is malformed JSON', () => {
  expect(() => parsePostBlob('not-valid-json')).toThrow();
});

test('parsePostBlob returns unknown entry when blob JSON is not an array', () => {
  expect(parsePostBlob('{"type":"video"}')).toEqual([{ type: 'unknown' }]);
});

test('toPostData writes video attachments as typed video blob entries', () => {
  const attachment: UploadedVideoAttachment = {
    type: 'video',
    localFile: 'file:///tmp/movie.mp4',
    name: 'movie.mp4',
    size: 777,
    mimeType: 'video/mp4',
    width: 640,
    height: 360,
    duration: 12.5,
    posterUri: 'file:///tmp/movie-poster.jpg',
    uploadState: {
      status: 'success',
      remoteUri: 'https://cdn.example.com/movie.mp4',
    },
  };

  const out = toPostData({
    content: ['hello'],
    attachments: [attachment],
    channelType: 'chat',
  });

  expect(out.blob).toBeTruthy();
  const parsed = parsePostBlob(out.blob!);
  expect(parsed).toEqual([
    {
      type: 'video',
      version: 1,
      fileUri: 'https://cdn.example.com/movie.mp4',
      mimeType: 'video/mp4',
      name: 'movie.mp4',
      size: 777,
      width: 640,
      height: 360,
      duration: 12.5,
      posterUri: 'file:///tmp/movie-poster.jpg',
    },
  ]);
});
