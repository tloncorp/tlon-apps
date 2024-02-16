import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import api from '@/api';

interface Connected {
  complete: 'yes';
}

interface YetToCheck {
  complete: 'no-data';
}

interface NoDNS {
  complete: 'no-dns';
}

interface Crash {
  complete: 'crash';
  crash: string[][];
}

interface NoOurPlanet {
  complete: 'no-our-planet';
  'last-contact': number;
}

interface NoOurGalaxy {
  complete: 'no-our-galaxy';
  'last-contact': number;
}

interface NoSponsorHit {
  complete: 'no-sponsor-hit';
  ship: string;
}

interface NoSponsorMiss {
  complete: 'no-sponsor-miss';
  ship: string;
}

interface NoTheirGalaxy {
  complete: 'no-their-galaxy';
  'last-contact': number;
}

export type ConnectionCompleteStatusKey =
  | 'yes'
  | 'crash'
  | 'no-data'
  | 'no-dns'
  | 'no-our-planet'
  | 'no-our-galaxy'
  | 'no-sponsor-hit'
  | 'no-sponsor-miss'
  | 'no-their-galaxy';

export interface CompleteStatus {
  complete: ConnectionCompleteStatusKey;
}

export type ConnectionCompleteStatus =
  | Connected
  | YetToCheck
  | Crash
  | NoDNS
  | NoOurPlanet
  | NoOurGalaxy
  | NoSponsorHit
  | NoSponsorMiss
  | NoTheirGalaxy;

export type ConnectionPendingStatusKey =
  | 'setting-up'
  | 'trying-dns'
  | 'trying-local'
  | 'trying-target'
  | 'trying-sponsor';

export type ConnectionPendingStatus =
  | {
      pending: Omit<ConnectionPendingStatusKey, 'trying-sponsor'>;
    }
  | {
      pending: 'trying-sponsor';
      ship: string;
    };

export type ConnectionStatus =
  | ConnectionCompleteStatus
  | ConnectionPendingStatus;

export interface ConnectionUpdate {
  status: ConnectionStatus;
  timestamp: number;
}

interface ConnectivityCheckOptions {
  useStale?: boolean;
  enabled?: boolean;
  staleTime?: number;
  waitToDisplay?: number;
}

export function useConnectivityCheck(
  ship: string,
  options?: ConnectivityCheckOptions
) {
  const {
    useStale = true,
    enabled = true,
    staleTime = 30 * 1000,
    waitToDisplay = 700,
  } = options || {};
  const self = window.our === ship;
  const [subbed, setSubbed] = useState<string | undefined>(undefined);
  const [showConnection, setShowConnection] = useState(false);
  const queryClient = useQueryClient();
  const query = useQuery(
    ['vitals', ship],
    async (): Promise<ConnectionUpdate> => {
      const resp = await api.scry<ConnectionUpdate>({
        app: 'vitals',
        path: `/ship/${ship}`,
      });
      const now = Date.now();
      const diff = now - resp.timestamp;

      // if status older than stale time, re-run check
      if (diff > staleTime || !useStale) {
        api.poke({
          app: 'vitals',
          mark: 'run-check',
          json: ship,
        });

        return {
          status: {
            pending: 'setting-up',
          },
          timestamp: now,
        };
      }

      return resp;
    },
    {
      enabled: enabled && !!subbed && !self,
      cacheTime: 0,
      initialData: self
        ? {
            status: { complete: 'yes' },
            timestamp: Date.now(),
          }
        : undefined,
      placeholderData: {
        status: {
          pending: 'setting-up',
        },
        timestamp: Date.now(),
      },
    }
  );

  useEffect(() => {
    if (self) {
      return;
    }

    api.subscribe({
      app: 'vitals',
      path: `/status/${ship}`,
      event: (data: ConnectionUpdate) => {
        queryClient.setQueryData(['vitals', ship], data);
      },
    });

    setSubbed(ship);
  }, [ship, subbed, self, queryClient]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setShowConnection(true);
    }, waitToDisplay);

    return () => {
      clearTimeout(timeout);
    };
  }, [waitToDisplay]);

  return {
    ...query,
    showConnection,
  };
}
