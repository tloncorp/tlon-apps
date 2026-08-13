import * as api from '@tloncorp/api';
import { BotHomeGroupSlugs } from '@tloncorp/api/types/wayfinding';
import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { LoadingSpinner } from '@tloncorp/ui';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'tamagui';

const logger = createDevLogger('AgentOnboardingSequence', false);
const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

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

      const groupId = `${api.getCurrentUserId()}/${BotHomeGroupSlugs.slug}`;
      const deadline = Date.now() + 2 * 60_000;
      let lastError: unknown;

      while (!cancelled && !completedRef.current && Date.now() < deadline) {
        try {
          const furnished = await store.ensureAgentGroupFurnished({ groupId });
          await db.agentOnboardingLanding.setValue({
            groupId,
            channelId: furnished.chatChannelId,
          });
          completedRef.current = true;
          logger.trackEvent('Agent Onboarding V2 In-Channel Handoff', {
            groupId,
            channelId: furnished.chatChannelId,
          });
          props.onCompleted();
          void store.completeWayfindingSplash();
          void furnished.tail.catch((error) => {
            logger.trackError('Agent standing reconciliation failed', {
              error,
              groupId,
            });
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
