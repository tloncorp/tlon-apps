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
 *
 * That marker only protects the user if it is READ from the ship before it is
 * ACTED ON. The local mirror starts empty on a fresh client and is filled by
 * `syncSettings`, which runs at low priority — well after the high-priority
 * group subscriptions that drive live channel discovery. Hushing against an
 * empty mirror in that window re-mutes a surface the user unmuted on another
 * device, and the marker arriving afterwards cannot undo it. So the mirror is
 * not treated as authoritative until a settings sync has actually loaded it
 * this session, and discoveries before that are queued rather than acted on
 * or dropped.
 */

export interface SurfaceNotificationDefaults {
  /**
   * Hushes any newly discovered surface channel exactly once per account.
   *
   * Pass `candidates` for live discovery (a channel that just arrived over
   * `%groups`); omit it to sweep every locally known channel, which is what
   * the post-sync pass does.
   *
   * A no-op until the markers have loaded; the work is deferred to
   * `installMarkersFromShip` instead.
   *
   * Never rejects — callers are sync/update paths that must not fail because
   * a volume poke did.
   */
  apply(candidates?: db.Channel[]): Promise<void>;
  /**
   * Replaces the local marker mirror with the ship's, marks it authoritative,
   * and flushes whatever discovery happened while it was still unproven.
   *
   * Writing the mirror and declaring it authoritative are ONE call on
   * purpose. As two, a caller can do the write and forget the declaration —
   * in which case nothing is ever hushed — or declare authority without a
   * write, which is the original defect. Neither is expressible here.
   *
   * Never rejects.
   */
  installMarkersFromShip(channelIds: string[]): Promise<void>;
}

/**
 * All of the state below is per-process and mutable, which is exactly why it
 * is built here rather than at module scope: a test (and the next session)
 * gets a client that has demonstrably never synced, instead of inheriting
 * whatever the last one established.
 */
export function createSurfaceNotificationDefaults(): SurfaceNotificationDefaults {
  // In-flight channel ids, so overlapping discovery passes (boot sync racing
  // a live group update) don't double-poke before the marker lands.
  const inFlight = new Set<string>();

  /**
   * Has a settings sync loaded the ship-side markers into the local mirror
   * this session? Never persisted: a mirror left over from a previous run may
   * predate an unmute performed elsewhere, and only a fresh read proves
   * otherwise.
   *
   * While this is false the cost of waiting is that a newly discovered
   * surface channel can notify until settings land. That is the deliberate
   * direction to err in — a stray notification is recoverable, silently
   * overriding the user's unmute is not.
   */
  let markerAuthorityLoaded = false;

  // Surface channels discovered live before the markers loaded, keyed by id
  // so a chatty update stream can't grow this without bound. Queued, not
  // dropped: the discovery is the only signal that a channel appeared, and
  // losing it would leave the channel notifying until the next full sweep.
  const deferredCandidates = new Map<string, db.Channel>();

  // A full sweep asked for before the markers loaded — which is exactly the
  // case where `syncSettings` failed but the volume poke path still works.
  let deferredSweep = false;

  async function markDefaulted(channelId: string) {
    // The ship write comes first and the local mirror only follows a success:
    // the marker is the record of "this account already hushed this channel",
    // and a marker cached locally but never written to the ship would make
    // this device skip the hush forever while other devices keep re-applying
    // it.
    await api.setSetting(
      api.getSurfaceNotificationDefaultedKey(channelId),
      Date.now()
    );
    await db.surfaceNotificationDefaultedChannelIds.setValue((current) =>
      current.includes(channelId) ? current : [...current, channelId]
    );
  }

  function defer(candidates?: db.Channel[]) {
    // The mirrored markers are not yet known to match the ship's, so every
    // "this channel was never defaulted" reading is unproven. Hold the
    // discovery instead of acting on it. Recorded before any channel read so
    // a deferred sweep survives even when nothing has synced yet and the
    // local store still looks empty.
    if (candidates) {
      for (const channel of candidates.filter((channel) =>
        logic.isSurfaceChannel(channel)
      )) {
        deferredCandidates.set(channel.id, channel);
      }
    } else {
      deferredSweep = true;
    }
    logger.log('deferring surface notification defaults until markers load', {
      deferredCandidates: deferredCandidates.size,
      sweep: deferredSweep,
    });
  }

  async function apply(candidates?: db.Channel[]): Promise<void> {
    try {
      if (!markerAuthorityLoaded) {
        defer(candidates);
        return;
      }

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
          const hushed = await setChannelVolumeLevel({
            channel,
            level: 'hush',
          });
          if (!hushed) {
            // Offline, or the poke was rejected. Leave the channel unmarked
            // so the next discovery retries; marking it now would leave the
            // channel notifying on the ship with nothing left to correct it.
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

  async function installMarkersFromShip(channelIds: string[]): Promise<void> {
    try {
      await db.surfaceNotificationDefaultedChannelIds.setValue(channelIds);
    } catch (e) {
      // The mirror still holds whatever it held before, which is exactly the
      // unproven state the gate exists for. Leave authority unclaimed and let
      // the next settings sync try again.
      logger.trackError('failed to install surface markers from ship', {
        error: e,
      });
      return;
    }
    markerAuthorityLoaded = true;

    const queued = [...deferredCandidates.values()];
    deferredCandidates.clear();
    const sweep = deferredSweep;
    deferredSweep = false;

    if (queued.length > 0) {
      await apply(queued);
    }
    if (sweep) {
      await apply();
    }
  }

  return { apply, installMarkersFromShip };
}

const defaults = createSurfaceNotificationDefaults();

export const applySurfaceChannelNotificationDefaults = defaults.apply;
export const installSurfaceMarkersFromShip = defaults.installMarkersFromShip;
