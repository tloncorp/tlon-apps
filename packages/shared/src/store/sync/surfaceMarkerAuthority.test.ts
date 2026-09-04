import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  getSurfaceNotificationDefaultedKey,
} from '@tloncorp/api';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as db from '../../db';
import { setScryOutputs, setupDatabaseTestSuite } from '../../test/helpers';
import { applySurfaceChannelNotificationDefaults } from '../surfaceNotificationDefaults';
import { syncSettings } from './sync';

/**
 * The §8 gate lives in `surfaceNotificationDefaults`, but it is only useful if
 * `syncSettings` actually hands it the ship's markers. Nothing else in the app
 * does, so if that one call is dropped no surface channel is ever hushed —
 * silent, and in the opposite direction from the defect the gate fixes. This
 * exercises the real `syncSettings` against a mocked scry to hold the wiring
 * in place.
 */

const mocks = vi.hoisted(() => ({
  setChannelVolumeLevel: vi.fn(),
}));

vi.mock('../activityActions', () => ({
  setChannelVolumeLevel: mocks.setChannelVolumeLevel,
}));

setupDatabaseTestSuite();

const SURFACE_CHANNEL_ID = 'chat/~zod/dashboard';
const MARKED_CHANNEL_ID = 'chat/~zod/status-board';

function surfaceChannel(id: string): db.Channel {
  return {
    id,
    groupId: '~zod/tlon',
    type: 'chat',
    contentConfiguration: {
      draftInput: { id: DraftInputId.chat },
      defaultPostContentRenderer: { id: PostContentRendererId.chat },
      defaultPostCollectionRenderer: { id: CollectionRendererId.surface },
    },
  } as unknown as db.Channel;
}

function deskSettings(markedChannelIds: string[]) {
  return {
    desk: {
      groups: Object.fromEntries(
        markedChannelIds.map((channelId) => [
          getSurfaceNotificationDefaultedKey(channelId),
          Date.now(),
        ])
      ),
    },
  };
}

describe('syncSettings establishes surface marker authority', () => {
  beforeEach(() => {
    mocks.setChannelVolumeLevel.mockReset();
    mocks.setChannelVolumeLevel.mockResolvedValue(true);
  });

  it('flushes a discovery that was deferred while the markers were unproven', async () => {
    // live discovery from the high-priority group subscription, before
    // settings have synced
    await applySurfaceChannelNotificationDefaults([
      surfaceChannel(SURFACE_CHANNEL_ID),
    ]);
    expect(mocks.setChannelVolumeLevel).not.toHaveBeenCalled();

    // the ship holds a marker for a different channel, so this one is
    // genuinely undefaulted
    setScryOutputs([deskSettings([MARKED_CHANNEL_ID])]);
    await syncSettings();

    expect(mocks.setChannelVolumeLevel).toHaveBeenCalledWith({
      channel: expect.objectContaining({ id: SURFACE_CHANNEL_ID }),
      level: 'hush',
    });
  });
});
