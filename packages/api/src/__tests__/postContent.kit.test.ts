import { expect, test } from 'vitest';

import { convertContent } from '../client/postContent';

test('convertContent renders kit blob entries as kit-card blocks before story content', () => {
  const entry = {
    type: 'kit',
    version: 1,
    id: 'book-club',
    publisher: '~sampel-palnet',
    kitVersion: '0.1.0',
    name: 'Book Club',
    description: 'A monthly book club, batteries included',
    image: null,
  };

  const content = convertContent(
    [{ inline: ['Book Club — A monthly book club, batteries included'] }],
    JSON.stringify([entry])
  );

  expect(content[0]).toEqual({
    type: 'kit-card',
    kit: {
      id: 'book-club',
      publisher: '~sampel-palnet',
      version: '0.1.0',
      name: 'Book Club',
      description: 'A monthly book club, batteries included',
      image: null,
    },
  });
  expect(content[1]).toMatchObject({ type: 'paragraph' });
});

test('convertContent degrades malformed kit blob entries to the upgrade notice', () => {
  const content = convertContent(
    null,
    JSON.stringify([{ type: 'kit', version: 1 }])
  );

  expect(content).toEqual([
    {
      type: 'blockquote',
      content: [{ type: 'text', text: 'Upgrade your app to see this post' }],
    },
  ]);
});
