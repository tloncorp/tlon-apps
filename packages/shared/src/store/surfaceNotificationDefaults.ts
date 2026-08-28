import * as api from '@tloncorp/api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as logic from '../logic';
import { setChannelVolumeLevel } from './activityActions';

const logger = createDevLogger('surfaceNotificationDefaults', false);

/**
 * Plan §8: surface channels are excluded from unread badges, activity
 * summaries, *and* notifications wholesale.
 *
 * Badges and summaries are filtered client-side, but notifications can't be:
 * the activity payload carries neither the post's kind nor its blob, the
 * backend has no surface awareness at all, and the default volume map is
 * `[%post & &]` — unreads *and* notify. Left alone, every dashboard button
 * tap pushes to every unmuted member.
 *
 * The only place that decision can be unmade is the recipient's own
 * `%activity` agent, which computes `shouldNotify` from that recipient's own
 * volume settings. So on discovery we set the channel's volume to `hush`,
 * which suppresses browser, Electron, and native push together — something no
 * presentation-side filter can do.
 *
 * Doing that unconditionally would trample the user: unmuting *removes* the
 * volume entry (`adjustVolumeSetting(source, null)`), so from the volume map
 * alone "unmuted by choice" and "never touched" are the same state, and every
 * sync would re-hush. Hence the one-shot marker below.
 */

// In-flight channel ids, so overlapping discovery passes (boot sync racing a
// live group update) don't double-poke before the marker lands.
const inFlight = new Set<string>();

async function markDefaulted(channelId: string) {
  // The ship write comes first and the local mirror only follows a success:
  // the marker is the record of "this account already hushed this channel",
  // and a marker cached locally but never written to the ship would make this
  // device skip the hush forever while other devices keep re-applying it.
  await api.setSetting(
    api.getSurfaceNotificationDefaultedKey(channelId),
    Date.now()
  );
  await db.surfaceNotificationDefaultedChannelIds.setValue((current) =>
    current.includes(channelId) ? current : [...current, channelId]
  );
}

/**
 * Hushes any newly discovered surface channel exactly once per account.
 *
 * Pass `candidates` for live discovery (a channel that just arrived over
 * `%groups`); omit it to sweep every locally known channel, which is what the
 * post-sync pass does.
 *
 * Never rejects — callers are sync/update paths that must not fail because a
 * volume poke did.
 */
export async function applySurfaceChannelNotificationDefaults(
  candidates?: db.Channel[]
): Promise<void> {
  try {
    const channels = candidates ?? (await db.getAllChannels());
    const surfaceChannels = channels.filter((channel) =>
      logic.isSurfaceChannel(channel)
    );
    if (surfaceChannels.length === 0) {
      return;
    }

    const defaulted = new Set(
      await db.surfaceNotificationDefaultedChannelIds.getValue()
    );

    for (const channel of surfaceChannels) {
      if (defaulted.has(channel.id) || inFlight.has(channel.id)) {
        continue;
      }
      inFlight.add(channel.id);
      try {
        const hushed = await setChannelVolumeLevel({ channel, level: 'hush' });
        if (!hushed) {
          // Offline, or the poke was rejected. Leave the channel unmarked so
          // the next discovery retries; marking it now would leave the channel
          // notifying on the ship with nothing left to correct it.
          logger.log('surface channel hush did not land, will retry', {
            channelId: channel.id,
          });
          continue;
        }
        await markDefaulted(channel.id);
      } catch (e) {
        logger.trackError('failed to apply surface notification default', {
          error: e,
          channelId: channel.id,
        });
      } finally {
        inFlight.delete(channel.id);
      }
    }
  } catch (e) {
    logger.trackError('surface notification defaults pass failed', {
      error: e,
    });
  }
}
