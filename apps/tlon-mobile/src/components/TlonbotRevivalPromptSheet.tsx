import { useShip } from '@tloncorp/app/contexts/ship';
import { ActionSheet, YStack } from '@tloncorp/app/ui';
import { useSheetCloseAfterAnimation } from '@tloncorp/app/ui/hooks/useSheetCloseAfterAnimation';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  HostedNodeStatus,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, Text } from '@tloncorp/ui';
import { useCallback, useState } from 'react';

import type { NodeStatusCheckResult } from '../hooks/useCheckNodeStopped';
import { refreshHostingAuth } from '../lib/hostingAuth';

const logger = createDevLogger('TlonbotRevivalPromptSheet', true);

export function useTlonbotRevivalPrompt() {
  const { authCookie, authType, setShip, ship, shipUrl } = useShip();
  const { closeAfterAnimation } = useSheetCloseAfterAnimation();
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

  const handleStart = useCallback(async () => {
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
      severity: AnalyticsSeverity.High,
    });

    // useShip()'s cookie is captured at login and is not refreshed when the
    // client reauths mid-session, so replaying it here would push an expired
    // cookie back into persisted and native storage and re-break push
    // previews (TLON-6516). The persisted record is kept current by the
    // reauth handler in configureUrbitClient, so prefer it.
    //
    // waitForLock, because that handler persists fire-and-forget: an unlocked
    // read can land ahead of a refresh that is still queued and hand us the
    // very cookie we are trying to stop replaying.
    let currentAuthCookie = authCookie;
    try {
      const stored = await db.storage.shipInfo.getValue(true);
      if (
        stored?.ship === ship &&
        stored.shipUrl === shipUrl &&
        stored.authCookie
      ) {
        currentAuthCookie = stored.authCookie;
      }
    } catch (e) {
      logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
        error: e,
        context: 'failed to read the stored auth cookie for revival',
        severity: AnalyticsSeverity.High,
      });
    }

    closeAfterAnimation(() => {
      setShip({
        authCookie: currentAuthCookie,
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
            context:
              'failed to clear revival status after authenticated prompt',
            severity: AnalyticsSeverity.High,
          });
        });
    });
  }, [authCookie, authType, closeAfterAnimation, setShip, ship, shipUrl]);

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
    <ActionSheet open={open} onOpenChange={onOpenChange} modal>
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
