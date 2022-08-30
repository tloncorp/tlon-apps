// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, expect, it } from 'vitest';
import { parseInline } from './tiptap';

/**
 * To dump JSON to a file
 */
// import { writeFile } from 'fs';
// await writeFile('empty.json', JSON.stringify(output), (err) => { if (err) { throw err; }});

describe('parseInline', () => {
  // This one works with TipTap
  it('parses empty case', () => {
    const input = [''];
    const output = parseInline(input);
    const expected = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }],
    };
    expect(output).toEqual(expected);
  });

  /**
   * This test is green, but shouldn't be; the output JSON is rejected by TipTap
   * with the following warning:
   *
   * react_devtools_backend.js:4026 [tiptap warn]: Invalid content. Passed value: {type: 'doc', content: Array(3)} Error: RangeError: Invalid text node in JSON
   */
  it('parses basic case', async () => {
    // HeapInline[]
    const input = [
      'test text',
      {
        break: null,
      },
      {
        break: null,
      },
      'with ',
      {
        bold: ['style'],
      },
      {
        break: null,
      },
    ];

    const output = parseInline(input);

    // JSONContent
    const expected = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'test text',
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
              text: 'with ',
            },
            {
              type: 'text',
              marks: [
                {
                  type: 'bold',
                },
              ],
            },
          ],
        },
      ],
    };
    expect(output).toEqual(expected);
  });
});
