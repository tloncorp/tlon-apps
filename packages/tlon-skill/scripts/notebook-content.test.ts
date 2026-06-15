import { describe, expect, it } from 'bun:test';

import { normalizeNotebookContent } from './notebook-content';

describe('normalizeNotebookContent', () => {
  it('keeps Story content unchanged', () => {
    const story = [{ inline: ['Body'] }];

    expect(normalizeNotebookContent(story)).toEqual(story);
  });

  it('accepts empty Story content', () => {
    expect(normalizeNotebookContent([])).toEqual([]);
  });

  it('accepts common Story block and inline shapes', () => {
    const story = [
      { inline: ['Use ', { 'inline-code': 'ha-q' }, ' here'] },
      { block: { header: { tag: 'h2', content: [{ bold: ['Title'] }] } } },
      { block: { code: { code: 'const value = 1;', lang: 'ts' } } },
      {
        block: {
          image: {
            src: 'https://example.com/image.png',
            height: 100,
            width: 200,
            alt: '',
          },
        },
      },
      { block: { rule: null } },
    ];

    expect(normalizeNotebookContent(story)).toEqual(story);
  });

  it('passes through ship-supported Story shapes that are not locally modeled', () => {
    const story = [
      { block: { listing: [{ inline: ['Item'] }] } },
      {
        block: {
          link: {
            href: 'https://example.com',
            content: [{ inline: ['Example'] }],
          },
        },
      },
      {
        inline: [
          { cite: { chan: { nest: 'chat/~host/slug', where: '170.141' } } },
        ],
      },
      { inline: [{ task: { checked: false, content: ['Todo'] } }] },
      { inline: [{ sect: 'Section' }] },
      { inline: [{ block: { rule: null } }] },
    ];

    expect(normalizeNotebookContent(story)).toEqual(story);
  });

  it('rejects arrays that are not Story verse arrays', () => {
    expect(() => normalizeNotebookContent([1, 2])).toThrow(
      'Unsupported notebook content JSON'
    );
    expect(() => normalizeNotebookContent([{}])).toThrow(
      'Unsupported notebook content JSON'
    );
    expect(() => normalizeNotebookContent([{ inline: 'Body' }])).toThrow(
      'Unsupported notebook content JSON'
    );
    expect(() => normalizeNotebookContent([{ block: {} }])).toThrow(
      'Unsupported notebook content JSON'
    );
    expect(() =>
      normalizeNotebookContent([{ inline: [], block: { rule: null } }])
    ).toThrow('Unsupported notebook content JSON');
    expect(() =>
      normalizeNotebookContent([{ inline: ['ok'], foo: 1 }])
    ).toThrow('Unsupported notebook content JSON');
    expect(() =>
      normalizeNotebookContent([{ block: { rule: null }, foo: 1 }])
    ).toThrow('Unsupported notebook content JSON');
  });

  it('rejects ProseMirror-style rich-text JSON instead of guessing', () => {
    expect(() =>
      normalizeNotebookContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ text: 'Body' }] }],
      })
    ).toThrow('Unsupported notebook content JSON');
  });

  it('rejects unsupported explicit content instead of returning title-only content', () => {
    expect(() => normalizeNotebookContent({ unsupported: true })).toThrow(
      'Unsupported notebook content JSON'
    );
  });
});
