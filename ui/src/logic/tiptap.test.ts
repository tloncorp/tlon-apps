// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { JSONContent } from '@tiptap/react';
import { Inline } from '@/types/content';
import { DiaryBlock } from '@/types/diary';
import {
  inlinesToJSON,
  inlineToContent,
  JSONToInlines,
  wrapParagraphs,
} from './tiptap';

describe('wrapParagraphs', () => {
  it('wraps empty content', () => {
    const input: JSONContent[] = [];
    const output = wrapParagraphs(input);
    const expected: JSONContent[] = [{ type: 'paragraph', content: [] }];
    expect(output).toEqual(expected);
  });

  it('wraps a single paragraph', () => {
    const input: JSONContent[] = [{ type: 'text', text: 'foo' }];
    const output = wrapParagraphs(input);
    const expected: JSONContent[] = [
      { type: 'paragraph', content: [{ type: 'text', text: 'foo' }] },
    ];
    expect(output).toEqual(expected);
  });

  it('wraps contiguous inlines into a single paragraph', () => {
    const input: JSONContent[] = [
      { type: 'text', text: 'foo foo', marks: [{ type: 'bold' }] },
      { type: 'text', text: ' and ' },
      { type: 'text', text: 'bar baz', marks: [{ type: 'italic' }] },
    ];
    const output = wrapParagraphs(input);
    const expected: JSONContent[] = [
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'foo foo', marks: [{ type: 'bold' }] },
          { type: 'text', text: ' and ' },
          { type: 'text', text: 'bar baz', marks: [{ type: 'italic' }] },
        ],
      },
    ];
    expect(output).toEqual(expected);
  });

  it('separates paragraphs cordoned by breaks', () => {
    const input: JSONContent[] = [
      { type: 'text', text: 'urbit fixes this' },
      { type: 'paragraph' },
      { type: 'text', text: 'foo foo' },
    ];
    const output = wrapParagraphs(input);
    const expected: JSONContent[] = [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'urbit fixes this' }],
      },
      { type: 'paragraph', content: [{ type: 'text', text: 'foo foo' }] },
    ];
    expect(output).toEqual(expected);
  });
});

// 'foo' | { bold: ['bar'] } | { italics: [ { bold: [ "foobar" ] } ] } | { 'inline-code': 'code' } | { break: null }
describe('inlineToContent', () => {
  it('base case', () => {
    const input: Inline = 'foo';
    const output = inlineToContent(input);
    const expected: JSONContent = { type: 'text', text: 'foo' };
    expect(output).toEqual(expected);
  });

  it('break case', () => {
    const input: Inline = { break: null };
    const output = inlineToContent(input);
    const expected: JSONContent = { type: 'paragraph' };
    expect(output).toEqual(expected);
  });

  it('blockquote case', () => {
    const input: Inline = {
      blockquote: [
        'foo bar baz',
        { break: null },
        { bold: ['bold statement'] },
      ],
    };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'foo bar baz' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold statement', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('single nested style', () => {
    const input: Inline = { bold: ['bar'] };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'text',
      text: 'bar',
      marks: [{ type: 'bold' }],
    };
    expect(output).toEqual(expected);
  });

  it('double nested style', () => {
    const input: Inline = { italics: [{ bold: ['foobar'] }] };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'text',
      marks: [{ type: 'bold' }, { type: 'italic' }],
      text: 'foobar',
    };
    expect(output).toEqual(expected);
  });

  it('triple nested style', () => {
    const input: Inline = { strike: [{ italics: [{ bold: ['foobaz'] }] }] };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'text',
      marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'strike' }],
      text: 'foobaz',
    };
    expect(output).toEqual(expected);
  });

  it('un-nestable inline', () => {
    const input: Inline = { code: 'console.log()' };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'text',
      marks: [{ type: 'code' }],
      text: 'console.log()',
    };
    expect(output).toEqual(expected);
  });
});

