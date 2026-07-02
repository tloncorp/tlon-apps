import { expect, test } from 'vitest';

import { renderPublishedNoteHtml } from './notesPublish';

test('renderPublishedNoteHtml renders markdown list children as list items', () => {
  const html = renderPublishedNoteHtml({
    title: 'List note',
    body: '- first\n- second',
  });

  expect(html).toContain('<ul><li>first</li><li>second</li></ul>');
  expect(html).not.toContain('<ul><li><ul>');
});
