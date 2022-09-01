// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { JSONContent } from '@tiptap/react';
import { Inline } from '@/types/content';
import { inlinesToJSON, inlineToContent } from './tiptap';

// 'foo' | { bold: ['bar'] } | { italics: [ { bold: [ "foobar" ] } ] } | { 'inline-code': 'code' } | { break: null }
describe('inlineToContent', () => {
  it('handles base case', () => {
    const input: Inline = 'foo';
    const output = inlineToContent(input);
    const expected: JSONContent = { type: 'text', text: 'foo' };
    expect(output).toEqual(expected);
  });

  it('handles break case', () => {
    const input: Inline = { break: null };
    const output = inlineToContent(input);
    const expected: JSONContent = { type: 'paragraph' };
    expect(output).toEqual(expected);
  });

  it('handles single nested style', () => {
    const input: Inline = { bold: ['bar'] };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'text',
      text: 'bar',
      marks: [{ type: 'bold' }],
    };
    expect(output).toEqual(expected);
  });

  it('handles double nested style', () => {
    const input: Inline = { italics: [{ bold: ['foobar'] }] };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'text',
      marks: [{ type: 'bold' }, { type: 'italic' }],
      text: 'foobar',
    };
    expect(output).toEqual(expected);
  });

  it('handles triple nested style', () => {
    const input: Inline = { strike: [{ italics: [{ bold: ['foobaz'] }] }] };
    const output = inlineToContent(input);
    const expected: JSONContent = {
      type: 'text',
      marks: [{ type: 'bold' }, { type: 'italic' }, { type: 'strike' }],
      text: 'foobaz',
    };
    expect(output).toEqual(expected);
  });

  it('handles un-nestable inline', () => {
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

  it('two paragraphs', () => {
    const input: Inline[] = ['urbit fixes this', 'foo foo'];
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

  it('three paragraphs', () => {
    const input: Inline[] = ['urbit fixes this', 'foo foo', 'bar baz'];
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

  it('bolds with paragraph in between', () => {
    const input: Inline[] = [
      { bold: ['foo foo'] },
      ' and ',
      { bold: ['bar baz'] },
    ];
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
        { type: 'paragraph', content: [{ type: 'text', text: ' and ' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'bar baz', marks: [{ type: 'bold' }] },
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
        { type: 'paragraph', content: [{ type: 'text', text: 'with ' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'style', marks: [{ type: 'bold' }] }],
        },
        { type: 'paragraph' },
      ],
    };
    expect(output).toEqual(expected);
  });
});
