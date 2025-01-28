import { useShip } from '@tloncorp/app/contexts/ship';
import { HostedNodeStatus } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { useStore } from '@tloncorp/ui';
import { useCallback } from 'react';

export function useCheckNodeStopped() {
  const store = useStore();
  const { clearShip } = useShip();
  const checkNodeStopped = useCallback(async () => {
    const hostedUserNodeId = await db.hostedUserNodeId.getValue();
    const hostedUserId = await db.hostingUserId.getValue();
    const hostedAccountIsInitialized =
      await db.hostedAccountIsInitialized.getValue();

    if (!hostedUserNodeId || !hostedUserId || !hostedAccountIsInitialized) {
      // cannot enable node status check unless you logged in after receiving the "robust login" update
      return;
    }

    try {
      const supressLog = true;
      const nodeStatus = await store.checkHostingNodeStatus(supressLog);
      if (
        [
          HostedNodeStatus.Paused,
          HostedNodeStatus.Suspended,
          HostedNodeStatus.UnderMaintenance,
        ].includes(nodeStatus)
      ) {
        // track that the node was stopped while logged in
        await db.nodeStoppedWhileLoggedIn.setValue(true);

        // delete Urbit auth and without clearing hosting auth, kick back to unauthenticated view
        clearShip();
      }
    } catch (e) {
      // fall through
    }
  }, [clearShip, store]);

  return checkNodeStopped;
}
