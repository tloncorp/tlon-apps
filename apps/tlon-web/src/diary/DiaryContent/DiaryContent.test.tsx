import { Inline } from '@/types/content';
import { describe, expect, it } from 'vitest';

import { groupByParagraph } from './DiaryContent';

const br = { break: null };

describe('groupByParagraphs', () => {
  it('does nothing when empty', () => {
    const input: Inline[] = [];
    const output = groupByParagraph(input);
    const expected: Inline[][] = [];
    expect(output).toEqual(expected);
  });

  it('gives single break as paragraph', () => {
    const input: Inline[] = [br];
    const output = groupByParagraph(input);
    const expected: Inline[][] = [[br]];
    expect(output).toEqual(expected);
  });

  it('handles multiple breaks as separate paragraphs', () => {
    const input: Inline[] = ['hi', br, br, 'hello'];
    const output = groupByParagraph(input);
    const expected: Inline[][] = [['hi'], [br], ['hello']];
    expect(output).toEqual(expected);
  });

  it('handles styling and an ending break', () => {
    const input: Inline[] = [
      'test text',
      br,
      br,
      'with ',
      { bold: ['style'] },
      br,
    ];
    const output = groupByParagraph(input);
    const expected: Inline[][] = [
      ['test text'],
      [br],
      ['with ', { bold: ['style'] }],
    ];
    expect(output).toEqual(expected);
  });
});
