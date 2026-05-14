import { describe, expect, it } from 'vitest';

import { extractTablesFromContent } from './extractTables';

describe('extractTablesFromContent', () => {
  it('extracts a simple table from a paragraph block', () => {
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| A | B |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| 1 | 2 |' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      type: 'table',
      header: {
        cells: [
          { content: [{ type: 'text', text: 'A' }] },
          { content: [{ type: 'text', text: 'B' }] },
        ],
      },
      rows: [
        {
          cells: [
            { content: [{ type: 'text', text: '1' }] },
            { content: [{ type: 'text', text: '2' }] },
          ],
        },
      ],
    });
  });

  it('joins soft-wrapped continuation lines back into their row', () => {
    // Simulates a long cell whose tail gets soft-wrapped onto its own line.
    // Without normalization, remark-gfm parses the continuation as a phantom
    // one-cell row and the wrapped portion is lost from the real row's last
    // cell.
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| Foo | Bar | Baz |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|---|' },
          { type: 'lineBreak' },
          {
            type: 'text',
            text: '| alpha | beta | Lorem ipsum dolor sit amet,',
          },
          { type: 'lineBreak' },
          { type: 'text', text: 'consectetur adipiscing elit. |' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    const table = result[0];
    expect(table.type).toBe('table');
    if (table.type !== 'table') throw new Error('unreachable');

    expect(table.rows).toHaveLength(1);
    const lastCell = table.rows[0].cells[2];
    expect(lastCell.content).toEqual([
      {
        type: 'text',
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
      },
    ]);
  });

  it('handles multiple continuation lines in the same row', () => {
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| A | B |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| 1 | first line' },
          { type: 'lineBreak' },
          { type: 'text', text: 'second line' },
          { type: 'lineBreak' },
          { type: 'text', text: 'third line |' },
        ],
      },
    ]);

    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.rows[0].cells[1].content).toEqual([
      { type: 'text', text: 'first line second line third line' },
    ]);
  });

  it('extracts tables that omit outer pipes', () => {
    // GFM allows tables without leading/trailing pipes. The continuation-line
    // normalizer must not merge data rows here, since no row starts with `|`.
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'A | B' },
          { type: 'lineBreak' },
          { type: 'text', text: '---|---' },
          { type: 'lineBreak' },
          { type: 'text', text: '1 | 2' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.header.cells).toEqual([
      { content: [{ type: 'text', text: 'A' }] },
      { content: [{ type: 'text', text: 'B' }] },
    ]);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].cells).toEqual([
      { content: [{ type: 'text', text: '1' }] },
      { content: [{ type: 'text', text: '2' }] },
    ]);
  });

  it('does not split a table when a data row looks like a separator', () => {
    // `| --- | --- |` matches the separator-row regex but inside a table
    // body it's just a data row of dash strings. The scan must not bail
    // out here.
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| H1 | H2 |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| a | b |' },
          { type: 'lineBreak' },
          { type: 'text', text: '| --- | --- |' },
          { type: 'lineBreak' },
          { type: 'text', text: '| c | d |' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.rows).toHaveLength(3);
    expect(table.rows[1].cells.map((c) => c.content)).toEqual([
      [{ type: 'text', text: '---' }],
      [{ type: 'text', text: '---' }],
    ]);
  });

  it('leaves non-table paragraphs untouched', () => {
    const input = [
      {
        type: 'paragraph' as const,
        content: [
          { type: 'text' as const, text: 'just a sentence with | a pipe' },
        ],
      },
    ];
    expect(extractTablesFromContent(input)).toEqual(input);
  });

  it('preserves bold and link inlines inside cells', () => {
    // Mirrors the wire shape we've seen in real bot posts: a bold inline
    // mid-row and a link inline embedded in the last cell.
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| Foo | Bar | Baz |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| alpha | ' },
          {
            type: 'style',
            style: 'bold',
            children: [{ type: 'text', text: 'beta' }],
          },
          { type: 'text', text: ' | Lorem ipsum dolor sit amet. ' },
          {
            type: 'link',
            href: 'https://example.com/source',
            text: '(citation, Jan 1 2030)',
          },
          { type: 'text', text: ' |' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.rows).toHaveLength(1);

    const [first, second, third] = table.rows[0].cells;
    expect(first.content).toEqual([{ type: 'text', text: 'alpha' }]);
    expect(second.content).toEqual([
      {
        type: 'style',
        style: 'bold',
        children: [{ type: 'text', text: 'beta' }],
      },
    ]);
    expect(third.content).toEqual([
      { type: 'text', text: 'Lorem ipsum dolor sit amet. ' },
      {
        type: 'link',
        href: 'https://example.com/source',
        text: '(citation, Jan 1 2030)',
      },
    ]);
  });

  it('preserves group mentions inside cells', () => {
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| Who | Note |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| ' },
          { type: 'groupMention', group: 'all' },
          { type: 'text', text: ' | everyone |' },
          { type: 'lineBreak' },
          { type: 'text', text: '| ' },
          { type: 'groupMention', group: 'admin' },
          { type: 'text', text: ' | staff |' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.rows[0].cells[0].content).toEqual([
      { type: 'groupMention', group: 'all' },
    ]);
    expect(table.rows[1].cells[0].content).toEqual([
      { type: 'groupMention', group: 'admin' },
    ]);
  });

  it('preserves link text containing markdown-special characters', () => {
    // `]` in link text would have broken the old hand-written serializer;
    // mdast-util-to-markdown escapes it properly.
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| Source |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| ' },
          {
            type: 'link',
            href: 'https://example.com',
            text: 'foo [bar] baz',
          },
          { type: 'text', text: ' |' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.rows[0].cells[0].content).toEqual([
      {
        type: 'link',
        href: 'https://example.com',
        text: 'foo [bar] baz',
      },
    ]);
  });

  it('splits paragraph around a table', () => {
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'Before the table.' },
          { type: 'lineBreak' },
          { type: 'text', text: '| A | B |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| 1 | 2 |' },
          { type: 'lineBreak' },
          { type: 'text', text: 'After the table.' },
        ],
      },
    ]);

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({
      type: 'paragraph',
      content: [{ type: 'text', text: 'Before the table.' }],
    });
    expect(result[1].type).toBe('table');
    expect(result[2]).toMatchObject({
      type: 'paragraph',
      content: [{ type: 'text', text: 'After the table.' }],
    });
  });
});
