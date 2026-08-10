import { describe, expect, test } from 'vitest';

import type { Story } from '../../urbit/channel';
import {
  Block,
  BlockCode,
  BlockReference,
  Blockquote,
  Bold,
  Inline,
  List,
  ListItem,
  Sect,
  Ship,
  Tag,
  Task,
} from '../../urbit/content';
import { markdownToStory } from './parse';
import { storyToMarkdown } from './serialize';
import { inlinesToPhrasing, storyToMdast } from './storyToMdast';

function textValues(nodes: { type: string; value?: string }[]): string[] {
  return nodes
    .filter((n) => n.type === 'text')
    .map((n) => (n as { value: string }).value);
}

describe('Sect / Tag / BlockReference emission', () => {
  test('Sect with null emits @all', () => {
    const inlines: Inline[] = [{ sect: null } as Sect];
    const result = inlinesToPhrasing(inlines);
    expect(textValues(result)).toEqual(['@all']);
  });

  test('Sect with empty string emits @all', () => {
    const inlines: Inline[] = [{ sect: '' } as Sect];
    const result = inlinesToPhrasing(inlines);
    expect(textValues(result)).toEqual(['@all']);
  });

  test('Sect with named role emits @role', () => {
    const inlines: Inline[] = [{ sect: 'admin' } as Sect];
    const result = inlinesToPhrasing(inlines);
    expect(textValues(result)).toEqual(['@admin']);
  });

  test('Tag emits its text', () => {
    const inlines: Inline[] = [{ tag: '#general' } as Tag];
    const result = inlinesToPhrasing(inlines);
    expect(textValues(result)).toEqual(['#general']);
  });

  test('BlockReference emits block.text', () => {
    const inlines: Inline[] = [
      { block: { index: 0, text: 'see above' } } as BlockReference,
    ];
    const result = inlinesToPhrasing(inlines);
    expect(textValues(result)).toEqual(['see above']);
  });
});

describe('Ship emission', () => {
  test('normalizes a backend-shaped ship to a bare mdast mention value', () => {
    const result = inlinesToPhrasing([{ ship: '~zod' } as Ship]);
    expect(result).toEqual([{ type: 'shipMention', value: 'zod' }]);
  });
});

