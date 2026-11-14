import { expect, test } from 'vitest';

import {
  PlaintextPreviewConfig,
  convertContent,
  getShipMentionTextContent,
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

test('getShipMentionTextContent keeps mentions as ships for agents and tests', () => {
  const story = [{ inline: ['hi ', { ship: '~zod' }] }];
  expect(getShipMentionTextContent(JSON.stringify(story))).toBe('hi ~zod');
  expect(getShipMentionTextContent(story)).toBe('hi ~zod');
});
