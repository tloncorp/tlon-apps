/**
 * A small JavaScript source scanner for the surface publish gate.
 *
 * Every lexical rule in the gate needs to know whether a match sits in
 * executable code, in a string, in template markup, or in a comment — a
 * naive regex over raw source flags `// we do not fetch here` and misses
 * `html\`<a href=...>\``. This scanner splits a bundle into spans so each
 * rule can ask its question of the right slice:
 *
 * - `code`          — executable positions (including `${…}` interpolations)
 * - `string`        — a `'…'` / `"…"` literal, delimiters included
 * - `template-text` — the literal chunks of a template literal, which is
 *                     where htm markup lives; `${…}` inside is `code`
 * - `line-comment` / `block-comment` — never linted for behavior, and
 *                     deliberately excluded from the jargon rule (D55 is
 *                     about copy a member reads, not about notes to self)
 * - `regex`         — regex literals, so `/fetch/` is not a forbidden call
 *
 * This is a lexer, not a parser: it has no AST and makes exactly one
 * documented guess, the classic regex-vs-division ambiguity. A `/` after
 * `)` or `]` is read as division, so `if (x) /re/.test(y)` would be
 * mis-scanned. Bundles are generated from templates that never write that,
 * and the failure mode is a false positive on a forbidden-API name inside
 * a regex, not a missed violation.
 */

export type SurfaceSpanKind =
  | 'code'
  | 'string'
  | 'template-text'
  | 'line-comment'
  | 'block-comment'
  | 'regex';

export interface SurfaceSourceSpan {
  kind: SurfaceSpanKind;
  /** UTF-16 offset of the first character */
  start: number;
  /** UTF-16 offset one past the last character */
  end: number;
  text: string;
}

export interface ScannedBundle {
  source: string;
  spans: SurfaceSourceSpan[];
  /** 1-based line number for a source offset */
  lineAt(offset: number): number;
  /** 1-based column number for a source offset */
  columnAt(offset: number): number;
}

/**
 * Keywords after which a `/` starts a regex literal rather than a division.
 * The set is deliberately small: anything not listed and not punctuation is
 * treated as the end of an operand, so `/` divides.
 */
const REGEX_PRECEDING_KEYWORDS = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'case',
  'delete',
  'void',
  'new',
  'do',
  'else',
  'yield',
  'await',
  'throw',
]);

function isWordChar(char: string): boolean {
  return /[A-Za-z0-9_$]/.test(char);
}

function regexCanStartAt(source: string, index: number): boolean {
  let i = index - 1;
  while (i >= 0 && /\s/.test(source[i])) {
    i--;
  }
  if (i < 0) {
    return true;
  }
  const char = source[i];
  if (char === ')' || char === ']') {
    return false;
  }
  if (isWordChar(char)) {
    let start = i;
    while (start >= 0 && isWordChar(source[start])) {
      start--;
    }
    const word = source.slice(start + 1, i + 1);
    return REGEX_PRECEDING_KEYWORDS.has(word);
  }
  return true;
}

type Frame =
  | { kind: 'code'; braceDepth: number; interpolation: boolean }
  | { kind: 'template' };

