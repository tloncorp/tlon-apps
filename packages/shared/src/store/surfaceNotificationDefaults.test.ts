import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as db from '../db';
import { applySurfaceChannelNotificationDefaults } from './surfaceNotificationDefaults';

const mocks = vi.hoisted(() => ({
  getAllChannels: vi.fn(),
  getMarkers: vi.fn(),
  setMarkers: vi.fn(),
  setSetting: vi.fn(),
  setChannelVolumeLevel: vi.fn(),
}));

vi.mock('@tloncorp/api', async () => {
  const actual =
    await vi.importActual<typeof import('@tloncorp/api')>('@tloncorp/api');
  return { ...actual, setSetting: mocks.setSetting };
});

vi.mock('../db', () => ({
  getAllChannels: mocks.getAllChannels,
  surfaceNotificationDefaultedChannelIds: {
    getValue: mocks.getMarkers,
    setValue: mocks.setMarkers,
  },
}));

vi.mock('./activityActions', () => ({
  setChannelVolumeLevel: mocks.setChannelVolumeLevel,
}));

const SURFACE_CHANNEL_ID = 'chat/~zod/dashboard';
const CHAT_CHANNEL_ID = 'chat/~zod/general';
const GROUP_ID = '~zod/tlon';

function makeChannel(
  id: string,
  collectionRenderer: CollectionRendererId
): db.Channel {
  return {
    id,
    groupId: GROUP_ID,
    type: 'chat',
    contentConfiguration: {
      draftInput: { id: DraftInputId.chat },
      defaultPostContentRenderer: { id: PostContentRendererId.chat },
      defaultPostCollectionRenderer: { id: collectionRenderer },
    },
  } as unknown as db.Channel;
}

const surfaceChannel = makeChannel(
  SURFACE_CHANNEL_ID,
  CollectionRendererId.surface
);
const chatChannel = makeChannel(CHAT_CHANNEL_ID, CollectionRendererId.chat);

describe('applySurfaceChannelNotificationDefaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Simulate the storage item: markers persist across calls within a test.
    let markers: string[] = [];
    mocks.getMarkers.mockImplementation(async () => markers);
    mocks.setMarkers.mockImplementation(async (next: unknown) => {
      markers = typeof next === 'function' ? next(markers) : (next as string[]);
    });
    mocks.setSetting.mockResolvedValue(undefined);
    mocks.setChannelVolumeLevel.mockResolvedValue(true);
    mocks.getAllChannels.mockResolvedValue([surfaceChannel, chatChannel]);
  });

  it('hushes a newly discovered surface channel exactly once, and a second discovery does not re-poke', async () => {
    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);
    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledWith({
      channel: surfaceChannel,
      level: 'hush',
    });
    expect(mocks.setSetting).toHaveBeenCalledTimes(1);
    expect(mocks.setSetting.mock.calls[0][0]).toBe(
      `surfaceNotificationDefaulted:${SURFACE_CHANNEL_ID}`
    );
    expect(await mocks.getMarkers()).toEqual([SURFACE_CHANNEL_ID]);

    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);
    expect(mocks.setSetting).toHaveBeenCalledTimes(1);
  });

  it('leaves a user who unmuted a surface channel unmuted across subsequent syncs', async () => {
    await applySurfaceChannelNotificationDefaults();
    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);

    // The user unmutes. `adjustVolumeSetting(source, null)` REMOVES the volume
    // entry, so nothing in the volume settings distinguishes this from a
    // channel that was never touched — only the marker does.
    mocks.setChannelVolumeLevel.mockClear();

    await applySurfaceChannelNotificationDefaults();
    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
  });

  it('leaves a non-surface channel in the same group alone', async () => {
    mocks.getAllChannels.mockResolvedValue([chatChannel]);

    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
    expect(mocks.setSetting).not.toHaveBeenCalled();
    expect(await mocks.getMarkers()).toEqual([]);
  });

  it('does not mark the channel defaulted when the hush poke fails', async () => {
    mocks.setChannelVolumeLevel.mockResolvedValue(false);

    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setSetting).not.toHaveBeenCalled();
    expect(await mocks.getMarkers()).toEqual([]);

    // The next discovery retries rather than leaving the channel notifying.
    mocks.setChannelVolumeLevel.mockResolvedValue(true);
    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(2);
    expect(await mocks.getMarkers()).toEqual([SURFACE_CHANNEL_ID]);
  });

  it('does not mark the channel defaulted when the marker write fails', async () => {
    mocks.setSetting.mockRejectedValueOnce(new Error('offline'));

    await applySurfaceChannelNotificationDefaults();

    expect(await mocks.getMarkers()).toEqual([]);

    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(2);
    expect(await mocks.getMarkers()).toEqual([SURFACE_CHANNEL_ID]);
  });

  it('hushes only the candidate it is given on live discovery', async () => {
    await applySurfaceChannelNotificationDefaults([chatChannel]);
    expect(mocks.getAllChannels).not.toHaveBeenCalled();
    expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();

    await applySurfaceChannelNotificationDefaults([surfaceChannel]);
    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);
  });
});
