import { useMemo } from 'react';

/**
 * Hook to determine if a user is a bot based on their ID.
 * Currently checks if the ID starts with '~pinser-botter-'.
 * This logic is centralized here to allow for future heuristic changes.
 */
export function useIsBot(userId: string | null | undefined): boolean {
  return useMemo(() => {
    if (!userId) return false;
    return userId.startsWith('~pinser-botter-');
  }, [userId]);
}
