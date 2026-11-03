import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useEffect } from 'react';

import { useAgentGroupOnboardingLock } from '../../hooks/useAgentGroupOnboardingLock';
import { shouldAcknowledgeAgentOnboardingLanding } from './agentOnboardingLanding';

const logger = createDevLogger('useAgentOnboardingChannel', false);

/**
 * Everything ChannelScreen owes agent onboarding: acknowledge the durable
 * landing handoff and reconcile the bot's provision receipt onto the group's
 * onboarding record.
 */
export function useAgentOnboardingChannel({
  channelId,
  currentChannelId,
  groupId,
  routeGroupId,
}: {
  /** Channel id from the route — the landing handoff's target. */
  channelId: string;
  /** Channel currently rendered (can lag the route during transitions). */
  currentChannelId: string;
  /** Group resolved from the loaded channel/group records. */
  groupId?: string;
  /** Group id passed on the route, available before records load. */
  routeGroupId?: string;
}) {
  const onboardingLanding = db.agentOnboardingLanding.useValue();
  useEffect(() => {
    if (
      !shouldAcknowledgeAgentOnboardingLanding(onboardingLanding, channelId)
    ) {
      return;
    }

    // The destination is mounted, so the full-screen onboarding cover can
    // disappear without waiting for the bounded handoff timeout.
    void db.agentOnboardingLanding.resetValue().catch((error) => {
      logger.trackError('Failed to acknowledge agent onboarding landing', {
        error,
        ...onboardingLanding,
      });
    });
  }, [channelId, onboardingLanding]);

  const agentOnboardingGroupId = routeGroupId ?? groupId;
  const agentOnboarding = useAgentGroupOnboardingLock(agentOnboardingGroupId);
  const agentGroupAgents = db.agentGroupAgents.useValue();
  // A DM has no loaded group; the route carries it. Everything that keys
  // on the group — agent, acknowledgement, marker — uses the same id.
  const agentShipId = agentOnboardingGroupId
    ? agentGroupAgents[agentOnboardingGroupId]
    : undefined;
  const latestChannelSequenceNum =
    store.useChannelLatestSequenceNum(currentChannelId);

  useEffect(() => {
    const provision = agentOnboarding.marker?.provision;
    const lockGroupId = agentOnboardingGroupId;
    if (
      !lockGroupId ||
      !agentShipId ||
      !provision ||
      latestChannelSequenceNum == null ||
      agentOnboarding.marker?.provisionAcknowledgedAt
    ) {
      return;
    }
    let cancelled = false;
    void db
      .getChanPosts({ channelId: currentChannelId })
      .then((channelPosts) => {
        if (cancelled) return;
        const acknowledged = channelPosts.some(
          (post) =>
            post.authorId === agentShipId &&
            api.findPostBlobEntry(post.blob, 'tlon-agent-provision-ack')
              ?.provisionId === provision.provisionId
        );
        if (!acknowledged) return;
        return db.agentGroupOnboardingLocks.setValue((current) => {
          const lock = current[lockGroupId];
          if (
            !lock ||
            lock.provisionAcknowledgedAt ||
            lock.provision?.provisionId !== provision.provisionId
          ) {
            return current;
          }
          return {
            ...current,
            [lockGroupId]: { ...lock, provisionAcknowledgedAt: Date.now() },
          };
        });
      })
      .catch((error) => {
        if (!cancelled) {
          logger.trackError('Failed to reconcile agent provision receipt', {
            error,
            groupId: lockGroupId,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    agentOnboarding.marker,
    agentOnboardingGroupId,
    agentShipId,
    currentChannelId,
    latestChannelSequenceNum,
  ]);

  return { agentOnboarding, agentShipId };
}
