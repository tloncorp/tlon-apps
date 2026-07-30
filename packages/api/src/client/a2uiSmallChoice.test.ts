import { describe, expect, test } from 'vitest';

import { A2UI, buildSmallChoiceMessage, smallChoiceProbeMessage } from './a2ui';

const sendAction = (text: string) => ({
  event: { name: A2UI.action.sendMessage, context: { text } },
});

const TOPICS = [
  { id: 'weather', label: 'Weather' },
  { id: 'news', label: 'News' },
  { id: 'stocks', label: 'Stocks' },
];

const smallChoice = (over: Record<string, unknown> = {}) => ({
  id: 'topics',
  component: 'SmallChoice',
  options: TOPICS,
  submitLabel: 'Done',
  action: sendAction(''),
  ...over,
});

const entryWith = (components: unknown[], root = 'root') => ({
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: { surfaceId: 's', catalogId: 'tlon.a2ui.basic.v2' },
    },
    {
      version: 'v0.9',
      updateComponents: { surfaceId: 's', root, components },
    },
  ],
});

const wrapped = (component: unknown) =>
  entryWith([
    { id: 'root', component: 'Column', children: ['topics'] },
    component,
  ]);

describe('SmallChoice validation', () => {
  test('accepts a well-formed pill group', () => {
    expect(A2UI.validateBlobEntry(wrapped(smallChoice()))).toBe(true);
  });

  test('accepts a prefix on the submit action', () => {
    expect(
      A2UI.validateBlobEntry(
        wrapped(smallChoice({ action: sendAction('Topics:') }))
      )
    ).toBe(true);
  });

  test('rejects an empty option list', () => {
    expect(A2UI.validateBlobEntry(wrapped(smallChoice({ options: [] })))).toBe(
      false
    );
  });

  test('rejects more options than the limit', () => {
    const many = Array.from({ length: 13 }, (_, i) => ({
      id: `o-${i}`,
      label: `L${i}`,
    }));
    expect(
      A2UI.validateBlobEntry(wrapped(smallChoice({ options: many })))
    ).toBe(false);
  });

  test('rejects duplicate option ids', () => {
    expect(
      A2UI.validateBlobEntry(
        wrapped(
          smallChoice({
            options: [
              { id: 'same', label: 'One' },
              { id: 'same', label: 'Two' },
            ],
          })
        )
      )
    ).toBe(false);
  });

  test('rejects a label longer than a pill can hold', () => {
    expect(
      A2UI.validateBlobEntry(
        wrapped(smallChoice({ options: [{ id: 'x', label: 'x'.repeat(65) }] }))
      )
    ).toBe(false);
  });

  test('rejects a missing or empty submit label', () => {
    expect(
      A2UI.validateBlobEntry(wrapped(smallChoice({ submitLabel: undefined })))
    ).toBe(false);
    expect(
      A2UI.validateBlobEntry(wrapped(smallChoice({ submitLabel: '  ' })))
    ).toBe(false);
  });

  test('rejects a navigate action', () => {
    // A selection only means anything as posted text; navigating would throw
    // away what the user picked.
    expect(
      A2UI.validateBlobEntry(
        wrapped(
          smallChoice({
            action: {
              event: {
                name: A2UI.action.navigate,
                context: {
                  target: { type: 'group', groupId: '~sampel-palnet/g' },
                },
              },
            },
          })
        )
      )
    ).toBe(false);
  });

  test('rejects a malformed action', () => {
    expect(
      A2UI.validateBlobEntry(wrapped(smallChoice({ action: undefined })))
    ).toBe(false);
    expect(
      A2UI.validateBlobEntry(
        wrapped(smallChoice({ action: { event: { name: 'evil.exec' } } }))
      )
    ).toBe(false);
  });

  test('option text counts toward the total text budget', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `o-${i}`,
      label: 'x'.repeat(64),
    }));
    const entry = entryWith([
      { id: 'root', component: 'Column', children: ['topics', 'filler'] },
      smallChoice({ options: many }),
      { id: 'filler', component: 'Text', text: 'y'.repeat(1000) },
    ]);
    // 12*64 + 1000 is well under budget on its own; the point is that the
    // pill labels are counted at all, so pile on Text nodes to cross it.
    expect(A2UI.validateBlobEntry(entry)).toBe(true);

    const overflowing = entryWith([
      {
        id: 'root',
        component: 'Column',
        children: ['topics', ...Array.from({ length: 8 }, (_, i) => `t-${i}`)],
      },
      smallChoice({ options: many }),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `t-${i}`,
        component: 'Text',
        text: 'y'.repeat(1000),
      })),
    ]);
    expect(A2UI.validateBlobEntry(overflowing)).toBe(false);
  });

  test('a SmallChoice can be the root component', () => {
    const entry = entryWith([smallChoice()], 'topics');
    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(A2UI.getRootComponentId(entry as never)).toBe('topics');
  });
});

describe('buildSmallChoiceMessage', () => {
  const component = smallChoice() as unknown as A2UI.SmallChoice;

  test('joins the selected labels in declaration order', () => {
    // Tapped stocks-then-weather still reads weather-then-stocks, so the same
    // picks always produce the same message.
    expect(buildSmallChoiceMessage(component, ['stocks', 'weather'])).toBe(
      'Weather, Stocks'
    );
  });

  test('returns empty for no selection', () => {
    expect(buildSmallChoiceMessage(component, [])).toBe('');
  });

  test('ignores ids that are not options', () => {
    expect(buildSmallChoiceMessage(component, ['nope', 'news'])).toBe('News');
  });

  test('prepends the action text as a prefix', () => {
    const withPrefix = smallChoice({
      action: sendAction('Topics:'),
    }) as unknown as A2UI.SmallChoice;
    expect(buildSmallChoiceMessage(withPrefix, ['news'])).toBe('Topics: News');
  });

  test('deduplicates repeated ids', () => {
    expect(buildSmallChoiceMessage(component, ['news', 'news'])).toBe('News');
  });
});

describe('smallChoiceProbeMessage', () => {
  // Regression: the picker rendered permanently disabled because availability
  // was checked against the action's own text — an empty prefix — which a check
  // written for Button reads as "nothing to send". The probe must be non-empty
  // regardless of the prefix.
  test('is non-empty even when the prefix is empty', () => {
    const probe = smallChoiceProbeMessage(
      smallChoice() as unknown as A2UI.SmallChoice
    );
    expect(probe).toBe('Weather, News, Stocks');
    expect(probe.trim()).not.toBe('');
  });

  test('includes the prefix when there is one', () => {
    expect(
      smallChoiceProbeMessage(
        smallChoice({
          action: sendAction('Topics:'),
        }) as unknown as A2UI.SmallChoice
      )
    ).toBe('Topics: Weather, News, Stocks');
  });
});
