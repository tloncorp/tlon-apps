import {
  BlockData,
  InlineData,
  ParagraphBlockData,
  PostContent,
  TableAlignment,
  TableBlockData,
  TableRowData,
  convertContentRaw,
  convertInlineContent,
} from '@tloncorp/api/client/postContent';
import type {
  Root,
  Table as MdastTable,
  TableCell as MdastTableCell,
  TableRow as MdastTableRow,
} from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { phrasingToInlines } from './mdastToStory';
import { remarkShipMentions } from './shipMentionPlugin';

// Matches a GFM table separator row: `|---|---|`, `| :---: | ---: |`, etc.
// Requires at least one cell of three or more dashes, with optional alignment
// colons and surrounding whitespace.
const SEPARATOR_LINE =
  /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/;

// Serializes a local InlineData back to its markdown source form. Used when
// reassembling paragraph text for table detection so that structured inlines
// inside a table cell (bold, links, mentions) survive the round trip through
// remark-gfm — they get re-parsed as proper mdast nodes and emerge as
// structured cell content again.
function inlineDataToMarkdown(inline: InlineData): string {
  switch (inline.type) {
    case 'text':
      return inline.text;
    case 'lineBreak':
      return '\n';
    case 'style': {
      const inner = inline.children.map(inlineDataToMarkdown).join('');
      switch (inline.style) {
        case 'bold':
          return `**${inner}**`;
        case 'italic':
          return `*${inner}*`;
        case 'strikethrough':
          return `~~${inner}~~`;
        case 'code':
          return `\`${inner}\``;
      }
    }
    // eslint-disable-next-line no-fallthrough
    case 'link':
      return `[${inline.text}](${inline.href})`;
    case 'mention':
      return inline.contactId;
    case 'groupMention':
      return `@${inline.group}`;
    case 'task': {
      const inner = inline.children.map(inlineDataToMarkdown).join('');
      return `${inline.checked ? '[x]' : '[ ]'} ${inner}`;
    }
  }
}

const tableProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkShipMentions);

type InlineMapping = {
  text: string;
  positions: Array<{ start: number; end: number; inline: InlineData }>;
};

function inlinesToText(inlines: InlineData[]): InlineMapping {
  let text = '';
  const positions: InlineMapping['positions'] = [];
  for (const inline of inlines) {
    const start = text.length;
    text += inlineDataToMarkdown(inline);
    positions.push({ start, end: text.length, inline });
  }
  return { text, positions };
}

function sliceInlines(
  positions: InlineMapping['positions'],
  offsetStart: number,
  offsetEnd: number
): InlineData[] {
  const result: InlineData[] = [];
  for (const pos of positions) {
    if (pos.end <= offsetStart) continue;
    if (pos.start >= offsetEnd) continue;

    const fullyContained =
      pos.start >= offsetStart && pos.end <= offsetEnd;

    if (fullyContained) {
      result.push(pos.inline);
    } else if (pos.inline.type === 'text') {
      // Only text inlines can straddle a boundary (lineBreaks and structured
      // placeholders are single-character).
      const sliceStart = Math.max(0, offsetStart - pos.start);
      const sliceEnd = Math.min(pos.inline.text.length, offsetEnd - pos.start);
      const slicedText = pos.inline.text.slice(sliceStart, sliceEnd);
      if (slicedText) {
        result.push({ type: 'text', text: slicedText });
      }
    }
    // Non-text inlines that aren't fully contained are skipped — but this
    // shouldn't happen since they're single-character placeholders.
  }
  return result;
}

function trimEdgeLineBreaks(
  inlines: InlineData[],
  side: 'leading' | 'trailing' | 'both'
): InlineData[] {
  let start = 0;
  let end = inlines.length;
  if (side === 'leading' || side === 'both') {
    while (start < end && inlines[start].type === 'lineBreak') start++;
  }
  if (side === 'trailing' || side === 'both') {
    while (end > start && inlines[end - 1].type === 'lineBreak') end--;
  }
  return inlines.slice(start, end);
}

function isEffectivelyEmpty(inlines: InlineData[]): boolean {
  return inlines.every(
    (i) => i.type === 'text' && i.text.trim() === ''
  );
}

type Region = { start: number; end: number };

