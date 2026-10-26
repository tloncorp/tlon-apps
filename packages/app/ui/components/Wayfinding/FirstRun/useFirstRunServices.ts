import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  type McpConnectionEvent,
  useMcpConnections,
} from '../../../../features/settings/useMcpConnections';
import {
  type ServiceAttempt,
  attemptAfterCheck,
  hasConnectedService,
  selectFeaturedServices,
} from './firstRunServices';

/**
 * Screen 3's live data: the catalog, this account's grants, and where each
 * featured service's sign-in stands. A row says connected only after a status
 * check confirms the grant.
 */
export function useFirstRunServices() {
  const [attempts, setAttempts] = useState<
    Record<string, ServiceAttempt | undefined>
  >({});
  const setAttempt = useCallback(
    (providerId: string, attempt: ServiceAttempt | undefined) =>
      setAttempts((current) => ({ ...current, [providerId]: attempt })),
    []
  );
  const verifyRef = useRef<
    (providerId: string, outcome: 'completed' | 'returned') => void
  >(() => {});

  const handleEvent = useCallback(
    (event: McpConnectionEvent) => {
      switch (event.type) {
        case 'completed':
          if (!event.providerId) return;
          if (event.success) {
            verifyRef.current(event.providerId, 'completed');
          } else {
            setAttempt(event.providerId, 'failed');
          }
          return;
        case 'returned':
          verifyRef.current(event.providerId, 'returned');
          return;
        case 'canceled':
          setAttempt(event.providerId, 'cancelled');
          return;
        case 'start-failed':
          setAttempt(event.providerId, 'failed');
          return;
        default:
          return;
      }
    },
    [setAttempt]
  );

  const connections = useMcpConnections({ onEvent: handleEvent });
  const { refreshStatus } = connections;

  const verify = useCallback(
    async (providerId: string, outcome: 'completed' | 'returned') => {
      setAttempt(providerId, 'checking');
      const status = await refreshStatus();
      const connected =
        status?.grants.some(
          (grant) =>
            grant.provider.toLowerCase() === providerId.toLowerCase() &&
            grant.connected &&
            !grant.expired
        ) ?? false;
      setAttempt(providerId, attemptAfterCheck(connected, outcome));
    },
    [refreshStatus, setAttempt]
  );
  useEffect(() => {
    verifyRef.current = verify;
  }, [verify]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const startConnect = useCallback(
    (providerId: string) => {
      setAttempt(providerId, 'connecting');
      void connections.connect(providerId);
    },
    [connections, setAttempt]
  );

  const checkAgain = useCallback(
    (providerId: string) => void verify(providerId, 'returned'),
    [verify]
  );

  const featured = useMemo(
    () =>
      selectFeaturedServices(
        connections.providerConfigs,
        connections.providers
      ),
    [connections.providerConfigs, connections.providers]
  );

  const unavailable =
    !connections.initialLoading &&
    (connections.hostingSessionUnavailable ||
      connections.status?.available === false ||
      connections.providers.length === 0);

  return {
    connections,
    featured,
    attempts,
    unavailable,
    anyConnected: hasConnectedService(connections.providers),
    startConnect,
    checkAgain,
  };
}
