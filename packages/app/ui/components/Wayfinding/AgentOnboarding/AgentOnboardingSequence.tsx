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
import { PromiseTimeoutError, withTimeout } from './promiseTimeout';

const logger = createDevLogger('AgentOnboardingSequence', false);
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
const LANDING_CONSUMPTION_TIMEOUT_MS = 10_000;
const FURNISH_ATTEMPT_TIMEOUT_MS = 30_000;
const BOT_NAME_SYNC_TIMEOUT_MS = 8_000;

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

async function retryLaterAgentGroupFurnishing({
  agentShipId,
  groupId,
  ownerId,
}: {
  agentShipId?: string;
  groupId: string;
  ownerId: string;
}) {
  for (const delayMs of [30_000, 60_000]) {
    await wait(delayMs);
    try {
      if (api.getCurrentUserId() !== ownerId) return;
      const repaired = await store.ensureAgentGroupFurnished({
        agentShipId,
        groupId,
        isFirstGroup: true,
      });
      await repaired.tail;
      return;
    } catch (error) {
      logger.trackError('Agent group furnishing retry failed', error);
    }
  }
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
      if (!botEnabled && !AGENT_SHIP_OVERRIDE) {
        if (!cancelled) setUseFallback(true);
        return;
      }

      // Hosting provisions the deterministic home group. The local override
      // has no Hosting automation, so let furnishing create a real group.
      const ownerId = api.getCurrentUserId();
      const hostedHomeGroupId = `${ownerId}/${BotHomeGroupSlugs.slug}`;
      let activeGroupId = AGENT_SHIP_OVERRIDE ? undefined : hostedHomeGroupId;
      let activeChannelId: string | undefined;
      let landedInAgentChat = false;
      const deadline = Date.now() + 2 * 60_000;

      try {
        await withTimeout(
          syncInitialBotName(),
          BOT_NAME_SYNC_TIMEOUT_MS,
          'Agent onboarding bot nickname sync timed out'
        );
      } catch (error) {
        logger.trackError('Agent onboarding bot nickname sync failed', {
          error,
        });
      }

      let lastError: unknown;

      while (!cancelled && !completedRef.current && Date.now() < deadline) {
        try {
          const furnishing = store.ensureAgentGroupFurnished({
            groupId: AGENT_SHIP_OVERRIDE ? undefined : hostedHomeGroupId,
            agentShipId: AGENT_SHIP_OVERRIDE || undefined,
            isFirstGroup: true,
          });
          let furnished: Awaited<typeof furnishing>;
          try {
            furnished = await withTimeout(
              furnishing,
              Math.min(FURNISH_ATTEMPT_TIMEOUT_MS, deadline - Date.now()),
              'Agent group furnishing attempt timed out'
            );
          } catch (error) {
            if (!(error instanceof PromiseTimeoutError)) throw error;
            // Promise.race cannot cancel the Urbit requests already in flight.
            // Keep awaiting this attempt within the overall deadline instead
            // of starting a concurrent furnishing pass that could duplicate a
            // channel or intro request.
            try {
              furnished = await withTimeout(
                furnishing,
                Math.max(1, deadline - Date.now()),
                'Agent group furnishing did not finish before the deadline'
              );
            } catch (deadlineError) {
              // The request itself is not cancellable. If it completes after
              // fallback cleared the lock, clear it again so the abandoned
              // furnishing pass cannot recreate a navigation trap.
              void furnishing
                .then((late) => clearNavigationLock(late.group.id))
                .catch(() => undefined);
              throw deadlineError;
            }
          }
          if (cancelled) {
            // Furnishing cannot be cancelled. If it resolves after this
            // account's onboarding unmounts, remove its late lock before any
            // landing or wayfinding state can be written for the next session.
            await clearNavigationLock(furnished.group.id);
            return;
          }
          activeGroupId = furnished.group.id;
          activeChannelId = furnished.chatChannelId;
          await db.agentOnboardingLanding.setValue({
            groupId: activeGroupId,
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
            const error = new Error(
              'Agent onboarding landing was not consumed'
            );
            logger.trackError(error.message, {
              error,
              groupId: activeGroupId,
              channelId: furnished.chatChannelId,
            });
            throw error;
          }
          landedInAgentChat = true;
          // Keep the cover until the bot is visibly joined and the admin grant
          // request has been accepted. Its read-back verification can continue
          // after the already-mounted conversation becomes visible.
          await withTimeout(
            furnished.readyToReveal,
            Math.max(1, deadline - Date.now()),
            'Agent group did not become ready to reveal before the deadline'
          );
          void furnished.tail.catch((error) => {
            logger.trackError(
              'Agent group admin verification failed; scheduling retry',
              { error, groupId: activeGroupId }
            );
            void retryLaterAgentGroupFurnishing({
              agentShipId: AGENT_SHIP_OVERRIDE || undefined,
              groupId: furnished.group.id,
              ownerId,
            });
          });
          completedRef.current = true;
          logger.trackEvent('Agent Onboarding V2 In-Channel Handoff', {
            groupId: activeGroupId,
            channelId: furnished.chatChannelId,
          });
          props.onCompleted();
          void store
            .completeWayfindingSplash({
              showBotMentionHint: false,
            })
            .catch((error) => {
              logger.trackError(
                'Failed to persist agent onboarding completion',
                error
              );
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
          groupId: activeGroupId,
        });
        if (activeGroupId) await clearNavigationLock(activeGroupId);
        if (landedInAgentChat && activeGroupId && activeChannelId) {
          await db.agentOnboardingLanding.setValue({
            groupId: activeGroupId,
            channelId: activeChannelId,
            status: 'fallback',
          });
        } else {
          await db.agentOnboardingLanding.resetValue();
        }
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