export function scanBundle(source: string): ScannedBundle {
  const spans: SurfaceSourceSpan[] = [];
  const stack: Frame[] = [
    { kind: 'code', braceDepth: 0, interpolation: false },
  ];
  let runStart = 0;
  let i = 0;

  const flush = (kind: SurfaceSpanKind, end: number) => {
    if (end > runStart) {
      spans.push({
        kind,
        start: runStart,
        end,
        text: source.slice(runStart, end),
      });
    }
  };

  const emit = (kind: SurfaceSpanKind, start: number, end: number) => {
    spans.push({ kind, start, end, text: source.slice(start, end) });
  };

  while (i < source.length) {
    const frame = stack[stack.length - 1];
    const char = source[i];

    if (frame.kind === 'template') {
      if (char === '\\') {
        i += 2;
        continue;
      }
      if (char === '`') {
        flush('template-text', i);
        stack.pop();
        i += 1;
        runStart = i;
        continue;
      }
      if (char === '$' && source[i + 1] === '{') {
        flush('template-text', i);
        stack.push({ kind: 'code', braceDepth: 0, interpolation: true });
        i += 2;
        runStart = i;
        continue;
      }
      i += 1;
      continue;
    }

    // code frame
    if (char === '/' && source[i + 1] === '/') {
      flush('code', i);
      const start = i;
      while (i < source.length && source[i] !== '\n') {
        i++;
      }
      emit('line-comment', start, i);
      runStart = i;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      flush('code', i);
      const start = i;
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === '/')
      ) {
        i++;
      }
      i = Math.min(i + 2, source.length);
      emit('block-comment', start, i);
      runStart = i;
      continue;
    }
    if (char === "'" || char === '"') {
      flush('code', i);
      const quote = char;
      const start = i;
      i += 1;
      while (i < source.length) {
        if (source[i] === '\\') {
          i += 2;
          continue;
        }
        if (source[i] === quote || source[i] === '\n') {
          break;
        }
        i += 1;
      }
      i = Math.min(i + 1, source.length);
      emit('string', start, i);
      runStart = i;
      continue;
    }
    if (char === '`') {
      flush('code', i);
      stack.push({ kind: 'template' });
      i += 1;
      runStart = i;
      continue;
    }
    if (char === '/' && regexCanStartAt(source, i)) {
      flush('code', i);
      const start = i;
      i += 1;
      let inClass = false;
      while (i < source.length) {
        const current = source[i];
        if (current === '\\') {
          i += 2;
          continue;
        }
        if (current === '\n') {
          break;
        }
        if (current === '[') {
          inClass = true;
        } else if (current === ']') {
          inClass = false;
        } else if (current === '/' && !inClass) {
          break;
        }
        i += 1;
      }
      i = Math.min(i + 1, source.length);
      // trailing flags
      while (i < source.length && /[a-z]/.test(source[i])) {
        i++;
      }
      emit('regex', start, i);
      runStart = i;
      continue;
    }
    if (char === '{') {
      frame.braceDepth += 1;
      i += 1;
      continue;
    }
    if (char === '}') {
      if (frame.braceDepth === 0 && frame.interpolation) {
        flush('code', i);
        stack.pop();
        i += 1;
        runStart = i;
        continue;
      }
      if (frame.braceDepth > 0) {
        frame.braceDepth -= 1;
      }
      i += 1;
      continue;
    }
    i += 1;
  }

  const tail = stack[stack.length - 1];
  flush(tail.kind === 'template' ? 'template-text' : 'code', source.length);

  const lineStarts: number[] = [0];
  for (let index = 0; index < source.length; index++) {
    if (source[index] === '\n') {
      lineStarts.push(index + 1);
    }
  }

  const lineIndexAt = (offset: number): number => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (lineStarts[mid] <= offset) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    return low;
  };

  return {
    source,
    spans,
    lineAt(offset: number) {
      return lineIndexAt(offset) + 1;
    },
    columnAt(offset: number) {
      return offset - lineStarts[lineIndexAt(offset)] + 1;
    },
  };
}

export interface SpanMatch {
  span: SurfaceSourceSpan;
  match: RegExpExecArray;
  /** absolute offset of the match in the scanned source */
  offset: number;
}

/**
 * Runs a regex over every span of the given kinds, yielding absolute
 * offsets. The pattern is re-created per span so callers can pass a shared
 * (global) regex without `lastIndex` leaking between spans.
 */
export function* matchSpans(
  scan: ScannedBundle,
  kinds: readonly SurfaceSpanKind[],
  pattern: RegExp
): Generator<SpanMatch> {
  const flags = pattern.flags.includes('g')
    ? pattern.flags
    : `${pattern.flags}g`;
  for (const span of scan.spans) {
    if (!kinds.includes(span.kind)) {
      continue;
    }
    const regex = new RegExp(pattern.source, flags);
    let match = regex.exec(span.text);
    while (match !== null) {
      yield { span, match, offset: span.start + match.index };
      if (match[0].length === 0) {
        regex.lastIndex += 1;
      }
      match = regex.exec(span.text);
    }
  }
}
