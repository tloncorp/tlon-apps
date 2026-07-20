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

  expect(html).toContain('<div class="tlon-table-scroll"><table><thead><tr>');
  expect(html).toContain(
    '<th class="tlon-table-data-cell" style="text-align:left"><div class="tlon-table-cell-content">Name</div></th>'
  );
  expect(html).toContain(
    '<td class="tlon-table-data-cell" style="text-align:left"><div class="tlon-table-cell-content">Alice</div></td>'
  );
  expect(html).toContain(
    'th{background:transparent;color:var(--tertiary-text);font-weight:400}'
  );
  expect(html).toContain('width:max-content;min-width:100%');
  expect(html).toContain(
    '<th class="tlon-table-spacer" aria-hidden="true"></th>'
  );
  expect(html).toContain('<div class="tlon-table-cell-content">Name</div>');
  expect(html).toContain('class="tlon-table-data-cell"');
  expect(html).toContain('tr{border-bottom:1px solid var(--border)}');
});