describe('inlinesToJSON', () => {
  // it('empty case', () => {
  // const input: Inline[] = [''];
  // const output = inlinesToJSON(input);
  // const expected: JSONContent = {
  // type: 'doc',
  // content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
  // };
  // expect(output).toEqual(expected);
  // });

  it('single paragraph', () => {
    const input: Inline[] = ['urbit fixes this'];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'urbit fixes this' }],
        },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('two paragraphs separated by break', () => {
    const input: Inline[] = ['urbit fixes this', { break: null }, 'foo foo'];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'urbit fixes this' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'foo foo' }] },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('three paragraphs separated by breaks', () => {
    const input: Inline[] = [
      'urbit fixes this',
      { break: null },
      'foo foo',
      { break: null },
      'bar baz',
    ];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'urbit fixes this' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'foo foo' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'bar baz' }] },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('bold paragraph', () => {
    const input: Inline[] = [{ bold: ['foo foo'] }];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'foo foo', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('simple blockquote', () => {
    const input: Inline[] = [
      {
        blockquote: ['foo foo', { break: null }, { bold: ['bold statement'] }],
      },
    ];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'blockquote',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'foo foo' }],
            },
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: 'bold statement',
                  marks: [{ type: 'bold' }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('two paragraphs with style', () => {
    const input: Inline[] = [
      { bold: ['foo'] },
      { break: null },
      { break: null },
      'foo',
      { break: null },
    ];
    const output = inlinesToJSON(input);

    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'foo' }],
        },
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'foo' }] },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('element with multiple styles', () => {
    const input: Inline[] = [{ italics: [{ bold: ['foobar'] }] }];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'bold' }, { type: 'italic' }],
              text: 'foobar',
            },
          ],
        },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('multiple styled elements within a single paragraph', () => {
    const input: Inline[] = [
      { bold: ['foo foo'] },
      ' and ',
      { italics: ['bar baz'] },
    ];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'foo foo', marks: [{ type: 'bold' }] },
            { type: 'text', text: ' and ' },
            { type: 'text', text: 'bar baz', marks: [{ type: 'italic' }] },
          ],
        },
      ],
    };
    expect(output).toEqual(expected);
  });

  it('case that started all this', () => {
    const input: Inline[] = [
      'test text',
      { break: null },
      { break: null },
      'with ',
      { bold: ['style'] },
      { break: null },
    ];
    const output = inlinesToJSON(input);

    const expected: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'test text' }] },
        { type: 'paragraph' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'with ' },
            { type: 'text', text: 'style', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    expect(output).toEqual(expected);
  });
});

