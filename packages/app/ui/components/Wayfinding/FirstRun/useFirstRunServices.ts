import { useToast } from '@tloncorp/ui';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  TOAST_BOTTOM_OFFSET,
  connectionEventMessage,
} from '../../../../features/settings/botMcpSettingsHelpers';
import {
  type McpConnectionEvent,
  useMcpConnections,
} from '../../../../features/settings/useMcpConnections';
import {
  type ServiceAttempt,
  attemptAfterCheck,
  attemptAfterRefusedStart,
  hasConnectedService,
  selectFeaturedServices,
  shouldAnnounceConnectionEvent,
} from './firstRunServices';

type VerifyOutcome = 'completed' | 'returned' | 'rechecked';

/**
 * Screen 3's live data: the catalog, this account's grants, and where each
 * featured service's sign-in stands. A row says connected only after a status
 * check confirms the grant. What the rows can't show, such as a failed
 * disconnect in the full services list, gets the settings screen's toast.
 */
export function useFirstRunServices() {
  const showToast = useToast();
  const allServicesOpenRef = useRef(false);
  const featuredIdsRef = useRef<string[]>([]);
  const [attempts, setAttempts] = useState<
    Record<string, ServiceAttempt | undefined>
  >({});
  const setAttempt = useCallback(
    (providerId: string, attempt: ServiceAttempt | undefined) =>
      setAttempts((current) => ({ ...current, [providerId]: attempt })),
    []
  );
  const verifyRef = useRef<
    (providerId: string, outcome: VerifyOutcome) => void
  >(() => {});

  const handleEvent = useCallback(
    (event: McpConnectionEvent) => {
      const message = connectionEventMessage(event);
      if (
        message &&
        shouldAnnounceConnectionEvent(event, {
          allServicesOpen: allServicesOpenRef.current,
          featuredIds: featuredIdsRef.current,
        })
      ) {
        showToast({ message, bottomOffset: TOAST_BOTTOM_OFFSET });
      }
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
    [setAttempt, showToast]
  );

  const connections = useMcpConnections({ onEvent: handleEvent });
  const { refreshStatus } = connections;

  const verify = useCallback(
    async (providerId: string, outcome: VerifyOutcome) => {
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

  // Another connect or disconnect (say, from the full services list) blocks
  // a new sign-in, so the rows wait for it instead of starting one the hook
  // would refuse.
  const busy = connections.busyProviderId !== null;
  const startConnect = useCallback(
    (providerId: string) => {
      if (connections.busyProviderId) return;
      setAttempt(providerId, 'connecting');
      void connections.connect(providerId).then((start) => {
        const refused = attemptAfterRefusedStart(start);
        if (refused) setAttempt(providerId, refused.attempt);
      });
    },
    [connections, setAttempt]
  );

  const checkAgain = useCallback(
    (providerId: string) => void verify(providerId, 'rechecked'),
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
  useEffect(() => {
    featuredIdsRef.current = featured.map((service) =>
      service.row.id.toLowerCase()
    );
  }, [featured]);

  /** The full services list reports its own open and close. */
  const setAllServicesOpen = useCallback((open: boolean) => {
    allServicesOpenRef.current = open;
  }, []);

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
    busy,
    startConnect,
    checkAgain,
    setAllServicesOpen,
  };
}
