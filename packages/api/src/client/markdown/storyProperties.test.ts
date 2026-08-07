import { expect, test } from 'vitest';

import type { Story } from '../../urbit/channel';
import type { Inline, Listing } from '../../urbit/content';
import { convertContent } from '../postContent';
import { markdownToStory } from './parse';
import { storyToMarkdown } from './serialize';

const SEED = 0x6248a11;
const CASES = 300;
const ships = ['~zod', '~bus', '~marzod', '~sampel-palnet'];
let state = SEED;
const pick = (limit: number) => {
  state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
  return state % limit;
};

function randomInline(depth = 0): Inline {
  const base: Inline[] = [
    `word${pick(97)}`,
    { break: null },
    { 'inline-code': `inline_${pick(97)}` },
    { code: `block_${pick(97)}` },
    { ship: ships[pick(ships.length)] },
  ];
  if (depth >= 2) return base[pick(base.length)];

  const children = () => randomInlines(depth + 1);
  const variants: Inline[] = [
    ...base,
    { bold: children() },
    { italics: children() },
    { strike: children() },
    { blockquote: children() },
    { code: { code: `lang_${pick(97)}`, lang: 'js' } } as unknown as Inline,
  ];
  return variants[pick(variants.length)];
}

function randomInlines(depth = 0): Inline[] {
  return Array.from({ length: 1 + pick(4) }, () => randomInline(depth));
}

type ListType = 'ordered' | 'unordered' | 'tasklist';
const listTypes: ListType[] = ['ordered', 'unordered', 'tasklist'];
const itemContent = (type: ListType): Inline[] =>
  type === 'tasklist'
    ? [{ task: { checked: pick(2) === 1, content: randomInlines() } }]
    : randomInlines();

function randomList(): Listing {
  const outerType = listTypes[pick(listTypes.length)];
  const childType = listTypes[pick(listTypes.length)];
  return {
    list: {
      type: outerType,
      contents: [],
      items: [
        { item: itemContent(outerType) },
        {
          list: {
            type: childType,
            contents: itemContent(outerType),
            items: [{ item: itemContent(childType) }],
          },
        },
      ],
    },
  };
}

const FORCED_CASES: Array<{ name: string; story: Story }> = [
  {
    // GFM permits mixing plain and checkbox items in one list; the wire
    // keeps the author's single list (adjacent lists re-merge on reparse,
    // so a homogeneous split cannot survive a cycle). The renderer draws a
    // bullet for a tasklist child with no task inline.
    name: 'mixed plain and task items in one list',
    story: [
      {
        block: {
          listing: {
            list: {
              type: 'tasklist',
              contents: [],
              items: [
                { item: ['plain'] },
                { item: [{ task: { checked: true, content: ['done'] } }] },
              ],
            },
          },
        },
      },
    ],
  },
  {
    name: 'adjacent bold and link-leading italics before a lifted break',
    story: [
      {
        inline: [
          { bold: ['first'] },
          {
            italics: [
              { link: { href: 'https://x.test', content: 'link' } },
              { break: null },
              'after',
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'marked link ending at a lifted break',
    story: [
      {
        inline: [
          'before',
          {
            italics: [
              { link: { href: 'https://x.test', content: 'link' } },
              { break: null },
              'after',
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'nested blockquote renderer',
    story: [
      {
        inline: [
          {
            blockquote: ['outer', { blockquote: ['inner'] }],
          },
        ],
      },
    ],
  },
  {
    name: 'task quote followed by marked phrasing',
    story: [
      {
        block: {
          listing: {
            list: {
              type: 'tasklist',
              contents: [],
              items: [
                {
                  item: [
                    {
                      task: {
                        checked: true,
                        content: [
                          { blockquote: ['quote'] },
                          { bold: ['after'] },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    ],
  },
];

test(`seeded Story invariants (seed ${SEED})`, () => {
  const sample = [
    ...FORCED_CASES.map(({ name, story }) => ({
      story,
      context: `seed=${SEED} forced=${name}`,
    })),
    ...Array.from({ length: CASES }, (_, index) => ({
      story: [
        { inline: randomInlines() },
        { block: { listing: randomList() } },
      ] as Story,
      context: `seed=${SEED} case=${index}`,
    })),
  ];

  for (const { story, context } of sample) {
    const once = storyToMarkdown(story);
    const reparsed = markdownToStory(once);
    const failureContext = `${context}\n${JSON.stringify(story)}`;

    expect(storyToMarkdown(reparsed), failureContext).toBe(once);
    expect(
      JSON.stringify(convertContent(reparsed, null)),
      failureContext
    ).not.toContain('Unknown content type');
    expect(once, failureContext).not.toMatch(/&#(?:x[\da-f]+|\d+);/i);
  }
});
