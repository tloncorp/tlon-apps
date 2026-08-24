import * as api from '@tloncorp/api';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { withRetry } from '@tloncorp/shared/logic';
import * as store from '@tloncorp/shared/store';
import { LoadingSpinner } from '@tloncorp/ui';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'tamagui';

import { AGENT_SHIP_OVERRIDE } from '../../../../lib/envVars';
import { getDefaultBotName } from '../botName';
import { withTimeout } from './promiseTimeout';

const logger = createDevLogger('AgentOnboardingSequence', false);
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const LANDING_CONSUMPTION_TIMEOUT_MS = 10_000;
const FURNISH_ATTEMPT_TIMEOUT_MS = 30_000;

async function waitForLandingConsumption(isCancelled: () => boolean) {
  const deadline = Date.now() + LANDING_CONSUMPTION_TIMEOUT_MS;
  while (!isCancelled() && Date.now() < deadline) {
    if ((await db.agentOnboardingLanding.getValue()) === null) {
      return true;
    }
    await wait(50);
  }
  return false;
}

async function syncInitialBotName() {
  const ownerShip = api.getCurrentUserId();
  const [hostedShipId, cachedNickname, ownerContact] = await Promise.all([
    db.hostedUserNodeId.getValue(),
    db.splashNickname.getValue().catch(() => ''),
    db.getContact({ id: ownerShip }).catch(() => null),
  ]);
  const userNickname =
    cachedNickname.trim() || ownerContact?.nickname?.trim() || '';
  if (!hostedShipId || !userNickname) {
    return;
  }

  const botName = getDefaultBotName(userNickname);
  await withRetry(() => api.setTlawnNickname(hostedShipId, botName), {
    startingDelay: 500,
    numOfAttempts: 3,
    maxDelay: 2_000,
  });
  logger.trackEvent('Agent Onboarding Bot Nickname Sync Succeeded');
}

async function clearNavigationLock(groupId: string) {
  await db.agentGroupOnboardingLocks.setValue((current) => {
    if (!current[groupId]) return current;
    const remaining = { ...current };
    delete remaining[groupId];
    return remaining;
  });
}

/**
 * Bridges the post-readiness splash into the real, provisioned home group.
 * The splash is outside the authenticated navigator, so the destination is
 * handed off durably and consumed by ChatListScreen after it mounts.
 */
export function AgentOnboardingSequence(props: {
  onCompleted: () => void;
  fallback: React.ReactNode;
}) {
  const [useFallback, setUseFallback] = useState(false);
  const completedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      let botEnabled: boolean;
      try {
        botEnabled = await db.hostingBotEnabled.getValue();
      } catch (error) {
        logger.trackError('Failed to read hosted bot status', { error });
        if (!cancelled) setUseFallback(true);
        return;
      }
      if (!botEnabled) {
        if (!cancelled) setUseFallback(true);
        return;
      }

      try {
        await syncInitialBotName();
      } catch (error) {
        logger.trackError('Agent onboarding bot nickname sync failed', {
          error,
        });
      }

      const groupId = `${api.getCurrentUserId()}/${BotHomeGroupSlugs.slug}`;
      const deadline = Date.now() + 2 * 60_000;
      let lastError: unknown;

      while (!cancelled && !completedRef.current && Date.now() < deadline) {
        try {
          const furnished = await withTimeout(
            store.ensureAgentGroupFurnished({
              groupId,
              agentShipId: AGENT_SHIP_OVERRIDE || undefined,
              isFirstGroup: true,
            }),
            Math.min(FURNISH_ATTEMPT_TIMEOUT_MS, deadline - Date.now()),
            'Agent group furnishing attempt timed out'
          );
          await db.agentOnboardingLanding.setValue({
            groupId,
            channelId: furnished.chatChannelId,
            status: 'pending',
          });
          // The onboarding conversation already teaches the bot interaction
          // model. Keep the legacy mention coach mark disarmed before the
          // authenticated navigator mounts so it cannot flash over the chat.
          await db.wayfindingProgress.setValue((progress) => ({
            ...progress,
            tappedHomeGroupHint: true,
          }));

          // The authenticated navigator is mounted behind this full-screen
          // cover. Keep the cover in place until it has built the final stack,
          // so the user lands in the chat instead of watching it navigate in.
          const landingConsumed = await waitForLandingConsumption(
            () => cancelled
          );
          if (cancelled) return;
          if (!landingConsumed) {
            logger.trackError('Agent onboarding landing was not consumed', {
              groupId,
              channelId: furnished.chatChannelId,
            });
          }
          // Do not permanently dismiss the first-run bridge while the agent
          // still lacks the standing required to accept provisioning. A
          // failed tail returns to the outer idempotent retry loop.
          await withTimeout(
            furnished.tail,
            Math.max(1, deadline - Date.now()),
            'Agent group standing did not become ready before the deadline'
          );
          completedRef.current = true;
          logger.trackEvent('Agent Onboarding V2 In-Channel Handoff', {
            groupId,
            channelId: furnished.chatChannelId,
          });
          props.onCompleted();
          void store.completeWayfindingSplash({
            showBotMentionHint: false,
          });
          return;
        } catch (error) {
          lastError = error;
          await wait(1_000);
        }
      }

      if (!cancelled && !completedRef.current) {
        logger.trackError('Hosted home group furnishing timed out', {
          error: lastError,
          groupId,
        });
        await clearNavigationLock(groupId);
        setUseFallback(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // The bridge must run once for this splash mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (useFallback) return <>{props.fallback}</>;

  return (
    <View flex={1} alignItems="center" justifyContent="center">
      <LoadingSpinner color="$secondaryText" />
    </View>
  );
}
