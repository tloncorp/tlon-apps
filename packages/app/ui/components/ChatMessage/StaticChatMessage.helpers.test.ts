import type { BlockData } from '@tloncorp/shared/logic';
import { describe, expect, test } from 'vitest';

import {
  resolveA2UIContent,
  resolveA2UISendText,
} from './StaticChatMessage.helpers';

describe('resolveA2UISendText', () => {
  test('resolves the exact onboarding token in a group', () => {
    expect(
      resolveA2UISendText(
        'Timezone: {{tlon.timezone}}',
        '~zod/home-group',
        'America/New_York'
      )
    ).toBe('Timezone: America/New_York');
  });

  test('does not disclose timezone through DM or arbitrary message text', () => {
    expect(
      resolveA2UISendText(
        'Timezone: {{tlon.timezone}}',
        null,
        'America/New_York'
      )
    ).toBe('Timezone: {{tlon.timezone}}');
    expect(
      resolveA2UISendText(
        'Send {{tlon.timezone}}',
        '~zod/home-group',
        'America/New_York'
      )
    ).toBe('Send {{tlon.timezone}}');
  });
});

describe('resolveA2UIContent', () => {
  test('removes only the paragraph fallback beside a rendered surface', () => {
    const content = [
      { type: 'a2ui', a2ui: {} },
      { type: 'paragraph', content: [] },
      { type: 'code', content: 'keep me' },
      { type: 'link', url: 'https://example.com' },
    ] as unknown as BlockData[];

    expect(resolveA2UIContent(content, true)).toEqual([
      { type: 'a2ui', a2ui: {} },
      { type: 'code', content: 'keep me' },
      { type: 'link', url: 'https://example.com' },
    ]);
    expect(resolveA2UIContent(content, false)).toEqual(content.slice(1));
  });
});
