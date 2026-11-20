import { describe, expect, it } from 'vitest';

import { escapeCodeSpanPipes } from './codeSpanPipes';

describe('escapeCodeSpanPipes', () => {
  it('escapes pipes inside a code span and leaves cell delimiters alone', () => {
    expect(escapeCodeSpanPipes('| `a | b` | c |')).toBe('| `a \\| b` | c |');
  });

  it('leaves an already escaped pipe alone', () => {
    expect(escapeCodeSpanPipes('| `a \\| b` | c |')).toBe('| `a \\| b` | c |');
  });

  it('closes a span only with a backtick run of the same length', () => {
    expect(escapeCodeSpanPipes('| ``a ` | b`` | c |')).toBe(
      '| ``a ` \\| b`` | c |'
    );
  });

  it('treats an unmatched backtick as text', () => {
    expect(escapeCodeSpanPipes('| a ` b | c |')).toBe('| a ` b | c |');
  });

  it('does not open a span on an escaped backtick', () => {
    expect(escapeCodeSpanPipes('| \\`a | b` | c |')).toBe('| \\`a | b` | c |');
  });
});
