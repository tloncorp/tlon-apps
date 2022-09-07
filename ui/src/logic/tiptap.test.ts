// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { JSONContent } from '@tiptap/react';
import { Inline } from '@/types/content';
import { inlinesToJSON, inlineToContent, wrapParagraphs } from './tiptap';

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
      { type: 'paragraph' },
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
  it('empty case', () => {
    const input: Inline[] = [''];
    const output = inlinesToJSON(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
    };
    expect(output).toEqual(expected);
  });

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
        { type: 'paragraph' },
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
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'foo foo' }] },
        { type: 'paragraph' },
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
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'text', text: 'foo' }] },
        { type: 'paragraph' },
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
        { type: 'paragraph' },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'with ' },
            { type: 'text', text: 'style', marks: [{ type: 'bold' }] },
          ],
        },
        { type: 'paragraph' },
      ],
    };
    expect(output).toEqual(expected);
  });
});
