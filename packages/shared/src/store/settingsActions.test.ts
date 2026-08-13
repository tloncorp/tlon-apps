import { beforeEach, describe, expect, it, vi } from 'vitest';

import { completeWayfindingSplash } from './settingsActions';

const mocks = vi.hoisted(() => ({
  insertSettings: vi.fn(),
  setSetting: vi.fn(),
  setWayfindingProgress: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  setSetting: mocks.setSetting,
}));

vi.mock('../db', () => ({
  insertSettings: mocks.insertSettings,
  wayfindingProgress: {
    setValue: mocks.setWayfindingProgress,
  },
}));

vi.mock('../logic', () => ({
  withRetry: (operation: () => Promise<unknown>) => operation(),
}));

describe('completeWayfindingSplash', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.insertSettings.mockResolvedValue(undefined);
    mocks.setSetting.mockResolvedValue(undefined);
  });

  it.each([
    ['legacy wayfinding', undefined, false],
    ['agent onboarding', { showBotMentionHint: false }, true],
  ])('sets the bot mention hint state for %s', async (_, options, expected) => {
    let nextProgress: Record<string, unknown> | undefined;
    mocks.setWayfindingProgress.mockImplementationOnce(
      async (
        update: (current: Record<string, unknown>) => Record<string, unknown>
      ) => {
        nextProgress = update({ tappedHomeGroupHint: false });
      }
    );

    await completeWayfindingSplash(options);

    expect(nextProgress?.tappedHomeGroupHint).toBe(expected);
  });
});
