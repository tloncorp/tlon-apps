import { convertContent } from '@tloncorp/api/client/postContent';
import { afterEach, expect, test } from 'vitest';

import {
  appendPostClientMetadata,
  setPostClientMetadata,
} from './clientMetadata';

afterEach(() => setPostClientMetadata(undefined));

test('the stamp preserves existing attachments and opaque metadata without rendering', () => {
  const file = {
    type: 'file',
    version: 1,
    fileUri: 'https://example.com/file.pdf',
    size: 42,
  };
  const context = {
    type: 'metadata',
    version: 1,
    data: { 'example.context': { opaque: true } },
  };
  const blob = JSON.stringify([file, context]);
  const client = {
    version: 1,
    platform: 'ios',
    appVersion: '9.5.10',
    build: '501',
    gitHash: 'abc1234',
  } as const;
  setPostClientMetadata(client);

  const stamped = appendPostClientMetadata(blob)!;
  expect(JSON.parse(stamped)).toEqual([
    file,
    context,
    { type: 'metadata', version: 1, data: { 'tlon.client': client } },
  ]);
  expect(convertContent(null, stamped)).toEqual(convertContent(null, blob));
});

test('non-app consumers without client metadata keep the original blob', () => {
  expect(appendPostClientMetadata(undefined)).toBeUndefined();
  expect(appendPostClientMetadata('[]')).toBe('[]');
});
