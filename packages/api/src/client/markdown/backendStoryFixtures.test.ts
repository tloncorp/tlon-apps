import type { Nodes } from 'mdast';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import type { Story } from '../../urbit/channel';
import { convertContent } from '../postContent';
import { markdownToStory } from './parse';
import { storyToMarkdown } from './serialize';
import { storyToMdast } from './storyToMdast';

const fixtureDirectory = join(process.cwd(), 'src/__tests__/fixtures');
const storyFixtures = Object.fromEntries(
  readdirSync(fixtureDirectory)
    .filter((file) => file.endsWith('.json'))
    .map((file) => [
      file,
      JSON.parse(readFileSync(join(fixtureDirectory, file), 'utf8')) as unknown,
    ])
) as Record<string, unknown>;

interface FixtureStory {
  fixture: string;
  path: string;
  story: Story;
}

type LiteralProperty = 'alt' | 'checked' | 'url' | 'value';
type LiteralValue = boolean | string;

interface PayloadExpectation {
  ancestors: string[];
  disposition: 'dropped' | 'preserved';
  markdownValue: string;
  mdastProperty?: LiteralProperty;
  mdastValue: LiteralValue;
  nodeType?: string;
  sourcePath: string;
  variant: string;
}

interface InlineContext {
  blockAncestors: string[];
  marks: string[];
  phrasingContainer: 'heading' | 'paragraph';
}

interface LocatedLiteral {
  ancestors: string[];
  nodeType: string;
  path: string;
  property: LiteralProperty;
  value: LiteralValue;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isVerse(value: unknown): boolean {
  if (!isRecord(value) || Object.keys(value).length !== 1) return false;
  return Array.isArray(value.inline) || isRecord(value.block);
}

function findFixtureStories(
  value: unknown,
  fixture: string,
  path = '$'
): FixtureStory[] {
  if (Array.isArray(value) && value.length > 0 && value.every(isVerse)) {
    return [{ fixture, path, story: value as Story }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((child, index) =>
      findFixtureStories(child, fixture, `${path}[${index}]`)
    );
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, child]) =>
      findFixtureStories(child, fixture, `${path}.${key}`)
    );
  }
  return [];
}

function phrasingAncestors(context: InlineContext): string[] {
  return [
    ...context.blockAncestors,
    context.phrasingContainer,
    ...context.marks,
  ];
}

