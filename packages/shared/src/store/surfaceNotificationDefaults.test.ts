import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
} from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as db from '../db';
import {
  type SurfaceNotificationDefaults,
  applySurfaceChannelNotificationDefaults as appSingletonApply,
  createSurfaceNotificationDefaults,
} from './surfaceNotificationDefaults';

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
const OTHER_SURFACE_CHANNEL_ID = 'chat/~zod/status-board';
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
const otherSurfaceChannel = makeChannel(
  OTHER_SURFACE_CHANNEL_ID,
  CollectionRendererId.surface
);
const chatChannel = makeChannel(CHAT_CHANNEL_ID, CollectionRendererId.chat);

describe('applySurfaceChannelNotificationDefaults', () => {
  let defaults: SurfaceNotificationDefaults;

  const applySurfaceChannelNotificationDefaults = (candidates?: db.Channel[]) =>
    defaults.apply(candidates);

  /**
   * What `syncSettings` does on success: replace the local mirror with the
   * ship's markers wholesale, then declare them authoritative. Every test
   * that expects a hush has to go through this, because until it happens the
   * empty mirror is indistinguishable from "the user unmuted elsewhere".
   */
  async function settingsSyncLands(markersFromShip: string[] = []) {
    await defaults.installMarkersFromShip(markersFromShip);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    // Marker authority and the deferral queue are per-client state, so each
    // test gets its own — the same starting point as a freshly launched app,
    // rather than one that inherits whatever the previous test established.
    defaults = createSurfaceNotificationDefaults();

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
    await settingsSyncLands();
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
    await settingsSyncLands();
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
    await settingsSyncLands();
    mocks.getAllChannels.mockResolvedValue([chatChannel]);

    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
    expect(mocks.setSetting).not.toHaveBeenCalled();
    expect(await mocks.getMarkers()).toEqual([]);
  });

  it('does not mark the channel defaulted when the hush poke fails', async () => {
    await settingsSyncLands();
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
    await settingsSyncLands();
    mocks.setSetting.mockRejectedValueOnce(new Error('offline'));

    await applySurfaceChannelNotificationDefaults();

    expect(await mocks.getMarkers()).toEqual([]);

    await applySurfaceChannelNotificationDefaults();

    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(2);
    expect(await mocks.getMarkers()).toEqual([SURFACE_CHANNEL_ID]);
  });

  it('hushes only the candidate it is given on live discovery', async () => {
    await settingsSyncLands();
    await applySurfaceChannelNotificationDefaults([chatChannel]);
    expect(mocks.getAllChannels).not.toHaveBeenCalled();
    expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();

    await applySurfaceChannelNotificationDefaults([surfaceChannel]);
    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);
  });

  describe('marker authority', () => {
    it('does not hush a live discovery that arrives before the markers load', async () => {
      // A fresh client: high-priority group subscriptions deliver an
      // `addChannel` well before low-priority `syncSettings` runs, so the
      // mirror is still empty — which says nothing about whether the ship
      // holds a marker for this channel.
      await applySurfaceChannelNotificationDefaults([surfaceChannel]);

      expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
      expect(mocks.setSetting).not.toHaveBeenCalled();
    });

    it('never re-hushes a channel the user unmuted on another device', async () => {
      // This is the whole point of the ship-side marker. The user unmuted on
      // another device: the marker exists, the volume override does not.
      await applySurfaceChannelNotificationDefaults([surfaceChannel]);

      // ...and only now does the settings sync deliver that marker.
      await settingsSyncLands([SURFACE_CHANNEL_ID]);

      expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
      expect(mocks.setSetting).not.toHaveBeenCalled();
    });

    it('hushes a genuinely unmarked channel once the markers load', async () => {
      await applySurfaceChannelNotificationDefaults([surfaceChannel]);
      expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();

      // the ship holds a marker for a DIFFERENT surface, so this one really
      // has never been defaulted
      await settingsSyncLands([OTHER_SURFACE_CHANNEL_ID]);

      expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);
      expect(mocks.setChannelVolumeLevel).toHaveBeenCalledWith({
        channel: surfaceChannel,
        level: 'hush',
      });
      expect(await mocks.getMarkers()).toEqual([
        OTHER_SURFACE_CHANNEL_ID,
        SURFACE_CHANNEL_ID,
      ]);
    });

    it('queues every deferred candidate rather than keeping only the last', async () => {
      await applySurfaceChannelNotificationDefaults([surfaceChannel]);
      await applySurfaceChannelNotificationDefaults([otherSurfaceChannel]);
      // a repeat of one already queued must not produce a second poke
      await applySurfaceChannelNotificationDefaults([surfaceChannel]);

      await settingsSyncLands();

      expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(2);
      expect(await mocks.getMarkers()).toEqual([
        SURFACE_CHANNEL_ID,
        OTHER_SURFACE_CHANNEL_ID,
      ]);
    });

    it('skips the post-sync sweep when settings synchronization failed, and runs it on a later success', async () => {
      // `syncStart` runs its sweep out of a `Promise.all` that swallows a
      // settings failure, so the sweep is reached with the mirror still
      // empty. It must not act on that.
      await applySurfaceChannelNotificationDefaults();

      expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
      expect(mocks.setSetting).not.toHaveBeenCalled();

      // a later settings sync succeeds and the deferred sweep runs
      await settingsSyncLands();

      expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);
      expect(mocks.setChannelVolumeLevel).toHaveBeenCalledWith({
        channel: surfaceChannel,
        level: 'hush',
      });
    });

    it('a failed settings sync followed by a successful one does not re-hush what the ship already marked', async () => {
      await applySurfaceChannelNotificationDefaults();
      await settingsSyncLands([SURFACE_CHANNEL_ID]);

      expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
    });

    it('installing the markers replaces the mirror wholesale', async () => {
      // the mirror is the ship's, not a union with whatever was cached: a
      // marker the user cleared elsewhere has to disappear here too
      await mocks.setMarkers([OTHER_SURFACE_CHANNEL_ID]);
      await settingsSyncLands([SURFACE_CHANNEL_ID]);

      expect(await mocks.getMarkers()).toEqual([SURFACE_CHANNEL_ID]);
    });

    it('a mirror write that fails leaves authority unclaimed', async () => {
      await applySurfaceChannelNotificationDefaults([surfaceChannel]);
      mocks.setMarkers.mockRejectedValueOnce(new Error('storage failed'));

      await settingsSyncLands([OTHER_SURFACE_CHANNEL_ID]);

      // the mirror still holds the unproven value, so nothing may act on it
      expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();

      // ...and the queued candidate survives for the retry
      await settingsSyncLands([OTHER_SURFACE_CHANNEL_ID]);
      expect(mocks.setChannelVolumeLevel).toHaveBeenCalledTimes(1);
      expect(mocks.setChannelVolumeLevel).toHaveBeenCalledWith({
        channel: surfaceChannel,
        level: 'hush',
      });
    });

    // The tests above run against their own instance. This one runs against
    // the module-level export that sync.ts actually calls, so the singleton
    // can't be wired to something that skips the gate. It deliberately never
    // loads authority, so it leaves the shared instance untouched.
    it('the export sync.ts calls is gated too, not an ungated shortcut', async () => {
      await appSingletonApply([surfaceChannel]);

      expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();
      expect(mocks.setSetting).not.toHaveBeenCalled();
    });
  });
});
