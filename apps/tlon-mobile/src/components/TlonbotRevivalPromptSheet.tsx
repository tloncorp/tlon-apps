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

    // Scheduled synchronously, and the stored session is read inside the
    // delayed callback rather than before it. Reading first would both leave a
    // window for the close animation to carry a snapshot across (a reauth
    // landing in those 300ms would be overwritten) and put an await ahead of
    // the scheduling, which is what let a close action outlive its tree.
    closeAfterAnimation(() => {
      void (async () => {
        // useShip()'s snapshot is captured at login and is not refreshed when
        // the client reauths mid-session, so replaying its cookie would push an
        // expired one back into persisted and native storage and re-break push
        // previews (TLON-6516). waitForLock because the reauth handler persists
        // fire-and-forget, and an unlocked read can land ahead of a refresh
        // still queued.
        let storedSession: db.ShipInfo | null = null;
        try {
          storedSession = await db.storage.shipInfo.getValue(true);
        } catch (e) {
          // We cannot confirm which session we are in, and setShip with the
          // wrong one corrupts it. Losing this prompt is recoverable; revival
          // can be started again from settings.
          logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
            error: e,
            context: 'could not confirm the stored session before revival',
            severity: AnalyticsSeverity.High,
          });
          return;
        }

        // A logout or account switch can land during that read. Falling back to
        // the captured snapshot would have setShip restore the logged-out
        // account or overwrite the new one, so abort instead.
        if (
          !storedSession ||
          storedSession.ship !== ship ||
          storedSession.shipUrl !== shipUrl
        ) {
          logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
            context: 'stored session changed before revival could start',
            severity: AnalyticsSeverity.High,
          });
          return;
        }

        setShip({
          authCookie: storedSession.authCookie ?? authCookie,
          authType: storedSession.authType ?? authType ?? 'hosted',
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
      })();
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
