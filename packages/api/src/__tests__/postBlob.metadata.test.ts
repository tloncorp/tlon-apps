import { describe, expect, test } from 'vitest';

import {
  appendToPostBlob,
  findPostBlobEntry,
  parsePostBlob,
  type PostBlobDataEntryMetadata,
} from '../client/content-helpers';
import { convertContent, uploadedFileUrlsOf } from '../client/postContent';

const metadata = {
  type: 'metadata',
  version: 1,
  data: {
    'tlon.client': { version: 1, platform: 'ios', appVersion: '1.2.3' },
    'example.future': {
      version: 999,
      nested: { values: [true, null, 'opaque context'] },
    },
  },
} satisfies PostBlobDataEntryMetadata;
const story = [{ inline: ['Hello'] }];
const file = {
  type: 'file',
  version: 1,
  fileUri: 'https://example.com/report.pdf',
  size: 42,
} as const;

const unsupportedMetadata = [
  { type: 'metadata', version: 2, data: metadata.data },
  { type: 'metadata', version: '1', data: metadata.data },
  { type: 'metadata', data: metadata.data },
  { type: 'metadata', version: 1 },
  { type: 'metadata', version: 1, data: null },
  { type: 'metadata', version: 1, data: [] },
  { type: 'metadata', version: 1, data: 'invalid' },
  { type: 'metadata', version: 1, data: 42 },
];

describe('post blob metadata', () => {
  test('preserves opaque namespaces and payload versions for opt-in consumers', () => {
    const blob = JSON.stringify([metadata]);
    expect(parsePostBlob(blob)).toEqual([metadata]);
    expect(findPostBlobEntry(blob, 'metadata')).toEqual(metadata);
    expect(JSON.parse(appendToPostBlob(undefined, metadata))).toEqual([
      metadata,
    ]);
  });

  test('leaves payload validation to consumers without affecting siblings', () => {
    const entry = {
      ...metadata,
      data: {
        ...metadata.data,
        'example.unrecognized': null,
        'example.unversioned': 'opaque',
      },
    };
    expect(parsePostBlob(JSON.stringify([entry, file]))).toEqual([entry, file]);
  });

  test('accepts an empty metadata container', () => {
    const entry = { ...metadata, data: {} };
    expect(parsePostBlob(JSON.stringify([entry]))).toEqual([entry]);
  });

  test('does not render metadata alongside story content or attachments', () => {
    const blob = JSON.stringify([metadata, file]);
    expect(convertContent(story, blob)).toEqual(
      convertContent(story, JSON.stringify([file]))
    );
    expect(convertContent(null, JSON.stringify([metadata]))).toEqual([]);
  });

  test.each(unsupportedMetadata)(
    'skips unsupported or malformed metadata without disrupting content: %j',
    (entry) => {
      const blob = JSON.stringify([file, entry, metadata]);
      expect(parsePostBlob(blob)).toEqual([file, metadata]);
      expect(convertContent(story, blob)).toEqual(
        convertContent(story, JSON.stringify([file]))
      );
      expect(convertContent(null, JSON.stringify([entry]))).toEqual([]);
    }
  );

  test('does not suppress upgrade notices for unknown or malformed content', () => {
    const content = [
      { type: 'future-content', version: 1 },
      { ...file, version: 2 },
      { type: 'file', version: 1 },
      null,
    ];
    const blob = JSON.stringify([metadata, ...content]);
    expect(parsePostBlob(blob)).toEqual([
      metadata,
      ...content.map(() => ({ type: 'unknown' })),
    ]);
    expect(convertContent(story, blob)).toEqual(
      convertContent(story, JSON.stringify(content))
    );
    expect(convertContent(story, blob)).toContainEqual({
      type: 'blockquote',
      content: [{ type: 'text', text: 'Upgrade your app to see this post' }],
    });
  });

  test('does not treat metadata payloads as attachments', () => {
    const entry = { ...metadata, data: { 'example.attachment': file } };
    const blob = JSON.stringify([entry]);
    expect(uploadedFileUrlsOf(story, blob)).toEqual([]);
    expect(convertContent(story, blob)).toEqual(convertContent(story, null));
  });
});
