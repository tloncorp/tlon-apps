import { expect, test } from 'vitest';

import {
  PlaintextPreviewConfig,
  convertContent,
  plaintextPreviewOf,
} from '../client/postContent';

const content = convertContent(
  [{ inline: ['hi ', { ship: '~sampel-palnet' }, ' and ', { ship: '~zod' }] }],
  null
);

test('plaintextPreviewOf shows a mention as its ship number', () => {
  expect(plaintextPreviewOf(content)).toBe('hi @1.624.961.343 and @0');
});

test('plaintextPreviewOf resolves mentions with a lookup', () => {
  expect(
    plaintextPreviewOf(content, {
      ...PlaintextPreviewConfig.inlineConfig,
      mentionText: (contactId) =>
        contactId === '~zod' ? '@Zod' : `@?${contactId.length}`,
    })
  ).toBe('hi @?14 and @Zod');
});
