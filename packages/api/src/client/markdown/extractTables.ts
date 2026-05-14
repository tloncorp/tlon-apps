import type {
  Table as MdastTable,
  TableCell as MdastTableCell,
  TableRow as MdastTableRow,
  Paragraph,
  PhrasingContent,
  Root,
} from 'mdast';
import { gfmToMarkdown } from 'mdast-util-gfm';
import { toMarkdown } from 'mdast-util-to-markdown';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

import { assertNever } from '../../lib/assertNever';
import type {
  BlockData,
  InlineData,
  ParagraphBlockData,
  PostContent,
  TableAlignment,
  TableBlockData,
  TableRowData,
} from '../postContent';
import { convertInlineContent } from '../postContentInlines';
import { remarkGroupMentions } from './groupMentionPlugin';
import { phrasingToInlines } from './mdastToStory';
import { remarkShipMentions } from './shipMentionPlugin';

// Matches a GFM table separator row: `|---|---|`, `| :---: | ---: |`, etc.
// Requires at least one cell of three or more dashes, with optional alignment
// colons and surrounding whitespace.
const SEPARATOR_LINE =
  /^[ \t]*\|?[ \t]*:?-{3,}:?[ \t]*(\|[ \t]*:?-{3,}:?[ \t]*)*\|?[ \t]*$/;

// toMarkdown handlers for our custom inline node types. Registered on both
// directions (parse via remarkShipMentions / remarkGroupMentions, serialize
// via these handlers) so that ship and group mentions round-trip cleanly
// through the table-cell parse pipeline. Cast through `unknown` because
// mdast-util-to-markdown's `Handlers` only enumerates the canonical mdast
// types — our custom nodes aren't in the union.
const mentionHandlers = {
  handlers: {
    shipMention(node: { value: string }) {
      return `~${node.value}`;
    },
    groupMention(node: { value: string }) {
      return `@${node.value}`;
    },
  },
} as unknown as NonNullable<Parameters<typeof toMarkdown>[1]>;

// Convert one local InlineData node to an mdast PhrasingContent node.
// `task` doesn't have an inline mdast equivalent — GFM's task-list marker
// is only recognized at the start of a list item, not in arbitrary
// phrasing — so we degrade to plain text representing the marker. The
// structure is lost in the round trip; the rendered text is preserved.
function inlineDataToPhrasing(inline: InlineData): PhrasingContent {
  switch (inline.type) {
    case 'text':
      return { type: 'text', value: inline.text };
    case 'lineBreak':
      return { type: 'break' };
    case 'style': {
      const children = inline.children.map(inlineDataToPhrasing);
      switch (inline.style) {
        case 'bold':
          return { type: 'strong', children };
        case 'italic':
          return { type: 'emphasis', children };
        case 'strikethrough':
          return { type: 'delete', children };
        case 'code': {
          const text =
            inline.children[0]?.type === 'text' ? inline.children[0].text : '';
          return { type: 'inlineCode', value: text };
        }
        default:
          return assertNever(inline.style);
      }
    }
    case 'link':
      return {
        type: 'link',
        url: inline.href,
        children: [{ type: 'text', value: inline.text }],
      };
    case 'mention':
      return {
        type: 'shipMention',
        value: inline.contactId.replace(/^~/, ''),
      } as unknown as PhrasingContent;
    case 'groupMention':
      return {
        type: 'groupMention',
        value: inline.group,
      } as unknown as PhrasingContent;
    case 'task': {
      const inner = inline.children.map(inlineDataChildText).join('');
      return {
        type: 'text',
        value: `${inline.checked ? '[x]' : '[ ]'} ${inner}`,
      };
    }
  }
}

function inlineDataChildText(inline: InlineData): string {
  switch (inline.type) {
    case 'text':
      return inline.text;
    case 'lineBreak':
      return '\n';
    case 'style':
      return inline.children.map(inlineDataChildText).join('');
    case 'link':
      return inline.text;
    case 'mention':
      return inline.contactId;
    case 'groupMention':
      return `@${inline.group}`;
    case 'task':
      return `${inline.checked ? '[x]' : '[ ]'} ${inline.children
        .map(inlineDataChildText)
        .join('')}`;
  }
}

