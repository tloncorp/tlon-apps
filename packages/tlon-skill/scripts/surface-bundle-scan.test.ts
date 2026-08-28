import { describe, expect, it } from 'bun:test';

import {
  type SurfaceSpanKind,
  matchSpans,
  scanBundle,
} from './surface-bundle-scan';

/**
 * The scanner underpins every lexical rule in the publish gate, so the
 * properties tested here are the ones those rules depend on: a name in a
 * comment is not code, markup inside a template literal is not code, and an
 * interpolation inside markup IS code.
 */

function textOf(source: string, kind: SurfaceSpanKind): string {
  return scanBundle(source)
    .spans.filter((span) => span.kind === kind)
    .map((span) => span.text)
    .join('|');
}

describe('scanBundle', () => {
  it('separates line comments from code', () => {
    const source = 'const a = 1; // fetch(url)\nconst b = 2;';
    expect(textOf(source, 'line-comment')).toBe('// fetch(url)');
    expect(textOf(source, 'code')).not.toContain('fetch');
  });

  it('separates block comments from code', () => {
    const source = 'const a = 1;\n/* eval(x)\n   more */\nconst b = 2;';
    expect(textOf(source, 'block-comment')).toContain('eval(x)');
    expect(textOf(source, 'code')).not.toContain('eval');
  });

  it('separates string literals from code, delimiters included', () => {
    expect(textOf('const a = "WebSocket";', 'string')).toBe('"WebSocket"');
    expect(textOf("const a = 'x';", 'string')).toBe("'x'");
  });

  it('keeps template markup out of code and interpolations in it', () => {
    const source = 'html`<a href="x">${label}</a>`;';
    expect(textOf(source, 'template-text')).toBe('<a href="x">|</a>');
    expect(textOf(source, 'code')).toContain('label');
  });

  it('handles nested templates', () => {
    const source = 'html`<i>${items.map((n) => html`<b>${n}</b>`)}</i>`;';
    const templates = textOf(source, 'template-text');
    expect(templates).toContain('<i>');
    expect(templates).toContain('<b>');
    expect(textOf(source, 'code')).toContain('items.map');
  });

  it('does not treat an escaped backtick as the end of a template', () => {
    const source = 'html`a \\` b ${x} c`;';
    expect(textOf(source, 'code')).toContain('x');
  });

  it('classifies a regex literal, so a name inside it is not code', () => {
    const source = 'const re = /fetch\\(/;\nconst b = 2;';
    expect(textOf(source, 'regex')).toBe('/fetch\\(/');
    expect(textOf(source, 'code')).not.toContain('fetch');
  });

  it('reads a slash after an operand as division, not a regex', () => {
    const source = 'const ratio = total / count;\nconst other = 1;';
    expect(textOf(source, 'regex')).toBe('');
    expect(textOf(source, 'code')).toContain('count');
  });

  it('reports 1-based line and column', () => {
    const source = 'const a = 1;\nconst b = 2;\n  const c = 3;';
    const scan = scanBundle(source);
    expect(scan.lineAt(0)).toBe(1);
    expect(scan.columnAt(0)).toBe(1);
    expect(scan.lineAt(source.indexOf('b'))).toBe(2);
    expect(scan.columnAt(source.indexOf('const c'))).toBe(3);
    expect(scan.lineAt(source.indexOf('const c'))).toBe(3);
  });

  it('emits ordered, non-overlapping spans whose only gaps are delimiters', () => {
    const source =
      '// note\nconst a = "x"; /* b */ html`<p>${a}</p>`; const re = /y/;';
    const scan = scanBundle(source);
    let cursor = 0;
    let gaps = '';
    for (const span of scan.spans) {
      expect(span.start).toBeGreaterThanOrEqual(cursor);
      gaps += source.slice(cursor, span.start);
      cursor = span.end;
    }
    gaps += source.slice(cursor);
    // template delimiters are consumed rather than emitted; nothing else is
    expect(gaps.replace(/[`${}]/g, '')).toBe('');
  });
});

describe('matchSpans', () => {
  it('yields absolute offsets and does not leak lastIndex between spans', () => {
    const source = 'const a = 1; // x\nconst b = 1;';
    const scan = scanBundle(source);
    const hits = [...matchSpans(scan, ['code'], /const/g)];
    expect(hits).toHaveLength(2);
    expect(hits[0].offset).toBe(0);
    expect(hits[1].offset).toBe(source.lastIndexOf('const'));
  });

  it('accepts a non-global pattern and still finds every match', () => {
    const scan = scanBundle('a; a; a;');
    expect([...matchSpans(scan, ['code'], /a/)]).toHaveLength(3);
  });
});
