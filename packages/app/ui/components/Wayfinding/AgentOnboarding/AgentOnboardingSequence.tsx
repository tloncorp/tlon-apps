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
 * no hosted bot exists it renders `fallback` — the standard splash — instead.
 * Hosted provisioning is asynchronous, so an enabled account keeps waiting
 * for the real home-group target rather than treating a short delay as absence.
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
      // No resident bot means no conversational onboarding, full stop: fall
      // back to the standard splash immediately. Without this, the retry
      // below makes every bot-less account sit on a spinner for its full
      // duration, waiting out a lookup that can only ever return null.
      let botEnabled: boolean | null;
      try {
        botEnabled = await db.hostingBotEnabled.getValue();
      } catch (error) {
        logger.trackError('Failed to read hosted bot status', { error });
        if (!cancelled) {
          setHomeGroupMissing(true);
        }
        return;
      }
      if (cancelled || redirectedRef.current) {
        return;
      }
      if (!botEnabled) {
        setHomeGroupMissing(true);
        return;
      }
      // The Urbit client and hosted home group are configured asynchronously.
      // A null lookup cannot distinguish an unfinished provision from a
      // missing group, so keep waiting while this enabled onboarding surface
      // is mounted instead of permanently latching the legacy fallback.
      let resolution = await store.resolveHomeGroupOnboarding();
      while (resolution.status === 'pending') {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        if (cancelled || redirectedRef.current) {
          return;
        }
        resolution = await store.resolveHomeGroupOnboarding();
      }
      if (cancelled || redirectedRef.current) {
        return;
      }
      if (resolution.status === 'fallback') {
        setHomeGroupMissing(true);
        return;
      }
      const { target } = resolution;
      logger.trackEvent('Agent Onboarding In-Channel Handoff', target);
      try {
        await db.agentOnboardingLanding.setValue(target);
        // Durable, so the channel knows it's the guided group and can hold
        // its chrome (back button, etc.) until the agent finishes the setup.
        await db.agentOnboardingGroupId.setValue(target.groupId);
      } catch (error) {
        logger.trackError('Failed to arm in-channel onboarding', { error });
        await Promise.allSettled([
          db.agentOnboardingLanding.resetValue(),
          db.agentOnboardingGroupId.resetValue(),
        ]);
        if (!cancelled) {
          setHomeGroupMissing(true);
        }
        return;
      }
      redirectedRef.current = true;
      // The client didn't seat this agent (provisioning did), so learn its
      // ship from the hosting config — that record is what lets the bot's
      // opening cards render as trusted before the group has any config.
      store.recordHomeGroupAgent(target.groupId).catch(() => {
        // Already logged inside; cards degrade to text until config lands.
      });
      props.onCompleted();
      store
        .completeWayfindingSplash({ skipBotMentionHint: true })
        .catch((error) => {
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