// Serializes a local InlineData back to its markdown source form.
//
// `text` is emitted verbatim because the wire format's `|` characters are
// load-bearing table syntax — escaping them would break detection. (Wire-
// format text that contains literal markdown syntax is an acknowledged
// edge case; structural inlines are emitted as proper InlineData and
// preserved through this function.)
//
// `lineBreak` is emitted as a literal `\n` so paragraphs reassemble into
// multi-line text the table regex can scan.
//
// Everything else goes through mdast-util-to-markdown + gfm so structural
// inlines (links, bold, mentions, …) get proper escaping and survive the
// round trip through remark-gfm without breaking the table grid.
function inlineDataToMarkdown(inline: InlineData): string {
  if (inline.type === 'text') return inline.text;
  if (inline.type === 'lineBreak') return '\n';
  const paragraph: Paragraph = {
    type: 'paragraph',
    children: [inlineDataToPhrasing(inline)],
  };
  const md = toMarkdown(paragraph, {
    extensions: [gfmToMarkdown(), mentionHandlers],
  });
  // Every `|` in `md` is content (cell delimiters live only in `text`
  // inlines, which take the early-return path above). Escape them so
  // remark-gfm doesn't treat e.g. inline code `awk -F | print` as a
  // cell boundary when this string gets reassembled into a row.
  return md.replace(/\n+$/, '').replace(/\|/g, '\\|');
}

const tableProcessor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkShipMentions)
  .use(remarkGroupMentions);

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

    const fullyContained = pos.start >= offsetStart && pos.end <= offsetEnd;

    if (fullyContained) {
      result.push(pos.inline);
    } else if (pos.inline.type === 'text') {
      // Region boundaries are at line edges and the inlines we serialize
      // (text, lineBreak as `\n`, structured-as-markdown) don't span lines,
      // so straddling shouldn't happen. Slice defensively if it ever does.
      const sliceStart = Math.max(0, offsetStart - pos.start);
      const sliceEnd = Math.min(pos.inline.text.length, offsetEnd - pos.start);
      const slicedText = pos.inline.text.slice(sliceStart, sliceEnd);
      if (slicedText) {
        result.push({ type: 'text', text: slicedText });
      }
    }
    // Non-text inlines that straddle are dropped — same rationale: they
    // shouldn't straddle a line edge in the first place.
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
  return inlines.every((i) => i.type === 'text' && i.text.trim() === '');
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
  // table (contains `|`, isn't blank), or -1 if no such line exists before
  // the next blank line. We deliberately don't check for `SEPARATOR_LINE`
  // here — a GFM table has only one separator row (between header and body),
  // so any later line that happens to match the separator pattern (e.g.
  // a data row with cells of `---`) is just another row.
  const nextTableLine = (from: number): number => {
    for (let k = from; k < lines.length; k++) {
      if (lines[k].trim() === '') return -1;
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
    // Once we're past the separator we don't bail on lines that also match
    // the separator pattern — see `nextTableLine` for the rationale.
    while (j < lines.length) {
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

function normalizeAlign(align: MdastTable['align']): (TableAlignment | null)[] {
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
//
// Only applied to tables that use outer pipes (separator line starts with
// `|`). GFM also allows tables to omit outer pipes — e.g. `A | B / ---|--- /
// 1 | 2` — and in that form data rows legitimately don't start with `|`, so
// merging them would corrupt the table.
function normalizeTableCandidate(text: string): string {
  const lines = text.split('\n');
  const sepIdx = lines.findIndex((l) => SEPARATOR_LINE.test(l));
  if (sepIdx === -1) return text;
  const usesOuterPipes = lines[sepIdx].trimStart().startsWith('|');
  if (!usesOuterPipes) return text;

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

function extractTablesFromParagraph(block: ParagraphBlockData): BlockData[] {
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
