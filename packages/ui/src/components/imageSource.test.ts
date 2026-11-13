import { expect, test } from 'vitest';

import { isValidImageSource } from './imageSource';

test('image sources on hosts without a domain ending are valid', () => {
  for (const uri of [
    'http://localhost:3101/v1/avatars/a/b',
    'http://127.0.0.1:47800/v1/avatars/a/b',
    'https://example.com/a.png',
    '/v1/rooms/r/attachments/x/content',
    'blob:http://localhost:3101/1234',
    'data:image/png;base64,AAAA',
  ]) {
    expect(isValidImageSource({ uri })).toBe(true);
  }
});

test('image sources that are not addresses are invalid', () => {
  for (const uri of ['', 'not a url', undefined]) {
    expect(isValidImageSource({ uri })).toBe(false);
  }
  expect(isValidImageSource(null)).toBe(false);
});
