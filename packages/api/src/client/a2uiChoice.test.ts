import { describe, expect, test } from 'vitest';

import { A2UI, buildSmallChoiceMessage, smallChoiceProbeMessage } from './a2ui';

const sendAction = (text: string) => ({
  event: { name: A2UI.action.sendMessage, context: { text } },
});
const navigateAction = {
  event: {
    name: A2UI.action.navigate,
    context: { target: { type: 'group', groupId: '~sampel-palnet/g' } },
  },
};

const option = (over: Record<string, unknown> = {}) => ({
  id: 'opt-1',
  label: 'A daily digest',
  description: 'A short summary, every morning.',
  icon: 'ChannelNotebooks',
  accent: 'blue',
  action: sendAction('A daily digest'),
  ...over,
});

const TOPICS = [
  { id: 'weather', label: 'Weather' },
  { id: 'news', label: 'News' },
  { id: 'stocks', label: 'Stocks' },
];

const smallChoice = (over: Record<string, unknown> = {}) => ({
  id: 'main',
  component: 'SmallChoice',
  options: TOPICS,
  submitLabel: 'Done',
  action: sendAction(''),
  ...over,
});

const choice = (over: Record<string, unknown> = {}) => ({
  id: 'main',
  component: 'Choice',
  options: [option()],
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
    { version: 'v0.9', updateComponents: { surfaceId: 's', root, components } },
  ],
});

const wrapped = (component: unknown) =>
  entryWith([
    { id: 'root', component: 'Column', children: ['main'] },
    component,
  ]);

const valid = (component: unknown) =>
  A2UI.validateBlobEntry(wrapped(component));

describe('Choice validation', () => {
  test('accepts well-formed groups, with or without the optional fields', () => {
    expect(valid(choice())).toBe(true);
    expect(
      valid(
        choice({
          options: [
            { id: 'bare', label: 'Just a label', action: sendAction('x') },
          ],
        })
      )
    ).toBe(true);
    // Navigate is a legitimate tap, like Button.
    expect(
      valid(choice({ options: [option({ action: navigateAction })] }))
    ).toBe(true);
  });

  test.each([
    ['empty option list', { options: [] }],
    [
      'duplicate option ids',
      { options: [option({ id: 'same' }), option({ id: 'same' })] },
    ],
    [
      'more options than the limit',
      {
        options: Array.from({ length: 7 }, (_, i) => option({ id: `o-${i}` })),
      },
    ],
    // Icon/accent allowlists double as asset-name-injection defense.
    [
      'icon outside the allowlist',
      { options: [option({ icon: 'NotAnIcon' })] },
    ],
    [
      'icon path traversal',
      { options: [option({ icon: '../../secret.svg' })] },
    ],
    [
      'accent outside the allowlist',
      { options: [option({ accent: 'hotpink' })] },
    ],
    ['missing action', { options: [option({ action: undefined })] }],
    [
      'unknown action name',
      { options: [option({ action: { event: { name: 'evil.exec' } } })] },
    ],
    ['missing label', { options: [option({ label: '' })] }],
  ])('rejects %s', (_name, over) => {
    expect(valid(choice(over))).toBe(false);
  });

  test('option text counts toward the total text budget', () => {
    const long = 'x'.repeat(1000);
    const many = Array.from({ length: 6 }, (_, i) =>
      option({ id: `o-${i}`, label: long, description: long })
    );
    expect(valid(choice({ options: many }))).toBe(false);
  });

  test('a Choice can be the root component', () => {
    const entry = entryWith([choice()], 'main');
    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(A2UI.getRootComponentId(entry as never)).toBe('main');
  });
});

describe('SmallChoice validation', () => {
  test('accepts a well-formed pill group, with or without a prefix', () => {
    expect(valid(smallChoice())).toBe(true);
    expect(valid(smallChoice({ action: sendAction('Topics:') }))).toBe(true);
    const entry = entryWith([smallChoice()], 'main');
    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(A2UI.getRootComponentId(entry as never)).toBe('main');
  });

  test.each([
    ['empty option list', { options: [] }],
    [
      'more options than the limit',
      {
        options: Array.from({ length: 13 }, (_, i) => ({
          id: `o-${i}`,
          label: `L${i}`,
        })),
      },
    ],
    [
      'duplicate option ids',
      {
        options: [
          { id: 'same', label: 'One' },
          { id: 'same', label: 'Two' },
        ],
      },
    ],
    [
      'a label longer than a pill can hold',
      { options: [{ id: 'x', label: 'x'.repeat(65) }] },
    ],
    ['missing submit label', { submitLabel: undefined }],
    ['blank submit label', { submitLabel: '  ' }],
    // A selection only means anything as posted text; navigating would throw
    // away what the user picked.
    ['a navigate action', { action: navigateAction }],
    ['missing action', { action: undefined }],
    ['unknown action name', { action: { event: { name: 'evil.exec' } } }],
  ])('rejects %s', (_name, over) => {
    expect(valid(smallChoice(over))).toBe(false);
  });

  test('pill labels count toward the total text budget', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: `o-${i}`,
      label: 'x'.repeat(64),
    }));
    // 12*64 chars is fine on its own; the point is the labels are counted at
    // all, so pile on Text nodes to cross the aggregate limit.
    const overflowing = entryWith([
      {
        id: 'root',
        component: 'Column',
        children: ['main', ...Array.from({ length: 8 }, (_, i) => `t-${i}`)],
      },
      smallChoice({ options: many }),
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `t-${i}`,
        component: 'Text',
        text: 'y'.repeat(1000),
      })),
    ]);
    expect(valid(smallChoice({ options: many }))).toBe(true);
    expect(A2UI.validateBlobEntry(overflowing)).toBe(false);
  });
});

