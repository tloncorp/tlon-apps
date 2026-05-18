import { useShip } from '@tloncorp/app/contexts/ship';
import { useStore } from '@tloncorp/app/ui';
import {
  AnalyticsEvent,
  HostedNodeStatus,
  createDevLogger,
} from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useCallback } from 'react';

const logger = createDevLogger('stopped node checker', true);

export type NodeStatusCheckResult = {
  nodeStatus: HostedNodeStatus;
  onboardingFlow?: Extract<db.ShipInfo['splashSequenceMode'], 'tlonbotRevival'>;
  didStopNode: boolean;
};

export function useCheckNodeStopped() {
  const store = useStore();
  const { clearShip } = useShip();
  const checkNodeStopped =
    useCallback(async (): Promise<NodeStatusCheckResult | null> => {
      const hostedUserNodeId = await db.hostedUserNodeId.getValue();
      const hostedUserId = await db.hostingUserId.getValue();
      const hostedAccountIsInitialized =
        await db.hostedAccountIsInitialized.getValue();

      if (!hostedUserNodeId || !hostedUserId || !hostedAccountIsInitialized) {
        // cannot enable node status check unless you logged in after receiving the "robust login" update
        return null;
      }

      try {
        const supressLog = true;
        const { status: nodeStatus, onboardingFlow } =
          await store.checkHostingNodeStatus(supressLog);
        if (
          [
            HostedNodeStatus.Paused,
            HostedNodeStatus.Suspended,
            HostedNodeStatus.UnderMaintenance,
          ].includes(nodeStatus)
        ) {
          logger.trackEvent(AnalyticsEvent.AuthenticatedNodeStopped);

          // track that the node was stopped while logged in
          await db.nodeStoppedWhileLoggedIn.setValue(true);

          // delete Urbit auth and without clearing hosting auth, kick back to unauthenticated view
          clearShip();
          return { nodeStatus, onboardingFlow, didStopNode: true };
        }

        return { nodeStatus, onboardingFlow, didStopNode: false };
      } catch (e) {
        logger.trackError('Failed to confirm logged in node is running', e);
        // fall through
        return null;
      }
    }, [clearShip, store]);

  return checkNodeStopped;
}
