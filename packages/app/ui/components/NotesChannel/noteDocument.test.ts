import { convertContent, markdownToStory } from '@tloncorp/shared/logic';
import { describe, expect, it, vi } from 'vitest';

import { buildNoteDocument } from './noteDocument';

vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
});

vi.mock('@tloncorp/ui', () => ({ Text: 'Text' }));
// BlockRenderer pulls in the whole React renderer; only its list helper is used.
vi.mock('../PostContent/BlockRenderer', () => ({
  listItemMarkerType: (
    listType: 'ordered' | 'unordered' | 'tasklist',
    child: { content: { type: string }[] }
  ) =>
    listType !== 'tasklist'
      ? listType
      : child.content.some((inline) => inline.type === 'task')
        ? 'tasklist'
        : 'unordered',
}));

const build = (markdown: string) =>
  buildNoteDocument(
    convertContent(markdownToStory(markdown), null),
    (id) => `name:${id}`
  );

describe('buildNoteDocument', () => {
  it('keeps headings and inline styles', () => {
    expect(build('# Title\n\nSome **bold** and *it* and `code`.')).toEqual([
      { type: 'text', style: 'h1', runs: [{ text: 'Title' }] },
      {
        type: 'text',
        style: 'body',
        runs: [
          { text: 'Some ' },
          { text: 'bold', bold: true },
          { text: ' and ' },
          { text: 'it', italic: true },
          { text: ' and ' },
          { text: 'code', code: true },
          { text: '.' },
        ],
      },
    ]);
  });

  it('keeps links and mentions pressable', () => {
    const [block] = build('See [docs](https://tlon.io) with ~zod');
    expect(block).toMatchObject({
      type: 'text',
      runs: expect.arrayContaining([
        { text: 'docs', link: 'https://tlon.io' },
        { text: 'name:~zod', mention: '~zod', tint: 'mention' },
      ]),
    });
  });

  it('flattens nested lists with markers and indents', () => {
    expect(build('1. one\n   - inner\n2. two')).toEqual([
      {
        type: 'text',
        style: 'body',
        runs: [{ text: 'one' }],
        indent: 0,
        marker: '1.',
      },
      {
        type: 'text',
        style: 'body',
        runs: [{ text: 'inner' }],
        indent: 1,
        marker: '•',
      },
      {
        type: 'text',
        style: 'body',
        runs: [{ text: 'two' }],
        indent: 0,
        marker: '2.',
      },
    ]);
  });

  it('draws task checkboxes in the text, with no marker', () => {
    expect(build('- [x] done\n- [ ] todo')).toEqual([
      {
        type: 'text',
        style: 'body',
        runs: [{ text: '☑ ' }, { text: 'done' }],
        indent: 0,
        marker: undefined,
      },
      {
        type: 'text',
        style: 'body',
        runs: [{ text: '☐ ' }, { text: 'todo' }],
        indent: 0,
        marker: undefined,
      },
    ]);
  });

  it('carries code, quotes, rules, images and tables', () => {
    const blocks = build(
      [
        '> quoted',
        '',
        '```js',
        'const a = 1;',
        '```',
        '',
        '---',
        '',
        '![](https://example.com/a.png)',
        '',
        '| a | b |',
        '| - | -: |',
        '| 1 | 2 |',
      ].join('\n')
    );
    expect(blocks.map((block) => block.type)).toEqual([
      'text',
      'code',
      'rule',
      'image',
      'table',
    ]);
    expect(blocks[0]).toMatchObject({ style: 'quote' });
    expect(
      blocks[1].type === 'code' &&
        blocks[1].runs.map((run) => run.text).join('')
    ).toBe('const a = 1;');
    expect(
      blocks[1].type === 'code' && blocks[1].runs.some((run) => run.color)
    ).toBe(true);
    expect(blocks[3]).toMatchObject({ src: 'https://example.com/a.png' });
    expect(blocks[4]).toMatchObject({
      header: [[{ text: 'a' }], [{ text: 'b' }]],
      rows: [[[{ text: '1' }], [{ text: '2' }]]],
      align: [null, 'right'],
    });
  });
});
