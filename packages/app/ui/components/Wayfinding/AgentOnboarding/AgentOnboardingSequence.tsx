import { createDevLogger } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { LoadingSpinner } from '@tloncorp/ui';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'tamagui';

const logger = createDevLogger('AgentOnboarding', false);

/**
 * Conversational onboarding entry point. The conversation happens for real,
 * inside the hosted home group's chat channel — the live agent conducts the
 * onboarding there (its bootstrap prompt owns the script), so this component
 * just lands the user in that channel: it arms the `agentOnboardingLanding`
 * handoff (consumed on chat list mount) and dismisses the splash. When no
 * home group exists (self-hosted, or provisioning hasn't delivered it yet)
 * it renders `fallback` — the standard splash — instead.
 */
export function AgentOnboardingSequence(props: {
  onCompleted: () => void;
  fallback: React.ReactNode;
}) {
  const [homeGroupMissing, setHomeGroupMissing] = useState(false);
  const redirectedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The Urbit client is configured by a parent effect, which may not have
      // run yet on a cold mount — and an unconfigured client makes the lookup
      // return null, indistinguishable from "no home group". Retry briefly
      // before giving up, or a fresh signup falls back to the old splash
      // permanently (this effect never runs again).
      let target = await store.getHomeGroupOnboardingTarget();
      for (let attempt = 0; !target && attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
        if (cancelled || redirectedRef.current) {
          return;
        }
        target = await store.getHomeGroupOnboardingTarget();
      }
      if (cancelled || redirectedRef.current) {
        return;
      }
      if (!target) {
        setHomeGroupMissing(true);
        return;
      }
      redirectedRef.current = true;
      logger.trackEvent('Agent Onboarding In-Channel Handoff', target);
      try {
        await db.agentOnboardingLanding.setValue(target);
        // Durable, so the channel knows it's the guided group and can hold
        // its chrome (back button, etc.) until the agent finishes the setup.
        await db.agentOnboardingGroupId.setValue(target.groupId);
      } catch (error) {
        logger.trackError('Failed to arm in-channel onboarding', { error });
      }
      props.onCompleted();
      store.completeWayfindingSplash().catch((error) => {
        logger.trackError('Failed to complete wayfinding splash', { error });
      });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (homeGroupMissing) {
    return <>{props.fallback}</>;
  }

  return (
    <View flex={1} alignItems="center" justifyContent="center">
      <LoadingSpinner color="$secondaryText" />
    </View>
  );
}
