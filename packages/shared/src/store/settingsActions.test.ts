import { beforeEach, describe, expect, it, vi } from 'vitest';

import { updateShowDeleteMarkers } from './settingsActions';

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  insertSettings: vi.fn(),
  setSetting: vi.fn(),
}));

vi.mock('@tloncorp/api', () => ({
  setSetting: mocks.setSetting,
}));

vi.mock('../db', () => ({
  getSettings: mocks.getSettings,
  insertSettings: mocks.insertSettings,
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
