import { useShip } from '@tloncorp/app/contexts/ship';
import { ActionSheet, YStack } from '@tloncorp/app/ui';
import { useSheetDismissalAction } from '@tloncorp/app/ui/hooks/useSheetDismissalAction';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  HostedNodeStatus,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import { Button, Text, useIsWindowNarrow } from '@tloncorp/ui';
import { useCallback, useState } from 'react';
import { Platform } from 'react-native';

import type { NodeStatusCheckResult } from '../hooks/useCheckNodeStopped';

const logger = createDevLogger('TlonbotRevivalPromptSheet', true);

export function useTlonbotRevivalPrompt(
  requireHostingAuth: (options?: { force?: boolean }) => Promise<boolean>
) {
  const { ship, shipUrl, startSplashSequence } = useShip();
  const [open, setOpen] = useState(false);
  const [snoozed, setSnoozed] = useState(false);
  const isWindowNarrow = useIsWindowNarrow();
  const { dismissThenRun, onDismissed, presentationKey } =
    useSheetDismissalAction({
      open,
      onOpenChange: setOpen,
      waitForDismissal: Platform.OS !== 'web' && isWindowNarrow,
    });

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

      if (!(await requireHostingAuth({ force: true }))) {
        return;
      }
      const hostingBotEnabled = await db.hostingBotEnabled.getValue();
      if (!hostingBotEnabled) {
        setOpen(true);
      }
    },
    [requireHostingAuth, snoozed]
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
      severity: AnalyticsSeverity.High,
    });

    // Schedule synchronously so unmount can cancel the action. The provider
    // callback is scoped to this render's session and updates only splash
    // fields, so it neither revives a replaced session nor replays the stale
    // auth-cookie snapshot held by useShip().
    dismissThenRun(() => {
      if (!startSplashSequence('tlonbotRevival')) {
        logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
          context: 'session changed before revival could start',
          severity: AnalyticsSeverity.High,
        });
        return;
      }

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
  }, [dismissThenRun, ship, shipUrl, startSplashSequence]);

  const promptSheet = (
    <TlonbotRevivalPromptSheet
      key={presentationKey}
      open={open}
      onOpenChange={handleOpenChange}
      onStart={handleStart}
      onNativeDismissed={onDismissed}
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
  onNativeDismissed,
}: {
  onOpenChange: (open: boolean) => void;
  onStart: () => void;
  open: boolean;
  onNativeDismissed?: () => void;
}) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      onNativeDismissed={onNativeDismissed}
      modal
    >
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
