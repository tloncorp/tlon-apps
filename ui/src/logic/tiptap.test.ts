// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { JSONContent } from '@tiptap/react';
import { Inline } from '@/types/content';
import { parseInline } from './tiptap';

describe('parseInline', () => {
  it('empty case', () => {
    const input: Inline[] = [''];
    const output = parseInline(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
    };
    expect(output).toEqual(expected);
  });

  it('single paragraph', () => {
    const input: Inline[] = ['urbit fixes this'];
    const output = parseInline(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'urbit fixes this' }] }],
    };
    expect(output).toEqual(expected);
  });

  it('two paragraphs', () => {
    const input: Inline[] = ['urbit fixes this', 'foo foo'];
    const output = parseInline(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'urbit fixes this' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'foo foo' }] }
      ],
    };
    expect(output).toEqual(expected);
  });

  it('two paragraphs with style', () => {
    const input: Inline[] = [ { "bold": ["foo"] }, { "break": null }, { "break": null }, "foo", { "break": null } ];
    const output = parseInline(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        { type: "paragraph", content: [{ type: "text", marks: [{ type: "bold" }], text: "foo" }] },
        { type: "paragraph" },
        { type: "paragraph", content: [{ type: "text", "text": "foo" }] }
      ],
    };
    expect(output).toEqual(expected);
  });

  it('element with multiple styles', () => {
    const input: Inline[] = [ { "italics": [ { "bold": [ "foobar" ] } ] } ];
    const output = parseInline(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        { type: "doc", content: [ { type: "paragraph", content: [ { type: "text", marks: [ { type: "bold" }, { type: "italic" } ], text: "foobar" } ] } ] }
      ],
    };
    expect(output).toEqual(expected);
  });

  it('bold', () => {
    const input: Inline[] = [{ bold: ['foo foo'] }, ' and ', { bold: ['bar baz'] }];
    const output = parseInline(input);
    const expected: JSONContent = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'foo foo', marks: [{ type: 'bold' }] }] },
        { type: 'paragraph', content: [{ type: 'text', text: ' and ' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'bar baz', marks: [{ type: 'bold' }] }] },
      ],
    };
    expect(output).toEqual(expected);
  });


  it('parses basic case', async () => {
    const input: Inline[] = [ 'test text', { break: null, }, { break: null, }, 'with ', { bold: ['style'], }, { break: null, }, ];
    const output = parseInline(input);
    const expected: JSONContent = { type: 'doc', content: [ { type: 'paragraph', content: [ { type: 'text', text: 'test text', }, ], }, { type: 'paragraph', }, { type: 'paragraph', content: [ { type: 'text', text: 'with ', }, { type: 'text', text: 'style', marks: [ { type: 'bold', }, ], }, ], }, ], };
    expect(output).toEqual(expected);
  });
});
