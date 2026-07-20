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

test('renderPublishedNoteHtml renders markdown tables', () => {
  const html = renderPublishedNoteHtml({
    title: 'Table note',
    body: '| Name | Score |\n| :--- | ---: |\n| Alice | 10 |',
  });

  expect(html).toContain(
    '<div class="tlon-table-scroll"><table><thead><tr><th style="text-align:left">Name</th><th style="text-align:right">Score</th></tr></thead><tbody><tr><td style="text-align:left">Alice</td><td style="text-align:right">10</td></tr></tbody></table></div>'
  );
  expect(html).toContain(
    'th{background:transparent;color:var(--tertiary-text);font-weight:400}'
  );
  expect(html).toContain('tr{border-bottom:1px solid var(--border)}');
});
