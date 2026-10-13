import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  changeMessageFilter,
  completeWayfindingSplash,
  updateCalmSetting,
  updateDisableTlonInfraEnhancement,
  updateEnableTelemetry,
  updateShowDeleteMarkers,
  updateTheme,
} from './settingsActions';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  insertSettings: vi.fn(),
  setSetting: vi.fn(),
  setWayfindingProgress: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  setSetting: mocks.setSetting,
}));

vi.mock('../db', () => ({
  getSettings: mocks.getSettings,
  insertSettings: mocks.insertSettings,
  wayfindingProgress: {
    setValue: mocks.setWayfindingProgress,
  },
}));

vi.mock('../logic', () => ({
  withRetry: (operation: () => Promise<unknown>) => operation(),
}));

describe('updateShowDeleteMarkers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSettings.mockResolvedValue({ showDeleteMarkers: false });
    mocks.insertSettings.mockResolvedValue(undefined);
    mocks.setSetting.mockResolvedValue(undefined);
  });

  it('optimistically saves the preference locally and remotely', async () => {
    await expect(updateShowDeleteMarkers(true)).resolves.toBe(true);

    expect(mocks.insertSettings).toHaveBeenCalledWith({
      showDeleteMarkers: true,
    });
    expect(mocks.setSetting).toHaveBeenCalledWith('showDeleteMarkers', true);
  });

  it('restores the previous preference when the remote update fails', async () => {
    mocks.setSetting.mockRejectedValueOnce(new Error('offline'));

    await expect(updateShowDeleteMarkers(true)).resolves.toBe(false);

    expect(mocks.insertSettings).toHaveBeenNthCalledWith(2, {
      showDeleteMarkers: false,
    });
  });
});

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

describe('rollback when no setting was stored before', () => {
  // Each entry: the action, and the settings key it rolls back.
  const cases: [string, () => Promise<unknown>, string][] = [
    [
      'changeMessageFilter',
      () => changeMessageFilter('All Messages'),
      'messagesFilter',
    ],
    [
      'updateCalmSetting',
      () => updateCalmSetting('disableAvatars', true),
      'disableAvatars',
    ],
    ['updateTheme', () => updateTheme('dark'), 'theme'],
    [
      'updateDisableTlonInfraEnhancement',
      () => updateDisableTlonInfraEnhancement(true),
      'disableTlonInfraEnhancement',
    ],
    [
      'updateEnableTelemetry',
      () => updateEnableTelemetry(true),
      'enableTelemetry',
    ],
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // No settings row yet, so every captured old value is undefined.
    mocks.getSettings.mockResolvedValue({});
    mocks.insertSettings.mockResolvedValue(undefined);
    mocks.setSetting.mockRejectedValue(new Error('offline'));
  });

  it.each(cases)('%s clears the optimistic value', async (_, run, key) => {
    // Some of these rethrow and some return false; both are the failure path.
    await run().catch(() => {});

    // An undefined value would be dropped before it reached SQLite, leaving
    // the optimistic write in place while the caller reports failure.
    expect(mocks.insertSettings).toHaveBeenLastCalledWith({ [key]: null });
  });
});
