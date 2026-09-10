import { useQuery } from '@tanstack/react-query';
import * as api from '@tloncorp/api';
import type { StewardAutomationTasks } from '@tloncorp/api/urbit';

export interface StewardAutomationSnapshot {
  available: boolean;
  tasks: StewardAutomationTasks;
}

export const stewardAutomationQueryKey = ['stewardAutomationTasks'] as const;

export function useStewardAutomationTasks(enabled = true) {
  return useQuery<StewardAutomationSnapshot>({
    queryKey: stewardAutomationQueryKey,
    queryFn: async () => {
      try {
        return {
          available: true,
          tasks: await api.getStewardAutomationTasks(),
        };
      } catch (error) {
        if (error instanceof api.BadResponseError && error.status === 404) {
          return { available: false, tasks: {} };
        }
        throw error;
      }
    },
    enabled,
    staleTime: 15_000,
    refetchOnMount: 'always',
    retry: (attempts, error) =>
      !(error instanceof api.BadResponseError && error.status === 404) &&
      attempts < 2,
  });
}

export function tasksForShip(
  snapshot: StewardAutomationSnapshot | undefined,
  ship: string
) {
  return snapshot?.tasks[ship] ?? {};
}
