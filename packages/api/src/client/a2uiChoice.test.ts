import { describe, expect, test } from 'vitest';

import { A2UI } from './a2ui';

const sendAction = (text: string) => ({
  event: { name: A2UI.action.sendMessage, context: { text } },
});

const option = (over: Record<string, unknown> = {}) => ({
  id: 'opt-1',
  label: 'A daily digest',
  description: 'A short summary, every morning.',
  icon: 'ChannelNotebooks',
  accent: 'blue',
  action: sendAction('A daily digest'),
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

const choiceEntry = (options: unknown[]) =>
  entryWith([
    { id: 'root', component: 'Column', children: ['choices'] },
    { id: 'choices', component: 'Choice', options },
  ]);

describe('Choice validation', () => {
  test('accepts a well-formed choice group', () => {
    expect(A2UI.validateBlobEntry(choiceEntry([option()]))).toBe(true);
  });

  test('accepts options without icon, accent or description', () => {
    expect(
      A2UI.validateBlobEntry(
        choiceEntry([
          {
            id: 'bare',
            label: 'Just a label',
            action: sendAction('Just a label'),
          },
        ])
      )
    ).toBe(true);
  });

  test('rejects an empty option list', () => {
    expect(A2UI.validateBlobEntry(choiceEntry([]))).toBe(false);
  });

  test('rejects duplicate option ids', () => {
    expect(
      A2UI.validateBlobEntry([
        option({ id: 'same' }),
        option({ id: 'same', label: 'Other' }),
      ] as unknown as never)
    ).toBe(false);
    expect(
      A2UI.validateBlobEntry(
        choiceEntry([option({ id: 'same' }), option({ id: 'same' })])
      )
    ).toBe(false);
  });

  test('rejects more options than the limit', () => {
    const many = Array.from({ length: 7 }, (_, i) =>
      option({ id: `opt-${i}` })
    );
    expect(A2UI.validateBlobEntry(choiceEntry(many))).toBe(false);
  });

  test('rejects an icon outside the allowlist', () => {
    expect(
      A2UI.validateBlobEntry(choiceEntry([option({ icon: 'NotAnIcon' })]))
    ).toBe(false);
    // Path traversal / asset-name injection must not survive validation.
    expect(
      A2UI.validateBlobEntry(
        choiceEntry([option({ icon: '../../secret.svg' })])
      )
    ).toBe(false);
  });

  test('rejects an accent outside the allowlist', () => {
    expect(
      A2UI.validateBlobEntry(choiceEntry([option({ accent: 'hotpink' })]))
    ).toBe(false);
  });

  test('rejects a missing or malformed action', () => {
    expect(
      A2UI.validateBlobEntry(choiceEntry([option({ action: undefined })]))
    ).toBe(false);
    expect(
      A2UI.validateBlobEntry(
        choiceEntry([option({ action: { event: { name: 'evil.exec' } } })])
      )
    ).toBe(false);
  });

  test('rejects a missing label', () => {
    expect(A2UI.validateBlobEntry(choiceEntry([option({ label: '' })]))).toBe(
      false
    );
  });

  test('allows a navigate action, like Button', () => {
    expect(
      A2UI.validateBlobEntry(
        choiceEntry([
          option({
            action: {
              event: {
                name: A2UI.action.navigate,
                context: {
                  target: { type: 'group', groupId: '~sampel-palnet/g' },
                },
              },
            },
          }),
        ])
      )
    ).toBe(true);
  });
});

describe('Choice text accounting', () => {
  test('option text counts toward the total text budget', () => {
    // A single 1000-char label is fine; many of them must not slip past the
    // aggregate limit just because they live inside a Choice.
    const long = 'x'.repeat(1000);
    const many = Array.from({ length: 6 }, (_, i) =>
      option({ id: `o-${i}`, label: long, description: long })
    );
    expect(A2UI.validateBlobEntry(choiceEntry(many))).toBe(false);
  });
});

describe('Choice root resolution', () => {
  test('a Choice can be the root component', () => {
    const entry = entryWith(
      [{ id: 'choices', component: 'Choice', options: [option()] }],
      'choices'
    );
    expect(A2UI.validateBlobEntry(entry)).toBe(true);
    expect(A2UI.getRootComponentId(entry as never)).toBe('choices');
  });
});