function findTableRegions(text: string): Region[] {
  const regions: Region[] = [];
  const lines = text.split('\n');

  const lineStarts: number[] = [];
  let off = 0;
  for (const line of lines) {
    lineStarts.push(off);
    off += line.length + 1;
  }

  // Returns the index of the next line whose contents look like part of the
  // table (contains `|`, isn't blank, isn't another separator), or -1 if
  // no such line exists before the next blank line.
  const nextTableLine = (from: number): number => {
    for (let k = from; k < lines.length; k++) {
      if (lines[k].trim() === '') return -1;
      if (SEPARATOR_LINE.test(lines[k])) return -1;
      if (lines[k].includes('|')) return k;
    }
    return -1;
  };

  let i = 0;
  while (i < lines.length) {
    const isSeparator =
      i > 0 && SEPARATOR_LINE.test(lines[i]) && lines[i - 1].includes('|');

    if (!isSeparator) {
      i++;
      continue;
    }

    const headerLineIdx = i - 1;
    let endLineIdx = i;
    let j = i + 1;
    while (j < lines.length && !SEPARATOR_LINE.test(lines[j])) {
      if (lines[j].includes('|')) {
        endLineIdx = j;
        j++;
        continue;
      }
      // Non-pipe line: only a continuation if another pipe row follows
      // before a blank line.
      if (lines[j].trim() === '') break;
      if (nextTableLine(j + 1) === -1) break;
      j++;
    }

    const start = lineStarts[headerLineIdx];
    const end = lineStarts[endLineIdx] + lines[endLineIdx].length;
    regions.push({ start, end });
    i = j;
  }

  return regions;
}

function normalizeAlign(
  align: MdastTable['align']
): (TableAlignment | null)[] {
  if (!align) return [];
  return align.map((a) =>
    a === 'left' || a === 'center' || a === 'right' ? a : null
  );
}

function mdastCellToCellData(cell: MdastTableCell) {
  const inlines = convertInlineContent(phrasingToInlines(cell.children));
  return { content: inlines };
}

function mdastRowToRowData(row: MdastTableRow): TableRowData {
  return {
    cells: row.children.map(mdastCellToCellData),
  };
}

function mdastTableToBlockData(node: MdastTable): TableBlockData {
  const rows = node.children.map(mdastRowToRowData);
  const header: TableRowData = rows[0] ?? { cells: [] };
  return {
    type: 'table',
    header,
    rows: rows.slice(1),
    align: normalizeAlign(node.align),
  };
}

// Merges continuation lines into their preceding row. Bots that soft-wrap
// long cell content emit lines that don't start with `|` mid-table; without
// this, remark-gfm treats those fragments as phantom one-cell rows and the
// wrapped portion of the real row's last cell is lost.
function normalizeTableCandidate(text: string): string {
  const lines = text.split('\n');
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    if (i === 0 || trimmed.startsWith('|') || SEPARATOR_LINE.test(line)) {
      out.push(line);
    } else {
      const prev = out.pop() ?? '';
      out.push(prev + ' ' + trimmed);
    }
  }
  return out.join('\n');
}

function parseTableCandidate(text: string): MdastTable | null {
  const normalized = normalizeTableCandidate(text);
  let tree: Root;
  try {
    tree = tableProcessor.parse(normalized) as Root;
    tableProcessor.runSync(tree);
  } catch {
    return null;
  }
  // Expect exactly one child, a table node. If remark parsed it as something
  // else (e.g., a paragraph), the candidate isn't a real table.
  if (tree.children.length !== 1) return null;
  const first = tree.children[0];
  if (first.type !== 'table') return null;
  return first as MdastTable;
}

function extractTablesFromParagraph(
  block: ParagraphBlockData
): BlockData[] {
  const mapping = inlinesToText(block.content);
  const regions = findTableRegions(mapping.text);
  if (regions.length === 0) return [block];

  const out: BlockData[] = [];
  let cursor = 0;
  let tableEmitted = false;

  for (const region of regions) {
    const candidateText = mapping.text.slice(region.start, region.end);
    const tableNode = parseTableCandidate(candidateText);
    if (!tableNode) continue;

    if (region.start > cursor) {
      const preInlines = trimEdgeLineBreaks(
        sliceInlines(mapping.positions, cursor, region.start),
        'trailing'
      );
      if (preInlines.length > 0 && !isEffectivelyEmpty(preInlines)) {
        out.push({ type: 'paragraph', content: preInlines });
      }
    }

    out.push(mdastTableToBlockData(tableNode));
    tableEmitted = true;
    cursor = region.end;
  }

  if (!tableEmitted) return [block];

  if (cursor < mapping.text.length) {
    const postInlines = trimEdgeLineBreaks(
      sliceInlines(mapping.positions, cursor, mapping.text.length),
      'leading'
    );
    if (postInlines.length > 0 && !isEffectivelyEmpty(postInlines)) {
      out.push({ type: 'paragraph', content: postInlines });
    }
  }

  return out;
}

export function extractTablesFromContent(content: PostContent): PostContent {
  const out: PostContent = [];
  for (const block of content) {
    if (block.type === 'paragraph') {
      out.push(...extractTablesFromParagraph(block));
    } else {
      out.push(block);
    }
  }
  return out;
}

export function convertContent(
  input: unknown,
  blob: string | undefined | null
): PostContent {
  return extractTablesFromContent(convertContentRaw(input, blob));
}