describe('nesting', () => {
  test('Sect inside Bold inside Blockquote survives', () => {
    const inlines: Inline[] = [
      {
        blockquote: [
          {
            bold: [{ sect: 'admin' } as Sect],
          } as Bold,
        ],
      } as Blockquote,
    ];
    const result = inlinesToPhrasing(inlines);
    const html = result.find((n) => n.type === 'html') as {
      value: string;
    };
    expect(html).toBeDefined();
    expect(html.value).toContain('@admin');
    expect(html.value).toContain('**');
  });

  test('the non-strict phrasing bridge preserves ship mentions', () => {
    const result = inlinesToPhrasing([
      {
        blockquote: ['quoted ', { ship: '~zod' } as Ship],
      } as Blockquote,
    ]);

    expect(result).toEqual([{ type: 'html', value: '> quoted ~zod' }]);
  });

  test('serializes a backend-shaped inline %code as a fenced code block', () => {
    const story: Story = [
      {
        inline: [{ code: 'a\nb' } as BlockCode],
      },
    ];

    expect(storyToMarkdown(story, { strict: true })).toBe('```\na\nb\n```');
  });

  test('keeps quote to ship structural', () => {
    const story = [
      {
        inline: [
          {
            blockquote: [{ ship: '~zod' } as Ship],
          } as Blockquote,
        ],
      },
    ];

    expect(storyToMdast(story, { strict: true })).toEqual([
      {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'shipMention', value: 'zod' }],
          },
        ],
      },
    ]);
  });

  test('lifts bold to quote to ship while preserving the mark', () => {
    const story = [
      {
        inline: [
          {
            bold: [
              {
                blockquote: [{ ship: '~zod' } as Ship],
              } as Blockquote,
            ],
          } as Bold,
        ],
      },
    ];

    expect(storyToMdast(story, { strict: true })).toEqual([
      {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [
              {
                type: 'strong',
                children: [{ type: 'shipMention', value: 'zod' }],
              },
            ],
          },
        ],
      },
    ]);
  });

  test('keeps a quote in a list item as a blockquote child', () => {
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered' as const,
              contents: [],
              items: [{ item: [{ blockquote: ['listed quote'] }] }],
            },
          },
        },
      },
    ];

    const mdast = storyToMdast(story, { strict: true });
    expect(mdast[0]).toMatchObject({
      type: 'list',
      children: [
        {
          type: 'listItem',
          children: [
            {
              type: 'blockquote',
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', value: 'listed quote' }],
                },
              ],
            },
          ],
        },
      ],
    });
  });

  test('keeps nested blockquotes structurally nested', () => {
    const story = [
      {
        inline: [
          {
            blockquote: ['outer', { blockquote: ['inner'] } as Blockquote],
          } as Blockquote,
        ],
      },
    ];

    const mdast = storyToMdast(story, { strict: true });
    expect(mdast).toEqual([
      {
        type: 'blockquote',
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', value: 'outer' }],
          },
          {
            type: 'blockquote',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'inner' }],
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe('repeated Story and Markdown conversion', () => {
  test.each([
    {
      name: 'nested blockquotes',
      story: [
        {
          inline: [
            {
              blockquote: ['outer', { blockquote: ['inner'] } as Blockquote],
            } as Blockquote,
          ],
        },
      ] as Story,
    },
    {
      name: 'code inside a blockquote',
      story: [
        {
          inline: [
            {
              blockquote: ['before', { code: 'quoted-code()' } as BlockCode],
            } as Blockquote,
          ],
        },
      ] as Story,
    },
    {
      name: 'code inside task content',
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
                            'before',
                            { code: 'task-code()' } as BlockCode,
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
      ] as Story,
    },
  ])('is idempotent from cycle 2 onward for $name', ({ story }) => {
    const firstMarkdown = storyToMarkdown(story, { strict: true });
    const secondMarkdown = storyToMarkdown(markdownToStory(firstMarkdown), {
      strict: true,
    });
    const thirdMarkdown = storyToMarkdown(markdownToStory(secondMarkdown), {
      strict: true,
    });

    expect(secondMarkdown).toBe(firstMarkdown);
    expect(thirdMarkdown).toBe(firstMarkdown);
  });
});

describe('task-list serialization', () => {
  function checkedTaskStory(content: Inline[]): Story {
    return [
      {
        block: {
          listing: {
            list: {
              type: 'tasklist',
              contents: [],
              items: [{ item: [{ task: { checked: true, content } }] }],
            },
          },
        },
      },
    ];
  }

  test('preserves a checked task starting with a blockquote', () => {
    const story = checkedTaskStory([{ blockquote: ['task quote'] }]);
    const markdown = storyToMarkdown(story, { strict: true });

    expect(markdown).toBe('- [x] <!-- -->\n  > task quote');
    expect(markdownToStory(markdown)).toEqual(story);
  });

  test('preserves a checked task starting with a code block', () => {
    const story = checkedTaskStory([{ code: 'task-code()' }]);
    const markdown = storyToMarkdown(story, { strict: true });

    expect(markdown).toBe('- [x] <!-- -->\n  ```\n  task-code()\n  ```');
    expect(markdownToStory(markdown)).toEqual(story);
  });

  test('preserves a checked task with empty content', () => {
    const story = checkedTaskStory([]);
    const markdown = storyToMarkdown(story, { strict: true });

    expect(markdown).toBe('- [x] <!-- -->');
    expect(markdownToStory(markdown)).toEqual(story);
  });

  test('preserves a checked block-first task inside a nested list', () => {
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [
                {
                  list: {
                    type: 'tasklist',
                    contents: ['Nested tasks'],
                    items: [
                      {
                        item: [
                          {
                            task: {
                              checked: true,
                              content: [{ blockquote: ['nested task quote'] }],
                            },
                          },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          },
        },
      },
    ];
    const markdown = storyToMarkdown(story, { strict: true });

    expect(markdown).toBe(
      '- Nested tasks\n  - [x] <!-- -->\n    > nested task quote'
    );
    expect(markdownToStory(markdown)).toEqual(story);
  });

  // A parent task's structural content lives in the nested list's `contents`,
  // which belong to the item in the *outer* list. Whether they may hold a task
  // is decided by the outer list's type, not the nested list's.
  describe.each([
    ['unordered', [{ item: ['child'] }], '- child'],
    ['ordered', [{ item: ['child'] }], '1. child'],
    [
      'tasklist',
      [{ item: [{ task: { checked: false, content: ['child'] } }] }],
      '- [ ] child',
    ],
  ])(
    'parent task with block content over a %s child list',
    (childType, childItems, renderedChild) => {
      const story = [
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [
                  {
                    list: {
                      type: childType,
                      contents: [
                        {
                          task: {
                            checked: true,
                            content: [{ blockquote: ['quoted'] }],
                          },
                        },
                      ],
                      items: childItems,
                    },
                  },
                ],
              },
            },
          },
        },
      ] as unknown as Story;

      test('renders the checkbox, the block content and the child list', () => {
        expect(storyToMarkdown(story, { strict: true })).toBe(
          `- [x] <!-- -->\n  > quoted\n  ${renderedChild}`
        );
      });

      test('round-trips', () => {
        const markdown = storyToMarkdown(story, { strict: true });
        expect(
          storyToMarkdown(markdownToStory(markdown), { strict: true })
        ).toBe(markdown);
      });
    }
  );

  test.each([true, false])(
    'preserves the marker of a task whose content renders to nothing (checked: %s)',
    (checked) => {
      const story = [
        {
          block: {
            listing: {
              list: {
                type: 'tasklist',
                contents: [],
                items: [{ item: [{ task: { checked, content: [''] } }] }],
              },
            },
          },
        },
      ] as unknown as Story;

      expect(storyToMarkdown(story, { strict: true })).toBe(
        `- [${checked ? 'x' : ' '}] <!-- -->`
      );
    }
  );
});

