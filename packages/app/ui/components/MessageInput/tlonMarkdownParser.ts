import type {
  MarkdownRange,
  MarkdownType,
} from '@expensify/react-native-live-markdown';

// Scans raw markdown directly into MarkdownRange[] in Tlon's dialect (matching
// markdownToStory / remark + GFM, NOT ExpensiMark's). For each construct it
// emits a content range over the inner text and `syntax` ranges over the
// markers, so the markers dim the way the live editor expects.
//
// Headings render as `h1` (the only heading range type the installed renderer
// has). Mentions are NOT handled here — they are highlighted separately by
// entity range and merged by the caller.
//
// Tagged 'worklet' so it can run inside the MarkdownTextInput parser; the
// directive is inert off-worklet (e.g. in tests).
export function parseTlonMarkdownRanges(text: string): MarkdownRange[] {
  'worklet';
  const ranges: MarkdownRange[] = [];
  const len = text.length;

  // Tracks chars already consumed by an earlier (higher-priority) construct,
  // so e.g. emphasis is not parsed inside code spans.
  const claimed: boolean[] = [];
  for (let i = 0; i < len; i++) {
    claimed[i] = false;
  }
  const isFree = (start: number, end: number): boolean => {
    for (let i = start; i < end; i++) {
      if (claimed[i]) {
        return false;
      }
    }
    return true;
  };
  const claim = (start: number, end: number): void => {
    for (let i = start; i < end; i++) {
      claimed[i] = true;
    }
  };
  const push = (type: MarkdownType, start: number, length: number): void => {
    if (length > 0) {
      ranges.push({ type, start, length });
    }
  };

  let m: RegExpExecArray | null;

  // Fenced code block: ```lang\n ... ```
  const fenceRe = /```[^\n]*\n([\s\S]*?)```/g;
  while ((m = fenceRe.exec(text)) !== null) {
    const start = m.index;
    const whole = m[0];
    const openLen = whole.indexOf('\n') + 1; // ```lang\n
    const end = start + whole.length;
    push('syntax', start, openLen);
    push('pre', start + openLen, whole.length - openLen - 3);
    push('syntax', end - 3, 3);
    claim(start, end);
  }

  // Inline code: `...`
  const codeRe = /`([^`\n]+)`/g;
  while ((m = codeRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isFree(start, end)) {
      codeRe.lastIndex = start + 1;
      continue;
    }
    push('syntax', start, 1);
    push('code', start + 1, m[1].length);
    push('syntax', end - 1, 1);
    claim(start, end);
  }

  // Headings: ^#{1,6} content  -> h1..h6 by the number of leading #
  const headingTypes = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;
  const headingRe = /^(#{1,6}) (.+)$/gm;
  while ((m = headingRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isFree(start, end)) {
      headingRe.lastIndex = start + 1;
      continue;
    }
    const markerLen = m[1].length + 1; // "### "
    push('syntax', start, markerLen);
    push(headingTypes[m[1].length - 1], start + markerLen, m[2].length);
    claim(start, end);
  }

  // Blockquote: ^> content. The blockquote range must span the whole line
  // (including the `> ` marker) and carry depth=1, because the native side draws
  // the side bar from the depth attribute at the line's start glyph. The `syntax`
  // range still dims the marker; the content is left unclaimed so inline emphasis
  // inside the quote still applies.
  const quoteRe = /^(>) (.+)$/gm;
  while ((m = quoteRe.exec(text)) !== null) {
    const start = m.index;
    if (!isFree(start, start + 2)) {
      continue;
    }
    push('syntax', start, 2); // "> "
    ranges.push({
      type: 'blockquote',
      start,
      length: m[0].length,
      depth: 1,
    });
    claim(start, start + 2);
  }

  // Bold: **...** / __...__
  const boldRe = /(\*\*|__)([^*_\n]+)\1/g;
  while ((m = boldRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isFree(start, end)) {
      boldRe.lastIndex = start + 1;
      continue;
    }
    push('syntax', start, 2);
    push('bold', start + 2, m[2].length);
    push('syntax', end - 2, 2);
    claim(start, end);
  }

  // Italic: *...* / _..._
  const italicRe = /(\*|_)([^*_\n]+)\1/g;
  while ((m = italicRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isFree(start, end)) {
      italicRe.lastIndex = start + 1;
      continue;
    }
    // Skip intra-word underscores (e.g. snake_case) — only `_` at word edges.
    if (m[1] === '_') {
      const before = start > 0 ? text[start - 1] : '';
      const after = end < len ? text[end] : '';
      if (/[A-Za-z0-9]/.test(before) || /[A-Za-z0-9]/.test(after)) {
        continue;
      }
    }
    push('syntax', start, 1);
    push('italic', start + 1, m[2].length);
    push('syntax', end - 1, 1);
    claim(start, end);
  }

  // Strikethrough: ~~...~~
  const strikeRe = /~~([^~\n]+)~~/g;
  while ((m = strikeRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isFree(start, end)) {
      strikeRe.lastIndex = start + 1;
      continue;
    }
    push('syntax', start, 2);
    push('strikethrough', start + 2, m[1].length);
    push('syntax', end - 2, 2);
    claim(start, end);
  }

  // Links: [text](url)
  const linkRe = /\[([^\]\n]*)\]\(([^)\n]+)\)/g;
  while ((m = linkRe.exec(text)) !== null) {
    const start = m.index;
    const end = start + m[0].length;
    if (!isFree(start, end)) {
      linkRe.lastIndex = start + 1;
      continue;
    }
    const textLen = m[1].length;
    const urlLen = m[2].length;
    push('syntax', start, 1); // [
    push('link', start + 1, textLen);
    push('syntax', start + 1 + textLen, 2); // ](
    push('link', start + 1 + textLen + 2, urlLen);
    push('syntax', end - 1, 1); // )
    claim(start, end);
  }

  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}
