import { describe, expect, it, vi } from 'vitest';

import { buildOnboardingStartupRoutes } from './OnboardingStartupScreen';

// `topLevelTabs` reaches expo-modules-core through the analytics import.
vi.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: { NavigationTabSelected: 'Navigation Tab Selected' },
  trackEvent: vi.fn(),
}));
vi.mock('../hooks/useBotDmTab', () => ({
  useBotDmTab: () => ({ enabled: false, isLoading: true }),
}));
vi.mock('@tloncorp/api/client/utils', () => ({
  isBotDmChannel: ({ channel }: { channel?: { id?: string } }) =>
    channel?.id?.startsWith('~pinser-botter-') ?? false,
}));

describe('buildOnboardingStartupRoutes', () => {
  const dmLanding = {
    groupId: '~zod/home-group',
    channelId: '~pinser-botter-zod',
  };

  it('wakes a hosted first run on the Bot tab, with its group riding along', () => {
    expect(
      buildOnboardingStartupRoutes(dmLanding, { botTabEnabled: true })
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

  it('opens the DM over the tabs when no Bot tab is registered', () => {
    expect(
      buildOnboardingStartupRoutes(dmLanding, { botTabEnabled: false })
    ).toEqual([
      { name: 'MainTabs' },
      {
        name: 'DM',
        params: {
          groupId: '~zod/home-group',
          channelId: '~pinser-botter-zod',
          disableTransition: true,
        },
      },
    ]);
  });

  it('seats a setup chat over the tabs', () => {
    expect(
      buildOnboardingStartupRoutes(
        { groupId: '~zod/home-group', channelId: 'chat/~zod/setup' },
        { botTabEnabled: true }
      )
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
