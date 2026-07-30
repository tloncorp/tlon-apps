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
      const target = await store.getHomeGroupOnboardingTarget();
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