function collectInlinePayloads(
  inlines: unknown[],
  payloads: PayloadExpectation[],
  sourcePath: string,
  context: InlineContext
): void {
  for (const [index, inline] of inlines.entries()) {
    const inlinePath = `${sourcePath}[${index}]`;

    if (typeof inline === 'string') {
      if (inline.length > 0) {
        payloads.push({
          ancestors: phrasingAncestors(context),
          disposition: 'preserved',
          markdownValue: inline,
          mdastProperty: 'value',
          mdastValue: inline,
          nodeType: 'text',
          sourcePath: inlinePath,
          variant: 'string',
        });
      }
      continue;
    }
    if (!isRecord(inline)) continue;

    if (Array.isArray(inline.bold)) {
      collectInlinePayloads(inline.bold, payloads, `${inlinePath}.bold`, {
        ...context,
        marks: [...context.marks, 'strong'],
      });
      continue;
    }
    if (Array.isArray(inline.italics)) {
      collectInlinePayloads(inline.italics, payloads, `${inlinePath}.italics`, {
        ...context,
        marks: [...context.marks, 'emphasis'],
      });
      continue;
    }
    if (Array.isArray(inline.strike)) {
      collectInlinePayloads(inline.strike, payloads, `${inlinePath}.strike`, {
        ...context,
        marks: [...context.marks, 'delete'],
      });
      continue;
    }
    if (Array.isArray(inline.blockquote)) {
      collectInlinePayloads(
        inline.blockquote,
        payloads,
        `${inlinePath}.blockquote`,
        {
          ...context,
          blockAncestors: [...context.blockAncestors, 'blockquote'],
          phrasingContainer: 'paragraph',
        }
      );
      continue;
    }

    if (isRecord(inline.task) && Array.isArray(inline.task.content)) {
      const checked = inline.task.checked === true;
      const inListItem =
        context.blockAncestors[context.blockAncestors.length - 1] ===
        'listItem';
      payloads.push({
        ancestors: inListItem
          ? context.blockAncestors.slice(0, -1)
          : phrasingAncestors(context),
        disposition: 'preserved',
        markdownValue: checked ? '[x]' : '[ ]',
        mdastProperty: inListItem ? 'checked' : 'value',
        mdastValue: inListItem ? checked : `${checked ? '[x]' : '[ ]'} `,
        nodeType: inListItem ? 'listItem' : 'html',
        sourcePath: `${inlinePath}.task.checked`,
        variant: 'task-checked',
      });
      collectInlinePayloads(
        inline.task.content,
        payloads,
        `${inlinePath}.task.content`,
        context
      );
      continue;
    }

    if (typeof inline['inline-code'] === 'string') {
      payloads.push({
        ancestors: phrasingAncestors(context),
        disposition: 'preserved',
        markdownValue: inline['inline-code'],
        mdastProperty: 'value',
        mdastValue: inline['inline-code'],
        nodeType: 'inlineCode',
        sourcePath: `${inlinePath}.inline-code`,
        variant: 'inline-code',
      });
      continue;
    }
    if (typeof inline.code === 'string') {
      payloads.push({
        ancestors: context.blockAncestors,
        disposition: 'preserved',
        markdownValue: inline.code,
        mdastProperty: 'value',
        mdastValue: inline.code,
        nodeType: 'code',
        sourcePath: `${inlinePath}.code`,
        variant: 'code',
      });
      continue;
    }
    if (typeof inline.ship === 'string') {
      const markdownValue = inline.ship.startsWith('~')
        ? inline.ship
        : `~${inline.ship}`;
      payloads.push({
        ancestors: phrasingAncestors(context),
        disposition: 'preserved',
        markdownValue,
        mdastProperty: 'value',
        mdastValue: inline.ship.replace(/^~/, ''),
        nodeType: 'shipMention',
        sourcePath: `${inlinePath}.ship`,
        variant: 'ship',
      });
      continue;
    }
    if (typeof inline.tag === 'string') {
      payloads.push({
        ancestors: phrasingAncestors(context),
        disposition: 'preserved',
        markdownValue: inline.tag,
        mdastProperty: 'value',
        mdastValue: inline.tag,
        nodeType: 'text',
        sourcePath: `${inlinePath}.tag`,
        variant: 'tag',
      });
      continue;
    }
    if ('sect' in inline) {
      const value =
        typeof inline.sect === 'string' && inline.sect.length > 0
          ? `@${inline.sect}`
          : '@all';
      payloads.push({
        ancestors: phrasingAncestors(context),
        disposition: 'preserved',
        markdownValue: value,
        mdastProperty: 'value',
        mdastValue: value,
        nodeType: 'text',
        sourcePath: `${inlinePath}.sect`,
        variant: 'sect',
      });
      continue;
    }
    if (isRecord(inline.link) && typeof inline.link.content === 'string') {
      payloads.push({
        ancestors: [...phrasingAncestors(context), 'link'],
        disposition: 'preserved',
        markdownValue: inline.link.content,
        mdastProperty: 'value',
        mdastValue: inline.link.content,
        nodeType: 'text',
        sourcePath: `${inlinePath}.link.content`,
        variant: 'link',
      });
      if (typeof inline.link.href === 'string') {
        payloads.push({
          ancestors: phrasingAncestors(context),
          disposition: 'preserved',
          markdownValue: inline.link.href,
          mdastProperty: 'url',
          mdastValue: inline.link.href,
          nodeType: 'link',
          sourcePath: `${inlinePath}.link.href`,
          variant: 'link-href',
        });
      }
      continue;
    }
    if (isRecord(inline.block) && typeof inline.block.text === 'string') {
      payloads.push({
        ancestors: phrasingAncestors(context),
        disposition: 'preserved',
        markdownValue: inline.block.text,
        mdastProperty: 'value',
        mdastValue: inline.block.text,
        nodeType: 'text',
        sourcePath: `${inlinePath}.block.text`,
        variant: 'block-reference',
      });
    }
  }
}

function collectListingPayloads(
  listing: unknown,
  payloads: PayloadExpectation[],
  sourcePath: string,
  parentListAncestors: string[]
): void {
  if (!isRecord(listing)) return;

  if (Array.isArray(listing.item)) {
    collectInlinePayloads(listing.item, payloads, `${sourcePath}.item`, {
      blockAncestors: [...parentListAncestors, 'listItem'],
      marks: [],
      phrasingContainer: 'paragraph',
    });
    return;
  }

  if (!isRecord(listing.list)) return;
  const parentItemAncestors = [...parentListAncestors, 'listItem'];
  if (Array.isArray(listing.list.contents)) {
    collectInlinePayloads(
      listing.list.contents,
      payloads,
      `${sourcePath}.list.contents`,
      {
        blockAncestors: parentItemAncestors,
        marks: [],
        phrasingContainer: 'paragraph',
      }
    );
  }
  if (Array.isArray(listing.list.items)) {
    for (const [index, item] of listing.list.items.entries()) {
      collectListingPayloads(
        item,
        payloads,
        `${sourcePath}.list.items[${index}]`,
        [...parentItemAncestors, 'list']
      );
    }
  }
}

