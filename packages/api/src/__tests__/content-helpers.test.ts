import { expect, test } from 'vitest';

import type { FinalizedAttachment } from '../types';
import {
  appendFileUploadToPostBlob,
  appendToPostBlob,
  parsePostBlob,
  toPostData,
} from '../lib/content-helpers';

test('parsePostBlob parses registered blob entry types', () => {
  const blob = appendToPostBlob(
    appendFileUploadToPostBlob(undefined, {
      fileUri: 'https://files.example/report.pdf',
      mimeType: 'application/pdf',
      name: 'report.pdf',
      size: 2048,
    }),
    {
      type: 'voicememo',
      version: 1,
      fileUri: 'https://files.example/memo.m4a',
      size: 1024,
      duration: 12,
      waveformPreview: [0, 0.25, 1],
    }
  );

  expect(parsePostBlob(blob)).toEqual([
    {
      type: 'file',
      version: 1,
      fileUri: 'https://files.example/report.pdf',
      mimeType: 'application/pdf',
      name: 'report.pdf',
      size: 2048,
    },
    {
      type: 'voicememo',
      version: 1,
      fileUri: 'https://files.example/memo.m4a',
      size: 1024,
      duration: 12,
      waveformPreview: [0, 0.25, 1],
    },
  ]);
});

test('parsePostBlob degrades gracefully for malformed or invalid payloads', () => {
  expect(parsePostBlob('not json')).toEqual([{ type: 'unknown' }]);
  expect(
    parsePostBlob(
      JSON.stringify([
        {
          type: 'voicememo',
          version: 1,
          fileUri: 'https://files.example/memo.m4a',
          size: 1024,
          waveformPreview: [1.5],
        },
      ])
    )
  ).toEqual([{ type: 'unknown' }]);
});

test('appendToPostBlob preserves unknown existing entries and validates new ones', () => {
  const blob = appendFileUploadToPostBlob(
    JSON.stringify([{ type: 'future', version: 1, value: 'kept' }]),
    {
      fileUri: 'https://files.example/report.pdf',
      size: 2048,
    }
  );

  expect(JSON.parse(blob)).toEqual([
    { type: 'future', version: 1, value: 'kept' },
    {
      type: 'file',
      version: 1,
      fileUri: 'https://files.example/report.pdf',
      size: 2048,
    },
  ]);

  expect(() =>
    appendToPostBlob(undefined, {
      type: 'file',
      version: 1,
      fileUri: '',
      size: -1,
    } as any)
  ).toThrow('Invalid PostBlobDataEntry');
});

test('toPostData uses attachment mimeType when serializing file blobs', () => {
  const attachment: FinalizedAttachment = {
    type: 'file',
    localFile: '/tmp/report.pdf',
    name: 'report.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    uploadState: {
      status: 'success',
      remoteUri: 'https://files.example/report.pdf',
    },
  };

  const result = toPostData({
    attachments: [attachment],
    content: [],
    channelType: 'chat',
  });

  expect(parsePostBlob(result.blob!)).toEqual([
    {
      type: 'file',
      version: 1,
      fileUri: 'https://files.example/report.pdf',
      mimeType: 'application/pdf',
      name: 'report.pdf',
      size: 2048,
    },
  ]);
});
