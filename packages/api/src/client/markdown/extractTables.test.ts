import { describe, expect, it } from 'vitest';

import type { InlineData } from '../postContent';
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

  it('catches group mentions adjacent to punctuation in cells', () => {
    // remark-gfm leaves cell text intact, so a cell written as `(@all)` or
    // `@all,` shows up as a text node with `@` next to non-alphanumeric
    // punctuation. The lookbehind has to permit those cases.
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| A | B | C |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|---|' },
          { type: 'lineBreak' },
          {
            type: 'text',
            text: '| (@all) | @admin, others | email@example.com |',
          },
        ],
      },
    ]);

    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    const [paren, comma, email] = table.rows[0].cells;

    // `(@all)` → `(` text, groupMention, `)` text
    expect(paren.content).toEqual([
      { type: 'text', text: '(' },
      { type: 'groupMention', group: 'all' },
      { type: 'text', text: ')' },
    ]);

    // `@admin, others` → groupMention, then the trailing text
    expect(comma.content).toEqual([
      { type: 'groupMention', group: 'admin' },
      { type: 'text', text: ', others' },
    ]);

    // `email@example.com` is autolinked by remark-gfm, so the `@` is inside
    // a link node, not a text node — the group-mention scan never sees it.
    // Even if it did, the negative lookbehind rejects `@` after `l`.
    expect(email.content).toEqual([
      {
        type: 'link',
        href: 'mailto:email@example.com',
        text: 'email@example.com',
      },
    ]);
  });

  it('preserves pipes inside structured inlines (inline code, links)', () => {
    // Inline code containing `|` (e.g. shell pipes, urbit ++mark commands)
    // would otherwise be interpreted by remark-gfm as a cell delimiter and
    // shift the row's cell count.
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| Command | Notes |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| ' },
          {
            type: 'style',
            style: 'code',
            children: [{ type: 'text', text: 'awk -F | print' }],
          },
          { type: 'text', text: ' | filters input |' },
        ],
      },
    ]);

    expect(result).toHaveLength(1);
    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0].cells).toHaveLength(2);
    expect(table.rows[0].cells[0].content).toEqual([
      {
        type: 'style',
        style: 'code',
        children: [{ type: 'text', text: 'awk -F | print' }],
      },
    ]);
    expect(table.rows[0].cells[1].content).toEqual([
      { type: 'text', text: 'filters input' },
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

  it('uses double-tilde strike semantics inside table cells', () => {
    const result = extractTablesFromContent([
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: '| Literal | Strike |' },
          { type: 'lineBreak' },
          { type: 'text', text: '|---|---|' },
          { type: 'lineBreak' },
          { type: 'text', text: '| ~no strike~ | ~~struck~~ |' },
        ],
      },
    ]);

    const table = result[0];
    if (table.type !== 'table') throw new Error('unreachable');
    expect(table.rows[0].cells).toEqual([
      { content: [{ type: 'text', text: '~no strike~' }] },
      {
        content: [
          {
            type: 'style',
            style: 'strikethrough',
            children: [{ type: 'text', text: 'struck' }],
          },
        ],
      },
    ]);
  });

  describe('mention boundary during cell reassembly', () => {
    function singleCellTable(cell: InlineData[]) {
      return extractTablesFromContent([
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: '| A |' },
            { type: 'lineBreak' },
            { type: 'text', text: '|---|' },
            { type: 'lineBreak' },
            { type: 'text', text: '| ' },
            ...cell,
            { type: 'text', text: ' |' },
          ],
        },
      ]);
    }

    function firstCell(result: ReturnType<typeof extractTablesFromContent>) {
      const table = result[0];
      if (table.type !== 'table') throw new Error('unreachable');
      return table.rows[0].cells[0].content;
    }

    it('keeps a mention and following text separate', () => {
      const result = singleCellTable([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: 'abc' },
      ]);
      expect(firstCell(result)).toEqual([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: 'abc' },
      ]);
    });

    it.each([
      ['2fast', 'digit-leading'],
      ['ABC', 'uppercase'],
      ['-monster', 'hyphen-leading'],
    ])('keeps a mention separate from %s (%s)', (text) => {
      const result = singleCellTable([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text },
      ]);
      expect(firstCell(result)).toEqual([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text },
      ]);
    });

    it('keeps the mention when followed by a dotted email local part', () => {
      const result = singleCellTable([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: '.foo@example.com' },
      ]);
      const content = firstCell(result);
      expect(content[0]).toEqual({ type: 'mention', contactId: '~zod' });
      // The follower may come back as a mailto link (GFM autolinks a
      // dotted-domain email even with a dot-leading local part); assert only
      // that the mention survives.
      expect(JSON.stringify(content)).not.toContain('~zod.foo');
    });

    it('keeps the mention before an undotted email control literal', () => {
      const result = singleCellTable([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: '.foo@example' },
      ]);
      expect(firstCell(result)).toEqual([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: '.foo@example' },
      ]);
    });

    it('preserves both a mention and an adjacent group mention', () => {
      const result = singleCellTable([
        { type: 'mention', contactId: '~zod' },
        { type: 'groupMention', group: 'admin' },
      ]);
      expect(firstCell(result)).toEqual([
        { type: 'mention', contactId: '~zod' },
        { type: 'groupMention', group: 'admin' },
      ]);
    });

    it('needs no separator before a space-leading follower', () => {
      const result = singleCellTable([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: ' x' },
      ]);
      expect(firstCell(result)).toEqual([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: ' x' },
      ]);
    });

    it('separates a mention inside a bold cell', () => {
      const result = singleCellTable([
        {
          type: 'style',
          style: 'bold',
          children: [
            { type: 'mention', contactId: '~zod' },
            { type: 'text', text: 'abc' },
          ],
        },
      ]);
      expect(firstCell(result)).toEqual([
        {
          type: 'style',
          style: 'bold',
          children: [
            { type: 'mention', contactId: '~zod' },
            { type: 'text', text: 'abc' },
          ],
        },
      ]);
    });

    it('separates recursively through a doubly nested style', () => {
      const result = singleCellTable([
        {
          type: 'style',
          style: 'bold',
          children: [
            {
              type: 'style',
              style: 'italic',
              children: [
                { type: 'mention', contactId: '~zod' },
                { type: 'text', text: 'abc' },
              ],
            },
          ],
        },
      ]);
      const content = firstCell(result);
      expect(JSON.stringify(content)).toContain('"contactId":"~zod"');
      expect(JSON.stringify(content)).toContain('"text":"abc"');
      expect(JSON.stringify(content)).not.toContain('~zodabc');
    });

    it('keeps a nested mention intact before a nested mark', () => {
      const result = singleCellTable([
        {
          type: 'style',
          style: 'bold',
          children: [
            { type: 'mention', contactId: '~zod' },
            {
              type: 'style',
              style: 'italic',
              children: [{ type: 'text', text: '!lead' }],
            },
          ],
        },
      ]);
      const content = firstCell(result);
      expect(JSON.stringify(content)).not.toMatch(/&#/);
      expect(JSON.stringify(content)).toContain('"contactId":"~zod"');
      expect(JSON.stringify(content)).not.toContain('~zo"');
    });

    it('skips empty text when finding the next top-level sibling', () => {
      const result = singleCellTable([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: '' },
        { type: 'text', text: 'abc' },
      ]);
      expect(firstCell(result)).toEqual([
        { type: 'mention', contactId: '~zod' },
        { type: 'text', text: 'abc' },
      ]);
    });

    it('skips empty text inside a bold child list', () => {
      const result = singleCellTable([
        {
          type: 'style',
          style: 'bold',
          children: [
            { type: 'mention', contactId: '~zod' },
            { type: 'text', text: '' },
            { type: 'text', text: 'abc' },
          ],
        },
      ]);
      expect(firstCell(result)).toEqual([
        {
          type: 'style',
          style: 'bold',
          children: [
            { type: 'mention', contactId: '~zod' },
            { type: 'text', text: 'abc' },
          ],
        },
      ]);
    });

    it('flattens a task cell to literal text with no mention', () => {
      const result = singleCellTable([
        {
          type: 'task',
          checked: true,
          children: [
            { type: 'mention', contactId: '~zod' },
            { type: 'text', text: 'abc' },
          ],
        },
      ]);
      const content = firstCell(result);
      // The task degrades to a plain text marker by design; the base
      // manufactured a wrong ~zodabc mention here, which must not return.
      expect(JSON.stringify(content)).not.toContain('"mention"');
      expect(JSON.stringify(content)).toContain('[x] ~zodabc');
    });
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
