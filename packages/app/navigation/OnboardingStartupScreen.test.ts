import { describe, expect, it, vi } from 'vitest';

import { buildOnboardingStartupRoutes } from './OnboardingStartupScreen';

// `topLevelTabs` reaches expo-modules-core through the analytics import.
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { NavigationTabSelected: 'Navigation Tab Selected' },
  trackEvent: vi.fn(),
}));
vi.mock('@tloncorp/api/client/utils', () => ({
  isBotDmChannel: ({ channel }: { channel?: { id?: string } }) =>
    channel?.id?.startsWith('~pinser-botter-') ?? false,
}));

describe('buildOnboardingStartupRoutes', () => {
  it('wakes a hosted first run on the Bot tab, with its group riding along', () => {
    expect(
      buildOnboardingStartupRoutes({
        groupId: '~zod/home-group',
        channelId: '~pinser-botter-zod',
      })
    ).toEqual([
      {
        name: 'MainTabs',
        params: {
          screen: 'BotChat',
          params: {
            channelId: '~pinser-botter-zod',
            groupId: '~zod/home-group',
          },
        },
      },
    ]);
  });

  it('seats a setup chat over the tabs', () => {
    expect(
      buildOnboardingStartupRoutes({
        groupId: '~zod/home-group',
        channelId: 'chat/~zod/setup',
      })
    ).toEqual([
      { name: 'MainTabs' },
      {
        name: 'Channel',
        params: {
          groupId: '~zod/home-group',
          channelId: 'chat/~zod/setup',
          disableTransition: true,
        },
      },
    ]);
  });
});
