import { DiaryInline } from '@/types/diary';
import { describe, expect, it } from 'vitest';
import { groupByParagraph } from './DiaryContent';

const br = { break: null };

describe('groupByParagraphs', () => {
  it('does nothing when empty', () => {
    const input: DiaryInline[] = [];
    const output = groupByParagraph(input);
    const expected: DiaryInline[][] = [];
    expect(output).toEqual(expected);
  });

  it('gives single break as paragraph', () => {
    const input: DiaryInline[] = [br];
    const output = groupByParagraph(input);
    const expected: DiaryInline[][] = [[br]];
    expect(output).toEqual(expected);
  });

  it('handles multiple breaks as separate paragraphs', () => {
    const input: DiaryInline[] = ['hi', br, br, 'hello'];
    const output = groupByParagraph(input);
    const expected: DiaryInline[][] = [['hi'], [br], ['hello']];
    expect(output).toEqual(expected);
  });

  it('handles styling and an ending break', () => {
    const input: DiaryInline[] = [
      'test text',
      br,
      br,
      'with ',
      { bold: ['style'] },
      br,
    ];
    const output = groupByParagraph(input);
    const expected: DiaryInline[][] = [
      ['test text'],
      [br],
      ['with ', { bold: ['style'] }],
    ];
    expect(output).toEqual(expected);
  });
});
