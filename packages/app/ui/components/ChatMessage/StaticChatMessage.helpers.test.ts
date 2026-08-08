import { describe, expect, test } from 'vitest';

import { resolveA2UISendText } from './StaticChatMessage.helpers';

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