describe('SmallChoice message building', () => {
  const component = smallChoice() as unknown as A2UI.SmallChoice;
  const withPrefix = smallChoice({
    action: sendAction('Topics:'),
  }) as unknown as A2UI.SmallChoice;

  test('joins selections in declaration order, deduped, unknown ids ignored', () => {
    // Tapped stocks-then-weather still reads weather-then-stocks, so the
    // same picks always produce the same message.
    expect(buildSmallChoiceMessage(component, ['stocks', 'weather'])).toBe(
      'Weather, Stocks'
    );
    expect(buildSmallChoiceMessage(component, [])).toBe('');
    expect(buildSmallChoiceMessage(component, ['nope', 'news'])).toBe('News');
    expect(buildSmallChoiceMessage(component, ['news', 'news'])).toBe('News');
    expect(buildSmallChoiceMessage(withPrefix, ['news'])).toBe('Topics: News');
  });

  test('free text rides along with the pills as one more entry', () => {
    // "Some of these plus one of my own" is one submit, not a pill message
    // chased by a chat message.
    expect(buildSmallChoiceMessage(component, ['news'], ' Miles run ')).toBe(
      'News, Miles run'
    );
    expect(buildSmallChoiceMessage(component, [], 'Miles run')).toBe(
      'Miles run'
    );
    expect(buildSmallChoiceMessage(withPrefix, [], 'Miles run')).toBe(
      'Topics: Miles run'
    );
    expect(buildSmallChoiceMessage(component, [], '   ')).toBe('');
  });

  test('freeTextPlaceholder validates as an optional bounded string', () => {
    expect(valid(smallChoice({ freeTextPlaceholder: 'Add your own…' }))).toBe(
      true
    );
    expect(valid(smallChoice({ freeTextPlaceholder: '' }))).toBe(false);
    expect(valid(smallChoice({ freeTextPlaceholder: 'x'.repeat(65) }))).toBe(
      false
    );
  });

  test('probe message is non-empty even when the prefix is empty', () => {
    // Regression: the picker rendered permanently disabled because
    // availability was checked against the action's own text — an empty
    // prefix — which a check written for Button reads as "nothing to send".
    expect(smallChoiceProbeMessage(component)).toBe('Weather, News, Stocks');
    expect(smallChoiceProbeMessage(withPrefix)).toBe(
      'Topics: Weather, News, Stocks'
    );
  });
});

describe('inviteLink action', () => {
  const button = (action: unknown) => [
    { id: 'root', component: 'Column', children: ['b', 'l'] },
    { id: 'b', component: 'Button', child: 'l', action },
    { id: 'l', component: 'Text', text: 'Invite' },
  ];

  test('valid with a group id, rejected without one', () => {
    const action = (context: unknown) => ({
      event: { name: A2UI.action.inviteLink, context },
    });
    expect(
      A2UI.validateBlobEntry(
        entryWith(button(action({ groupId: '~ten/home-group' })))
      )
    ).toBe(true);
    expect(
      A2UI.validateBlobEntry(entryWith(button(action({ groupId: '' }))))
    ).toBe(false);
    expect(A2UI.validateBlobEntry(entryWith(button(action({}))))).toBe(false);
  });
});

describe('screen navigation target', () => {
  const button = (target: unknown) => [
    { id: 'root', component: 'Column', children: ['b', 'l'] },
    {
      id: 'b',
      component: 'Button',
      child: 'l',
      action: { event: { name: A2UI.action.navigate, context: { target } } },
    },
    { id: 'l', component: 'Text', text: 'Connect services' },
  ];

  test('allowlisted screen names only — never a free route', () => {
    expect(
      A2UI.validateBlobEntry(
        entryWith(button({ type: 'screen', screen: 'botMcpSettings' }))
      )
    ).toBe(true);
    // Anything not on the allowlist fails validation, so a blob can't point
    // the renderer at an arbitrary navigator route.
    expect(
      A2UI.validateBlobEntry(
        entryWith(button({ type: 'screen', screen: 'BotApiKeySettings' }))
      )
    ).toBe(false);
    expect(A2UI.validateBlobEntry(entryWith(button({ type: 'screen' })))).toBe(
      false
    );
  });
});
