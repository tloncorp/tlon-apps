import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '@tloncorp/api';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { BackHandler } from 'react-native';

import { useAgentGroupOnboardingLock } from '../../hooks/useAgentGroupOnboardingLock';
import type { RootStackParamList } from '../../navigation/types';
import { createTypedReset, getTopLevelTabRoute } from '../../navigation/utils';
import {
  shouldAcknowledgeAgentOnboardingLanding,
  shouldRestoreAgentOnboardingFallback,
} from './agentOnboardingLanding';

const logger = createDevLogger('useAgentOnboardingChannel', false);

/**
 * Everything ChannelScreen owes agent onboarding: consume or restore the
 * durable landing handoff, reconcile the bot's provision receipt onto the
 * navigation lock, and hold navigation captive (back gesture, hardware back)
 * while the lock is active.
 */
export function useAgentOnboardingChannel({
  navigation,
  channelId,
  currentChannelId,
  groupId,
  routeGroupId,
}: {
  navigation: NativeStackScreenProps<
    RootStackParamList,
    'Channel'
  >['navigation'];
  /** Channel id from the route — the landing handoff's target. */
  channelId: string;
  /** Channel currently rendered (can lag the route during transitions). */
  currentChannelId: string;
  /** Group resolved from the loaded channel/group records. */
  groupId?: string;
  /** Group id passed on the route, available before records load. */
  routeGroupId?: string;
}) {
  const navigationRef = useRef(navigation);
  navigationRef.current = navigation;

  const onboardingLanding = db.agentOnboardingLanding.useValue();
  const resetNavigation = useMemo(
    () => createTypedReset(navigation),
    [navigation]
  );
  useEffect(() => {
    if (!shouldRestoreAgentOnboardingFallback(onboardingLanding, channelId)) {
      return;
    }
    // The legacy splash is still covering the navigator. Restore its normal
    // Home destination underneath before the fallback can be completed.
    resetNavigation([getTopLevelTabRoute('ChatList')]);
    void db.agentOnboardingLanding.resetValue().catch((error) => {
      logger.trackError('Failed to clear agent onboarding fallback route', {
        error,
        ...onboardingLanding,
      });
    });
  }, [channelId, onboardingLanding, resetNavigation]);
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
  const navigationLocked =
    agentOnboarding.locked ||
    Boolean(agentOnboardingGroupId && agentOnboarding.isLoading);
  const agentGroupAgents = db.agentGroupAgents.useValue();
  const agentShipId = groupId ? agentGroupAgents[groupId] : undefined;
  const latestChannelSequenceNum =
    store.useChannelLatestSequenceNum(currentChannelId);

  useEffect(() => {
    const provision = agentOnboarding.marker?.provision;
    if (
      !groupId ||
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
          const lock = current[groupId];
          if (
            !lock ||
            lock.provisionAcknowledgedAt ||
            lock.provision?.provisionId !== provision.provisionId
          ) {
            return current;
          }
          return {
            ...current,
            [groupId]: { ...lock, provisionAcknowledgedAt: Date.now() },
          };
        });
      })
      .catch((error) => {
        if (!cancelled) {
          logger.trackError('Failed to reconcile agent provision receipt', {
            error,
            groupId,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    agentOnboarding.marker,
    agentShipId,
    currentChannelId,
    groupId,
    latestChannelSequenceNum,
  ]);

  useEffect(() => {
    navigationRef.current.setOptions({
      gestureEnabled: !navigationLocked,
    });
  }, [navigationLocked]);

  useFocusEffect(
    useCallback(() => {
      if (!navigationLocked) return;
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => true
      );
      return () => subscription.remove();
    }, [navigationLocked])
  );

  return { agentOnboarding, agentShipId, navigationLocked };
}