function collectDroppedScalarPayloads(
  value: unknown,
  payloads: PayloadExpectation[],
  sourcePath: string,
  variant: string
): void {
  if (typeof value === 'string' && value.length > 0) {
    payloads.push({
      ancestors: [],
      disposition: 'dropped',
      markdownValue: value,
      mdastValue: value,
      sourcePath,
      variant,
    });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((child, index) =>
      collectDroppedScalarPayloads(
        child,
        payloads,
        `${sourcePath}[${index}]`,
        variant
      )
    );
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      collectDroppedScalarPayloads(
        child,
        payloads,
        `${sourcePath}.${key}`,
        variant
      );
    }
  }
}

function collectVersePayloads(
  verse: Story[number],
  sourcePath: string
): PayloadExpectation[] {
  const payloads: PayloadExpectation[] = [];
  if ('inline' in verse) {
    collectInlinePayloads(verse.inline, payloads, `${sourcePath}.inline`, {
      blockAncestors: [],
      marks: [],
      phrasingContainer: 'paragraph',
    });
    return payloads;
  }

  const block = verse.block as unknown as Record<string, unknown>;
  if (isRecord(block.header) && Array.isArray(block.header.content)) {
    collectInlinePayloads(
      block.header.content,
      payloads,
      `${sourcePath}.block.header.content`,
      {
        blockAncestors: [],
        marks: [],
        phrasingContainer: 'heading',
      }
    );
  }
  if (isRecord(block.code) && typeof block.code.code === 'string') {
    payloads.push({
      ancestors: [],
      disposition: 'preserved',
      markdownValue: block.code.code,
      mdastProperty: 'value',
      mdastValue: block.code.code,
      nodeType: 'code',
      sourcePath: `${sourcePath}.block.code.code`,
      variant: 'block-code',
    });
  }
  if (isRecord(block.image)) {
    if (typeof block.image.alt === 'string' && block.image.alt.length > 0) {
      payloads.push({
        ancestors: ['paragraph'],
        disposition: 'preserved',
        markdownValue: block.image.alt,
        mdastProperty: 'alt',
        mdastValue: block.image.alt,
        nodeType: 'image',
        sourcePath: `${sourcePath}.block.image.alt`,
        variant: 'image-alt',
      });
    }
    if (typeof block.image.src === 'string' && block.image.src.length > 0) {
      payloads.push({
        ancestors: ['paragraph'],
        disposition: 'preserved',
        markdownValue: block.image.src,
        mdastProperty: 'url',
        mdastValue: block.image.src,
        nodeType: 'image',
        sourcePath: `${sourcePath}.block.image.src`,
        variant: 'image-src',
      });
    }
  }
  if (isRecord(block.listing)) {
    if (isRecord(block.listing.list)) {
      if (Array.isArray(block.listing.list.contents)) {
        collectInlinePayloads(
          block.listing.list.contents,
          payloads,
          `${sourcePath}.block.listing.list.contents`,
          {
            blockAncestors: [],
            marks: [],
            phrasingContainer: 'paragraph',
          }
        );
      }
      if (Array.isArray(block.listing.list.items)) {
        for (const [index, item] of block.listing.list.items.entries()) {
          collectListingPayloads(
            item,
            payloads,
            `${sourcePath}.block.listing.list.items[${index}]`,
            ['list']
          );
        }
      }
    } else {
      collectListingPayloads(
        block.listing,
        payloads,
        `${sourcePath}.block.listing`,
        ['list']
      );
    }
  }
  if ('cite' in block) {
    collectDroppedScalarPayloads(
      block.cite,
      payloads,
      `${sourcePath}.block.cite`,
      'cite'
    );
  }
  if (isRecord(block.link) && typeof block.link.url === 'string') {
    collectDroppedScalarPayloads(
      block.link,
      payloads,
      `${sourcePath}.block.link`,
      'link-block'
    );
  }
  return payloads;
}

