/**
 * Dropping the user into their workspace conversation once it is reachable.
 *
 * Onboarding's last pane records a landing handoff instead of navigating,
 * because the workspace channel is created by a ship-side kit install and the
 * local row arrives with sync. Navigating on completion would open a screen for
 * a channel the database has never heard of. So this waits for the row, then
 * navigates once, then clears the handoff.
 *
 * Reactive to the stored handoff rather than a launch-time check: on web the
 * splash runs in a modal over an already-mounted chat list, and on any
 * platform the handoff can be written after this hook first mounts. A one-shot
 * read at mount silently missed both, which stranded the user on the chat
 * list.
 *
 * The handoff's channelId can be null — a fast user finishes onboarding
 * before the group row (whose kit blob names the conversation) has synced —
 * so the wait loop also resolves the conversation from the group as it lands.
 *
 * The waiting is bounded. A channel that never syncs is a real outcome — a
 * failed install, a ship that went away — and holding the user on a poll
 * forever is worse than leaving them on the chat list, where everything else
 * still works.
 */
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import {
  readWorkspaceDescriptor,
  workspaceConversation,
} from '@tloncorp/shared/logic';
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
  // never acted on twice. Keyed by group so a later, different handoff in the
  // same session still works.
  const consumedGroupId = useRef<string | null>(null);
  const pendingLanding = db.workspaceLanding.useValue();
  const pendingGroupId = pendingLanding?.groupId ?? null;

  useEffect(() => {
    if (!pendingGroupId || consumedGroupId.current === pendingGroupId) {
      return;
    }
    let active = true;
    const startedAt = Date.now();

    const run = async () => {
      while (active && consumedGroupId.current !== pendingGroupId) {
        let landing: db.WorkspaceLanding;
        try {
          landing = await db.workspaceLanding.getValue();
        } catch (error) {
          logger.trackError('Failed to read the workspace landing', { error });
          return;
        }

        let channelId = landing?.channelId ?? null;
        let channelExists = false;
        if (landing) {
          try {
            if (!channelId) {
              // Recorded before the group synced; the group's kit blob names
              // the conversation once it arrives.
              const group = await db.getGroup({ id: landing.groupId });
              channelId = workspaceConversation(readWorkspaceDescriptor(group));
            }
            if (channelId) {
              channelExists = !!(await db.getChannel({ id: channelId }));
            }
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
          channelId,
          channelExists,
          elapsedMs: Date.now() - startedAt,
        });

        if (decision.kind === 'idle') {
          return;
        }
        if (decision.kind === 'navigate') {
          consumedGroupId.current = decision.groupId;
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
          consumedGroupId.current = landing?.groupId ?? null;
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
  }, [pendingGroupId]);
}
