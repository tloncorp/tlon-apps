import { expect, test } from 'vitest';

import { convertContent } from '../client/postContent';

test('convertContent renders supported a2ui blob entries before story content', () => {
  const a2ui = {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'approval-card',
          catalogId: 'tlon.a2ui.basic.v1',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'approval-card',
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'body' },
            { id: 'body', component: 'Column', children: ['title'] },
            { id: 'title', component: 'Text', text: 'Approve DM?' },
          ],
        },
      },
    ],
  };

  const content = convertContent(
    [{ inline: ['Fallback text'] }],
    JSON.stringify([a2ui])
  );

  expect(content[0]).toEqual({ type: 'a2ui', a2ui });
  expect(content[1]).toMatchObject({ type: 'paragraph' });
});
