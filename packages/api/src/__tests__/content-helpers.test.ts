import { describe, expect, test } from 'vitest';

import type { FinalizedAttachment } from '../types';
import {
  appendFileUploadToPostBlob,
  appendToPostBlob,
  contentToTextAndMentions,
  parsePostBlob,
  textAndMentionsToContent,
  toPostData,
} from '../client/content-helpers';

describe('contentToTextAndMentions / textAndMentionsToContent round-trip', () => {
  test('mention + link text survives round-trip without corruption', () => {
    const originalText = '~malmur-halmex check this https://example.com cool';
    const originalMentions = [
      {
        id: '~malmur-halmex',
        display: '~malmur-halmex',
        start: 0,
        end: 14,
      },
    ];

    const content = textAndMentionsToContent(originalText, originalMentions);
    const firstPass = contentToTextAndMentions(content);

    expect(firstPass.mentions).toHaveLength(1);
    expect(firstPass.mentions[0].display).toBe('~malmur-halmex');
    expect(firstPass.mentions[0].id).toBe('~malmur-halmex');
    expect(firstPass.mentions[0].start).toBe(0);
    expect(firstPass.mentions[0].end).toBe(14);
    expect(firstPass.text).not.toContain('~~');
    expect(firstPass.text.slice(0, 14)).toBe('~malmur-halmex');

    const content2 = textAndMentionsToContent(firstPass.text, firstPass.mentions);
    const secondPass = contentToTextAndMentions(content2);

    expect(secondPass.text).toBe(firstPass.text);
    expect(secondPass.mentions).toEqual(firstPass.mentions);
  });

  test('mention id without tilde prefix is handled correctly', () => {
    const text = '~zod hello';
    const mentions = [{ id: 'zod', display: '~zod', start: 0, end: 4 }];

    const content = textAndMentionsToContent(text, mentions);
    const result = contentToTextAndMentions(content);

    expect(result.mentions[0].display).toBe('~zod');
    expect(result.text.startsWith('~zod')).toBe(true);
    expect(result.text).not.toContain('~~');
  });

  test('multiple mentions have correct positions', () => {
    const text = '~zod and ~bus hello';
    const mentions = [
      { id: '~zod', display: '~zod', start: 0, end: 4 },
      { id: '~bus', display: '~bus', start: 9, end: 13 },
    ];

    const content = textAndMentionsToContent(text, mentions);
    const result = contentToTextAndMentions(content);

    expect(result.mentions).toHaveLength(2);
    expect(
      result.text.slice(result.mentions[0].start, result.mentions[0].end)
    ).toBe('~zod');
    expect(
      result.text.slice(result.mentions[1].start, result.mentions[1].end)
    ).toBe('~bus');
  });
});

describe('post blob helpers', () => {
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
});
