import { useShip } from '@tloncorp/app/contexts/ship';
import { ActionSheet, YStack, useStore } from '@tloncorp/app/ui';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  HostedNodeStatus,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import type { NodeStatusCheckResult } from '../hooks/useCheckNodeStopped';
import { refreshHostingAuth } from '../lib/hostingAuth';

const logger = createDevLogger('TlonbotRevivalPromptSheet', true);

export function useTlonbotRevivalPrompt() {
  const store = useStore();
  const { authCookie, authType, setShip, ship, shipUrl } = useShip();
  const [open, setOpen] = useState(false);
  const [snoozed, setSnoozed] = useState(false);

  const maybeShowPrompt = useCallback(
    async (nodeCheck: NodeStatusCheckResult | null) => {
      if (
        nodeCheck?.nodeStatus !== HostedNodeStatus.Running ||
        nodeCheck.onboardingFlow !== 'tlonbotRevival' ||
        nodeCheck.didStopNode ||
        snoozed
      ) {
        return;
      }

      await refreshHostingAuth({ force: true });
      const hostingBotEnabled = await db.hostingBotEnabled.getValue();
      if (!hostingBotEnabled) {
        setOpen(true);
      }
    },
    [snoozed]
  );

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSnoozed(true);
    }
  }, []);

  const handleStart = useCallback(() => {
    setOpen(false);
    setSnoozed(true);
    if (!ship || !shipUrl) {
      logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
        context: 'tried to start authenticated revival flow without ship info',
        severity: AnalyticsSeverity.High,
      });
      return;
    }

    logger.trackEvent(AnalyticsEvent.InitiatedTlonbotRevival, {
      source: 'authenticated_prompt',
    });

    setShip({
      authCookie,
      authType: authType ?? 'hosted',
      needsSplashSequence: true,
      ship,
      shipUrl,
      splashSequenceMode: 'tlonbotRevival',
    });

    store
      .clearShipRevivalStatus()
      .then(() => {
        logger.trackEvent('Toggled Hosting Revival Status');
      })
      .catch((e) => {
        logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
          error: e,
          context: 'failed to clear revival status after authenticated prompt',
          severity: AnalyticsSeverity.High,
        });
      });
  }, [authCookie, authType, setShip, ship, shipUrl, store]);

  const promptSheet = (
    <TlonbotRevivalPromptSheet
      open={open}
      onOpenChange={handleOpenChange}
      onStart={handleStart}
    />
  );

  return {
    maybeShowPrompt,
    promptSheet,
  };
}

export function TlonbotRevivalPromptSheet({
  onOpenChange,
  onStart,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  onStart: () => void;
  open: boolean;
}) {
  return (
    <ActionSheet open={open} onOpenChange={onOpenChange}>
      <ActionSheet.SimpleHeader title="Ready for Tlonbot?" />
      <ActionSheet.Content marginHorizontal="$xl">
        <ActionSheet.ContentBlock>
          <Text size="$body" color="$secondaryText">
            Tlonbot is now available. Set up only takes a few minutes.
          </Text>
        </ActionSheet.ContentBlock>
        <ActionSheet.ContentBlock>
          <YStack gap="$xl">
            <Button
              label="Begin Setup"
              preset="hero"
              onPress={onStart}
              shadow
            />
            <Button
              label="Not now"
              preset="secondary"
              backgroundColor="$transparent"
              onPress={() => onOpenChange(false)}
            />
          </YStack>
        </ActionSheet.ContentBlock>
      </ActionSheet.Content>
    </ActionSheet>
  );
}