describe('list hierarchy', () => {
  test('emits root list contents before the root list', () => {
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: ['Root contents'],
              items: [{ item: ['Child item'] }],
            },
          },
        },
      },
    ];

    expect(storyToMdast(story, { strict: true })).toEqual([
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'Root contents' }],
      },
      {
        type: 'list',
        ordered: false,
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Child item' }],
              },
            ],
          },
        ],
      },
    ]);
  });

  test('keeps nested list contents in the parent list item', () => {
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [
                {
                  list: {
                    type: 'unordered',
                    contents: ['Nested parent'],
                    items: [{ item: ['Nested child'] }],
                  },
                },
              ],
            },
          },
        },
      },
    ];

    expect(storyToMdast(story, { strict: true })).toEqual([
      {
        type: 'list',
        ordered: false,
        children: [
          {
            type: 'listItem',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', value: 'Nested parent' }],
              },
              {
                type: 'list',
                ordered: false,
                children: [
                  {
                    type: 'listItem',
                    children: [
                      {
                        type: 'paragraph',
                        children: [{ type: 'text', value: 'Nested child' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);
  });
});

describe('strict mode', () => {
  const unknownInline = { mystery: 'value' } as unknown as Inline;

  test('omitted opts still skips unknown variant', () => {
    const inlines: Inline[] = ['before', unknownInline, 'after'];
    const result = inlinesToPhrasing(inlines);
    expect(textValues(result)).toEqual(['before', 'after']);
  });

  test('strict: false still skips unknown variant', () => {
    const inlines: Inline[] = ['before', unknownInline, 'after'];
    const result = inlinesToPhrasing(inlines, { strict: false });
    expect(textValues(result)).toEqual(['before', 'after']);
  });

  test('strict: true throws on unknown variant', () => {
    const inlines: Inline[] = [unknownInline];
    expect(() => inlinesToPhrasing(inlines, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
    expect(() => inlinesToPhrasing(inlines, { strict: true })).toThrow(
      /mystery/
    );
  });

  test('strict propagates into Bold', () => {
    const inlines: Inline[] = [{ bold: [unknownInline] } as unknown as Bold];
    expect(() => inlinesToPhrasing(inlines, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
  });

  test('strict propagates through storyToMdast', () => {
    const story = [{ inline: [unknownInline] }];
    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
    const result = storyToMdast(story);
    expect(result).toBeDefined();
  });

  test('strict catches unknown inline in header content', () => {
    const story = [
      { block: { header: { tag: 'h1' as const, content: [unknownInline] } } },
    ];
    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
  });

  test('strict rejects a blockquote in a header', () => {
    const story = [
      {
        block: {
          header: {
            tag: 'h1' as const,
            content: [{ blockquote: ['cannot stay a heading'] }],
          },
        },
      },
    ];

    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /blockquote.*header|header.*blockquote/i
    );
  });

  test('strict rejects inline %code under a bold mark', () => {
    const story = [
      {
        inline: [
          {
            bold: [{ code: 'cannot be bold block code' } as BlockCode],
          } as Bold,
        ],
      },
    ];

    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /code.*bold|bold.*code/i
    );
  });

  test('strict rejects a checked task whose block code cannot keep its mark', () => {
    const story: Story = [
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
                          {
                            bold: [
                              {
                                code: 'the checkbox survives non-strict output',
                              } as BlockCode,
                            ],
                          } as Bold,
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
    ];

    expect(storyToMarkdown(story)).toBe(
      '- [x] <!-- -->\n  ```\n  the checkbox survives non-strict output\n  ```'
    );
    expect(() => storyToMarkdown(story, { strict: true })).toThrow(
      /Cannot render code block faithfully.*bold/i
    );
  });

  test('strict rejects a blockquote in a standalone task', () => {
    const story = [
      {
        inline: [
          {
            task: {
              checked: false,
              content: [{ blockquote: ['not in a task-list item'] }],
            },
          } as Task,
        ],
      },
    ];

    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /block content.*task|task.*block content/i
    );
  });

  test('strict catches unknown inline in task content', () => {
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'tasklist' as const,
              contents: [],
              items: [
                {
                  item: [
                    { task: { checked: false, content: [unknownInline] } },
                  ],
                },
              ],
            },
          },
        },
      },
    ];
    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
  });

  test('strict rejects a task after a leading text sibling', () => {
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'tasklist',
              contents: [],
              items: [
                {
                  item: [
                    'prefix ',
                    { task: { checked: true, content: ['done'] } },
                  ],
                },
              ],
            },
          },
        },
      },
    ];

    expect(() => storyToMarkdown(story, { strict: true })).toThrow(
      /task.*not the first inline.*task-list item/i
    );

    const markdown = storyToMarkdown(story);
    expect(markdown).toBe('- prefix [x] done');
    expect(markdownToStory(markdown)).toEqual([
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [{ item: ['prefix [x] done'] }],
            },
          },
        },
      },
    ]);
  });

  test('strict rejects two tasks in one task-list item', () => {
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'tasklist',
              contents: [],
              items: [
                {
                  item: [
                    { task: { checked: true, content: ['first'] } },
                    { task: { checked: false, content: ['second'] } },
                  ],
                },
              ],
            },
          },
        },
      },
    ];

    expect(() => storyToMarkdown(story, { strict: true })).toThrow(
      /more than one task.*task-list item/i
    );

    const markdown = storyToMarkdown(story);
    expect(markdown).toBe('- [x] first[ ] second');
    expect(markdownToStory(markdown)).toEqual([
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
                        content: ['first[ ] second'],
                      },
                    },
                  ],
                },
              ],
            },
          },
        },
      },
    ]);
  });

  test('strict rejects a task in the contents of a non-task list item', () => {
    // The nested list's `contents` are the content of the item in the *outer*
    // list, which is unordered here, so a task inline has no representable
    // Markdown form regardless of its position.
    const story: Story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [
                {
                  list: {
                    type: 'tasklist',
                    contents: [
                      'prefix ',
                      { task: { checked: true, content: ['done'] } },
                    ],
                    items: [{ item: ['child'] }],
                  },
                },
              ],
            },
          },
        },
      },
    ];

    expect(() => storyToMarkdown(story, { strict: true })).toThrow(
      /task.*contents of a non-task list item/i
    );

    const markdown = storyToMarkdown(story);
    expect(markdown).toBe('- prefix [x] done\n  - child');
    expect(markdownToStory(markdown)).toEqual([
      {
        block: {
          listing: {
            list: {
              type: 'unordered',
              contents: [],
              items: [
                {
                  list: {
                    type: 'unordered',
                    contents: ['prefix [x] done'],
                    items: [{ item: ['child'] }],
                  },
                },
              ],
            },
          },
        },
      },
    ]);
  });

  test('strict catches unknown inline in blockquote', () => {
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered' as const,
              contents: [],
              items: [{ item: [{ blockquote: [unknownInline] }] }],
            },
          },
        },
      },
    ];
    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
  });

  test('strict catches unknown inline in root list contents', () => {
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered' as const,
              contents: [unknownInline],
              items: [{ item: ['ok'] }],
            },
          },
        },
      },
    ];
    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
  });

  test('strict catches unknown inline in nested list contents', () => {
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered' as const,
              contents: [],
              items: [
                {
                  list: {
                    type: 'unordered' as const,
                    contents: [unknownInline],
                    items: [{ item: ['ok'] }],
                  },
                },
              ],
            },
          },
        },
      },
    ];
    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
  });

  test('strict catches unknown inline in task-item siblings', () => {
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'tasklist' as const,
              contents: [],
              items: [
                {
                  item: [
                    { task: { checked: false, content: ['ok'] } },
                    unknownInline,
                  ],
                },
              ],
            },
          },
        },
      },
    ];
    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown inline variant in strict mode/
    );
  });

  test('strict catches an unknown root block variant', () => {
    const unknownBlock = {
      futureBlock: { content: 'unsafe' },
    } as unknown as Block;
    expect(() =>
      storyToMdast([{ block: unknownBlock }], { strict: true })
    ).toThrow(/Unknown block variant in strict mode:.*futureBlock/);
  });

  test('strict deliberately drops known cite and block link variants', () => {
    const story: Story = [
      { block: { cite: { group: '~zod/test-group' } } },
      {
        block: {
          link: {
            url: 'https://example.com/dropped',
            meta: { title: 'Known unsupported link block' },
          },
        },
      },
    ];

    expect(() => storyToMdast(story, { strict: true })).not.toThrow();
    expect(storyToMdast(story, { strict: true })).toEqual([]);
  });

  test('strict rejects an unknown nested listing arm', () => {
    const unknownListing = {
      futureListing: { contents: ['must not disappear'] },
    } as unknown as ListItem;
    const story = [
      {
        block: {
          listing: {
            list: {
              type: 'unordered' as const,
              contents: [],
              items: [unknownListing],
            },
          },
        },
      },
    ];

    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Unknown listing variant in strict mode:.*futureListing/
    );
  });

  test('strict rejects an unknown list discriminator', () => {
    const list = {
      list: {
        type: 'future-list',
        contents: ['must not be treated as unordered'],
        items: [{ item: ['child'] }],
      },
    } as unknown as List;

    expect(() =>
      storyToMdast([{ block: { listing: list } }], { strict: true })
    ).toThrow(/Unknown list discriminator in strict mode: future-list/);
  });

  // Accepted loss: Markdown list markers determine the re-parsed discriminator,
  // so a legal Story list whose type disagrees with its leaf item is re-typed.
  // Strict mode intentionally does not make a total round-trip guarantee.
  test.each([
    {
      sourceType: 'unordered',
      item: [{ task: { checked: true, content: ['done'] } }],
      markdown: '- [x] done',
      reparsedType: 'tasklist',
    },
    {
      sourceType: 'ordered',
      item: [{ task: { checked: false, content: ['todo'] } }],
      markdown: '1. [ ] todo',
      reparsedType: 'tasklist',
    },
    {
      sourceType: 'tasklist',
      item: ['plain'],
      markdown: '- plain',
      reparsedType: 'unordered',
    },
  ])(
    'documents $sourceType leaf-item discriminator loss',
    ({ sourceType, item, markdown, reparsedType }) => {
      const story = [
        {
          block: {
            listing: {
              list: {
                type: sourceType,
                contents: [],
                items: [{ item }],
              },
            },
          },
        },
      ] as unknown as Story;

      const emitted = storyToMarkdown(story, { strict: true });
      expect(emitted).toBe(markdown);
      expect(markdownToStory(emitted)).toMatchObject([
        {
          block: {
            listing: {
              list: { type: reparsedType },
            },
          },
        },
      ]);
    }
  );

  // A `%code` block nested inside an inline mark cannot be rendered faithfully
  // as phrasing content, so strict mode must refuse rather than fall back to a
  // text node containing literal fences — remark escapes those, producing a
  // visibly mangled note that read-back verification cannot detect.
  test('strict mode refuses a code block nested in inline context', () => {
    const story = [
      { inline: [{ bold: [{ code: 'const a = 1;\nconst b = 2;' }] }] },
    ] as unknown as Story;

    expect(() => storyToMdast(story, { strict: true })).toThrow(
      /Cannot render code block faithfully/
    );
  });
});
