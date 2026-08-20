/**
 * Dropping the user into their workspace conversation once it is reachable.
 *
 * Onboarding's last pane records a landing handoff instead of navigating,
 * because the workspace channel is created by a ship-side kit install and the
 * local row arrives with sync. Navigating on completion would open a screen for
 * a channel the database has never heard of. So this waits for the row, then
 * navigates once, then clears the handoff.
 *
 * The waiting is bounded. A channel that never syncs is a real outcome — a
 * failed install, a ship that went away — and holding the user on a poll
 * forever is worse than leaving them on the chat list, where everything else
 * still works.
 */
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useEffect, useRef } from 'react';

import { useRootNavigation } from '../navigation/utils';
import {
  WORKSPACE_LANDING_TIMEOUT_MS,
  decideLanding,
} from './workspaceLandingDecision';

const logger = createDevLogger('useWorkspaceLanding', false);

const POLL_INTERVAL_MS = 500;

export function useWorkspaceLanding() {
  const { resetToChannel } = useRootNavigation();
  const resetToChannelRef = useRef(resetToChannel);
  resetToChannelRef.current = resetToChannel;
  // Survives the remounts a navigation reset causes, so a consumed handoff is
  // never acted on twice.
  const consumed = useRef(false);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();

    const run = async () => {
      while (active && !consumed.current) {
        let landing: db.WorkspaceLanding;
        try {
          landing = await db.workspaceLanding.getValue();
        } catch (error) {
          logger.trackError('Failed to read the workspace landing', { error });
          return;
        }

        let channelExists = false;
        if (landing) {
          try {
            channelExists = !!(await db.getChannel({ id: landing.channelId }));
          } catch (error) {
            // A read failure is not proof the channel is missing, so this falls
            // through to 'wait' rather than giving up.
            logger.trackError('Failed to read the workspace landing channel', {
              error,
            });
          }
        }

        const decision = decideLanding({
          landing,
          channelExists,
          elapsedMs: Date.now() - startedAt,
        });

        if (decision.kind === 'idle') {
          return;
        }
        if (decision.kind === 'navigate') {
          consumed.current = true;
          await db.workspaceLanding.resetValue();
          if (!active) {
            return;
          }
          logger.trackEvent('Workspace Landing Navigated', {
            groupId: decision.groupId,
          });
          resetToChannelRef.current(decision.channelId, {
            groupId: decision.groupId,
          });
          return;
        }
        if (decision.kind === 'giveUp') {
          consumed.current = true;
          await db.workspaceLanding.resetValue();
          logger.trackEvent('Workspace Landing Timed Out', {
            groupId: landing?.groupId,
            timeoutMs: WORKSPACE_LANDING_TIMEOUT_MS,
          });
          return;
        }

        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    };

    void run();
    return () => {
      active = false;
    };
  }, []);
}