describe('JSONToInlines', () => {
  it('text', () => {
    const input: JSONContent = { type: 'text', text: 'foo' };
    const output = JSONToInlines(input);
    const expected: Inline[] = ['foo'];
    expect(output).toEqual(expected);
  });

  it('newline', () => {
    const input: JSONContent = { type: 'paragraph' };
    const output = JSONToInlines(input);
    const expected: Inline[] = [{ break: null }];
    expect(output).toEqual(expected);
  });

  it('unstyled paragraph', () => {
    const input: JSONContent = {
      type: 'paragraph',
      content: [{ type: 'text', text: 'bar' }],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = ['bar', { break: null }];
    expect(output).toEqual(expected);
  });

  it('styled paragraph', () => {
    const input: JSONContent = {
      type: 'paragraph',
      content: [
        { type: 'text', text: 'the following should be bold:' },
        { type: 'text', text: 'foobar', marks: [{ type: 'bold' }] },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      'the following should be bold:',
      { bold: ['foobar'] },
      { break: null },
    ];
    expect(output).toEqual(expected);
  });

  it('nested styled paragraph', () => {
    const input: JSONContent = {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: 'foobar',
          marks: [{ type: 'bold' }, { type: 'italic' }],
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      { italics: [{ bold: ['foobar'] }] },
      { break: null },
    ];
    expect(output).toEqual(expected);
  });

  it('simple doc', () => {
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'some text',
            },
          ],
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = ['some text', { break: null }];
    expect(output).toEqual(expected);
  });

  it('doc with multiple paragraphs', () => {
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'some text',
            },
          ],
        },
        {
          type: 'paragraph',
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'foofoo',
              marks: [{ type: 'bold' }],
            },
          ],
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      'some text',
      { break: null },
      { break: null },
      { bold: ['foofoo'] },
      { break: null },
    ];
    expect(output).toEqual(expected);
  });

  it('permits maximum 2 consecutive breaks', () => {
    const input: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'some text',
            },
          ],
        },
        {
          type: 'paragraph',
        },
        {
          type: 'paragraph',
        },
        {
          type: 'paragraph',
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'some more text',
            },
          ],
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      'some text',
      { break: null },
      { break: null },
      'some more text',
      { break: null },
    ];
    expect(output).toEqual(expected);
  });

  it('inline code', () => {
    const input: JSONContent = {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [
            {
              type: 'code',
            },
          ],
          text: 'console.log()',
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      { 'inline-code': 'console.log()' },
      { break: null },
    ];
    expect(output).toEqual(expected);
  });

  it('link', () => {
    const input: JSONContent = {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          marks: [
            {
              type: 'link',
              attrs: {
                href: 'https://urbit.org',
                target: '_blank',
                class: null,
              },
            },
          ],
          text: 'click here',
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      { link: { href: 'https://urbit.org', content: 'click here' } },
      { break: null },
    ];
    expect(output).toEqual(expected);
  });

  it('codeBlock', () => {
    const input: JSONContent = {
      type: 'codeBlock',
      content: [
        {
          type: 'text',
          text: 'console.log',
        },
      ],
    };
    const output = JSONToInlines(input, true, true);
    const expected: DiaryBlock[] = [
      {
        code: {
          code: 'console.log',
          lang: 'plaintext',
        },
      },
    ];
    expect(output).toEqual(expected);
  });

  it('blockquote', () => {
    const input: JSONContent = {
      type: 'blockquote',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'foo bar baz' }],
        },
        {
          type: 'paragraph',
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bold statement', marks: [{ type: 'bold' }] },
          ],
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      {
        blockquote: [
          'foo bar baz',
          { break: null },
          { break: null },
          { bold: ['bold statement'] },
          { break: null },
        ],
      },
    ];
    expect(output).toEqual(expected);
  });

  it('heading', () => {
    const input: JSONContent = {
      type: 'heading',
      attrs: {
        level: 2,
      },
      content: [
        {
          type: 'text',
          text: 'yoooo',
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: DiaryBlock[] = [
      {
        header: {
          tag: 'h2',
          content: ['yoooo'],
        },
      },
    ];
    expect(output).toEqual(expected);
  });

  it('horizontal rules', () => {
    const input: JSONContent = {
      type: 'horizontalRule',
    };
    const output = JSONToInlines(input);
    const expected: DiaryBlock[] = [
      {
        rule: null,
      },
    ];
    expect(output).toEqual(expected);
  });

  it('basic list', () => {
    const input: JSONContent = {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'text', text: 'one' }] },
        {
          type: 'listItem',
          content: [
            {
              type: 'text',
              text: 'two',
              marks: [{ type: 'bold' }, { type: 'italic' }],
            },
          ],
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: DiaryBlock[] = [
      {
        listing: {
          list: {
            type: 'ordered',
            contents: [],
            items: [
              { item: ['one'] },
              {
                item: [
                  {
                    italics: [{ bold: ['two'] }],
                  },
                ],
              },
            ],
          },
        },
      },
    ];
    expect(output).toEqual(expected);
  });

  it('mixed nested list', () => {
    const input: JSONContent = {
      type: 'orderedList',
      content: [
        { type: 'listItem', content: [{ type: 'text', text: 'one' }] },
        {
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'two' }],
            },
            {
              type: 'bulletList',
              content: [
                {
                  type: 'listItem',
                  content: [{ type: 'text', text: 'three' }],
                },
              ],
            },
          ],
        },
      ],
    };
    const output = JSONToInlines(input);
    const expected: DiaryBlock[] = [
      {
        listing: {
          list: {
            type: 'ordered',
            contents: [],
            items: [
              { item: ['one'] },
              {
                list: {
                  type: 'unordered',
                  contents: ['two', { break: null }],
                  items: [{ item: ['three'] }],
                },
              },
            ],
          },
        },
      },
    ];
    expect(output).toEqual(expected);
  });

  it('diary-image', () => {
    const input: JSONContent = {
      type: 'diary-image',
      attrs: {
        src: 'https://example.com/test.jpg',
        alt: '',
        height: 509,
        width: 616,
      },
    };
    const output = JSONToInlines(input);
    const expected: DiaryBlock[] = [
      {
        image: {
          src: 'https://example.com/test.jpg',
          alt: '',
          height: 509,
          width: 616,
        },
      },
    ];
    expect(output).toEqual(expected);
  });

  it('diary-cite', () => {
    const input: JSONContent = {
      type: 'diary-cite',
      attrs: {
        path: '/1/group/~zod/test',
      },
    };
    const output = JSONToInlines(input);
    const expected: DiaryBlock[] = [
      {
        cite: {
          group: '~zod/test',
        },
      },
    ];
    expect(output).toEqual(expected);
  });

  it('diary-link', () => {
    const input: JSONContent = {
      type: 'diary-link',
      attrs: {
        href: 'https://urbit.org',
        title: 'click here',
      },
    };
    const output = JSONToInlines(input);
    const expected: Inline[] = [
      { link: { href: 'https://urbit.org', content: 'click here' } },
    ];
    expect(output).toEqual(expected);
  });
});
