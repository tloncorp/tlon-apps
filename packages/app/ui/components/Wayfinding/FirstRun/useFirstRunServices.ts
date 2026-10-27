import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import { useToast } from '@tloncorp/ui';
import { Image } from 'expo-image';
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
  buildProviderRows,
  mcpProvidersQuery,
} from '../../../../lib/mcpProviders';
import {
  FIRST_RUN_FALLBACK_CATALOG,
  type ServiceAttempt,
  attemptAfterCheck,
  attemptAfterRefusedStart,
  catalogOffersFeatured,
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
 * The featured rows are there from the first render, from the built-in list
 * until the live catalog arrives.
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

  // The catalog is the same for every account, so it never waits on this
  // account's status, and it keeps retrying until it loads.
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({
    ...mcpProvidersQuery,
    retry: true,
    retryDelay: (failures) => Math.min(1000 * 2 ** failures, 10_000),
  });
  const liveCatalog = catalogQuery.data;
  const catalog = liveCatalog ?? FIRST_RUN_FALLBACK_CATALOG;
  const grants = connections.status?.grants;
  const rows = useMemo(
    () => buildProviderRows(catalog, grants ?? []),
    [catalog, grants]
  );

  // Another connect or disconnect (say, from the full services list) blocks
  // a new sign-in, so the rows wait for it instead of starting one the hook
  // would refuse.
  const busy = connections.busyProviderId !== null;
  const { connect } = connections;
  const startConnect = useCallback(
    (providerId: string) => {
      if (connections.busyProviderId) return;
      setAttempt(providerId, 'connecting');
      void (async () => {
        // A row from the built-in list starts only once the live catalog
        // confirms the access its sheet described.
        if (!liveCatalog) {
          const confirmed = await api.getTlawnOAuthProviders().then(
            (next) => {
              queryClient.setQueryData(mcpProvidersQuery.queryKey, next);
              return catalogOffersFeatured(next, providerId);
            },
            () => false
          );
          if (!confirmed) {
            setAttempt(providerId, 'failed');
            return;
          }
        }
        const refused = attemptAfterRefusedStart(await connect(providerId));
        if (refused) setAttempt(providerId, refused.attempt);
      })();
    },
    [connect, connections.busyProviderId, liveCatalog, queryClient, setAttempt]
  );

  const checkAgain = useCallback(
    (providerId: string) => void verify(providerId, 'rechecked'),
    [verify]
  );

  const featured = useMemo(
    () => selectFeaturedServices(catalog, rows),
    [catalog, rows]
  );
  useEffect(() => {
    featuredIdsRef.current = featured.map((service) =>
      service.row.id.toLowerCase()
    );
  }, [featured]);

  // Fetch the logos now, so they're ready by screen 3.
  const logoUrls = featured
    .flatMap((service) => (service.row.logoUrl ? [service.row.logoUrl] : []))
    .join(' ');
  useEffect(() => {
    if (logoUrls) void Image.prefetch(logoUrls.split(' ')).catch(() => false);
  }, [logoUrls]);

  /** The full services list reports its own open and close. */
  const setAllServicesOpen = useCallback((open: boolean) => {
    allServicesOpenRef.current = open;
  }, []);

  const { refetch: refetchCatalog } = catalogQuery;
  const refresh = useCallback(() => {
    void refetchCatalog();
    void refreshStatus();
  }, [refetchCatalog, refreshStatus]);

  return {
    connections,
    featured,
    /** Every service, once the live catalog is in. */
    allServices: liveCatalog ? rows : null,
    attempts,
    /** No hosting session to connect through, or a live catalog with nothing. */
    unavailable: connections.hostingSessionUnavailable || rows.length === 0,
    anyConnected: hasConnectedService(rows),
    busy,
    startConnect,
    checkAgain,
    refresh,
    setAllServicesOpen,
  };
}