function collectStoryPayloads(
  story: Story,
  sourcePath: string
): PayloadExpectation[][] {
  return story.map((verse, verseIndex) =>
    collectVersePayloads(verse, `${sourcePath}[${verseIndex}]`)
  );
}

function locateMdastLiterals(
  nodes: Nodes[],
  ancestors: string[] = [],
  path = '$'
): LocatedLiteral[] {
  const literals: LocatedLiteral[] = [];
  for (const [index, node] of nodes.entries()) {
    const nodePath = `${path}[${index}]`;
    const record = node as unknown as Record<string, unknown>;
    const nodeType = node.type;

    for (const property of [
      'alt',
      'checked',
      'url',
      'value',
    ] as LiteralProperty[]) {
      const value = record[property];
      if (typeof value === 'string' || typeof value === 'boolean') {
        literals.push({
          ancestors,
          nodeType,
          path: `${nodePath}.${property}`,
          property,
          value,
        });
      }
    }

    if ('children' in node && Array.isArray(node.children)) {
      literals.push(
        ...locateMdastLiterals(
          node.children as Nodes[],
          [...ancestors, nodeType],
          `${nodePath}.children`
        )
      );
    }
  }
  return literals;
}

function samePath(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((segment, index) => segment === right[index])
  );
}

function normalizeMarkdown(markdown: string): string {
  return markdown
    .replace(/&#x20;/g, ' ')
    .replace(/\\([^\n])/g, '$1')
    .replace(/\\\n/g, '\n');
}

const stories = Object.entries(storyFixtures).flatMap(([fixture, value]) =>
  findFixtureStories(value, fixture)
);

describe('backend Story wire regression', () => {
  test('discovers checked-in backend Stories', () => {
    expect(stories.length).toBeGreaterThan(0);
  });

  test('discovers the hand-authored-but-wire-exact coverage fixture', () => {
    expect(
      stories.some(
        ({ fixture }) =>
          fixture === 'hand-authored-wire-exact-story-variants.json'
      )
    ).toBe(true);
  });

  test('serializes every fixture Story idempotently', () => {
    for (const row of stories) {
      const once = storyToMarkdown(row.story);
      const twice = storyToMarkdown(markdownToStory(once));
      expect(
        twice,
        `${row.fixture} ${row.path}\n${JSON.stringify(row.story)}`
      ).toBe(once);
    }
  });

  test('re-parses every fixture Story into renderable content', () => {
    for (const row of stories) {
      const markdown = storyToMarkdown(row.story);
      const reparsed = markdownToStory(markdown);
      expect(
        JSON.stringify(convertContent(reparsed, null)),
        `${row.fixture} ${row.path}\n${JSON.stringify(row.story)}`
      ).not.toContain('Unknown content type');
    }
  });

  test.each(stories)(
    '$fixture $path preserves every payload at its structural path',
    (row) => {
      const payloadsByVerse = collectStoryPayloads(row.story, row.path);
      for (const [verseIndex, verse] of row.story.entries()) {
        const mdast = storyToMdast([verse], { strict: true });
        const markdown = normalizeMarkdown(
          storyToMarkdown([verse], { strict: true })
        );
        const availableLiterals = locateMdastLiterals(mdast as Nodes[]);

        for (const payload of payloadsByVerse[verseIndex]) {
          const errorContext = `${row.fixture} ${payload.sourcePath} ${payload.variant}`;

          if (payload.disposition === 'dropped') {
            expect(
              availableLiterals.some(
                (literal) =>
                  typeof literal.value === 'string' &&
                  typeof payload.mdastValue === 'string' &&
                  literal.value.includes(payload.mdastValue)
              ),
              `${errorContext} unexpectedly survived in mdast`
            ).toBe(false);
            expect(
              markdown,
              `${errorContext} unexpectedly survived in Markdown`
            ).not.toContain(normalizeMarkdown(payload.markdownValue));
            continue;
          }

          const literalIndex = availableLiterals.findIndex(
            (literal) =>
              literal.nodeType === payload.nodeType &&
              literal.property === payload.mdastProperty &&
              literal.value === payload.mdastValue &&
              samePath(literal.ancestors, payload.ancestors)
          );
          expect(
            literalIndex,
            `${errorContext} missing at mdast ancestry ${payload.ancestors.join(' > ')}`
          ).toBeGreaterThanOrEqual(0);
          if (literalIndex >= 0) {
            availableLiterals.splice(literalIndex, 1);
          }

          expect(markdown, `${errorContext} missing from Markdown`).toContain(
            normalizeMarkdown(payload.markdownValue)
          );
        }
      }
    }
  );
});
