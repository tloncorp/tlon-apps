import { expect, test } from 'vitest';

import type { FinalizedAttachment } from '../types';
import {
  appendActionButtonToPostBlob,
  appendFileUploadToPostBlob,
  appendToPostBlob,
  parsePostBlob,
  toPostData,
} from '../lib/content-helpers';

test('parsePostBlob parses file blob entries', () => {
  const blob = appendFileUploadToPostBlob(undefined, {
    fileUri: 'https://files.example/report.pdf',
    mimeType: 'application/pdf',
    name: 'report.pdf',
    size: 2048,
  });

  expect(parsePostBlob(blob)).toEqual([
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

test('parsePostBlob parses voicememo blob entries', () => {
  const blob = appendToPostBlob(undefined, {
    type: 'voicememo',
    version: 1,
    fileUri: 'https://files.example/memo.m4a',
    size: 1024,
    duration: 12,
    waveformPreview: [0, 0.25, 1],
  });

  expect(parsePostBlob(blob)).toEqual([
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

test('parsePostBlob parses action-button blob entries', () => {
  const blob = appendActionButtonToPostBlob(undefined, {
    label: 'Approve',
    pokeApp: 'permissions',
    pokeMark: 'json',
    pokeJson: { allow: true, requestId: 'req-123' },
  });

  expect(parsePostBlob(blob)).toEqual([
    {
      type: 'action-button',
      version: 1,
      label: 'Approve',
      pokeApp: 'permissions',
      pokeMark: 'json',
      pokeJson: { allow: true, requestId: 'req-123' },
    },
  ]);
});

test('appendActionButtonToPostBlob creates and appends action-button entries', () => {
  const blob = appendActionButtonToPostBlob(
    appendActionButtonToPostBlob(undefined, {
      label: 'Approve',
      pokeApp: 'permissions',
      pokeMark: 'json',
      pokeJson: { allow: true, requestId: 'req-123' },
    }),
    {
      label: 'Deny',
      pokeApp: 'permissions',
      pokeMark: 'json',
      pokeJson: { allow: false, requestId: 'req-123' },
    }
  );

  expect(parsePostBlob(blob)).toEqual([
    {
      type: 'action-button',
      version: 1,
      label: 'Approve',
      pokeApp: 'permissions',
      pokeMark: 'json',
      pokeJson: { allow: true, requestId: 'req-123' },
    },
    {
      type: 'action-button',
      version: 1,
      label: 'Deny',
      pokeApp: 'permissions',
      pokeMark: 'json',
      pokeJson: { allow: false, requestId: 'req-123' },
    },
  ]);
});

test('appendActionButtonToPostBlob validates action-button entries', () => {
  expect(() =>
    appendActionButtonToPostBlob(undefined, {
      label: '',
      pokeApp: 'permissions',
      pokeMark: 'json',
      pokeJson: { allow: true },
    })
  ).toThrow('Invalid PostBlobDataEntry');
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
