import { useCallback, useMemo, useState, useEffect } from 'react';
import { setSetting } from '../../shared/src/api/settingsApi';
import * as db from '../../shared/src/db';
import { createDevLogger } from '../../shared/src/debug';
import {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  createDefaultNagState,
  serializeNagState,
  deserializeNagState,
  getLocalStorageKey,
  getSettingsKey,
  filterNagKeys,
  type NagState,
  type NagConfig,
} from './nagLogic';

// Import NagConfig from nagLogic
// This consolidates all configuration interfaces in one place

const logger = createDevLogger('useNag', false);

// Re-export types and pure functions from nagLogic for convenience
export type { NagState, NagConfig, NagBehaviorConfig } from './nagLogic';
export {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  createDefaultNagState,
  serializeNagState,
  deserializeNagState,
  getLocalStorageKey,
  getSettingsKey,
  filterNagKeys,
  validateNagConfig,
  // Backward compatibility - deprecated
  dismissNag,
  eliminateNagState,
} from './nagLogic';

/**
 * Return type for the useNag hook
 */
export interface NagHookReturn {
  /** Whether the nag should currently be shown to the user */
  shouldShow: boolean;
  /** Function to call when user dismisses the nag */
  dismiss: () => void;
  /** Function to permanently eliminate this nag (e.g., when user completes the action) */
  eliminate: () => void;
  /** Current dismissal count for this nag */
  dismissCount: number;
  /** Whether this nag has been permanently eliminated */
  isEliminated: boolean;
  /** Whether the hook is currently loading state from server */
  isLoading: boolean;
}

/**
 * Get stored state for a nag key from localStorage (fallback)
 */
function getLocalNagState(key: string): NagState {
  try {
    const stored = localStorage.getItem(getLocalStorageKey(key));
    if (stored) {
      const state = deserializeNagState(stored);
      if (state) {
        return state;
      }
    }
  } catch (error) {
    logger.log(`Failed to get local nag state for key "${key}":`, error);
  }

  return createDefaultNagState();
}

/**
 * Save state for a nag key to localStorage (fallback)
 */
function setLocalNagState(key: string, state: NagState): void {
  try {
    localStorage.setItem(getLocalStorageKey(key), serializeNagState(state));
  } catch (error) {
    logger.log(`Failed to save local nag state for key "${key}":`, error);
  }
}

/**
 * Get stored state for a nag key from server settings
 */
async function getServerNagState(key: string): Promise<NagState | null> {
  try {
    const settings = await db.getSettings();
    const settingsKey = getSettingsKey(key);

    // Type-safe access to settings with proper validation
    if (settings && typeof settings === 'object') {
      const rawState = (settings as Record<string, unknown>)[settingsKey];
      if (typeof rawState === 'string') {
        return deserializeNagState(rawState);
      }
    }
  } catch (error) {
    logger.log(`Failed to get server nag state for key "${key}":`, error);
  }

  return null;
}

/**
 * Save state for a nag key to server settings
 */
async function setServerNagState(key: string, state: NagState): Promise<void> {
  try {
    const settingsKey = getSettingsKey(key);
    const stateJson = serializeNagState(state);

    // Store in local database optimistically
    await db.insertSettings({ [settingsKey]: stateJson });

    // Sync to server
    await setSetting(settingsKey, stateJson);
  } catch (error) {
    logger.log(`Failed to save server nag state for key "${key}":`, error);
    throw error;
  }
}

/**
 * A flexible hook for managing user notifications/reminders that can be dismissed
 * and optionally shown again after specified intervals and cycles.
 *
 * @param config Configuration object containing key and optional refresh settings
 * @returns Object with shouldShow flag, dismiss/eliminate functions, and state info
 *
 * @remarks
 * **Storage Strategy:**
 * - Primary: Server-side storage via %settings agent (syncs across devices)
 * - Fallback: localStorage (offline functionality)
 * - Optimistic updates: Local state updated immediately, server sync in background
 *
 * **Visibility Logic:**
 * 1. Never shown if permanently eliminated
 * 2. Hidden if refresh cycle limit reached
 * 3. Hidden permanently if no refresh interval after first dismissal
 * 4. Hidden temporarily if refresh interval hasn't elapsed
 * 5. Shown initially or after refresh interval passes
 *
 * **Performance:** Pure functions handle business logic, React optimizations minimize re-renders
 *
 * @example
 * **Simple one-time nag:**
 * ```typescript
 * const onboardingNag = useNag({ key: 'onboarding' });
 * // Shows once, hidden forever after dismissal
 * ```
 *
 * @example
 * **Recurring nag with limits:**
 * ```typescript
 * const featureReminderNag = useNag({
 *   key: 'newFeature',
 *   refreshInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
 *   refreshCycle: 3 // max 3 dismissals
 * });
 * // Reappears every 7 days, stops after 3 dismissals
 * ```
 *
 * @example
 * **Local-only nag (no server sync):**
 * ```typescript
 * const tempNag = useNag({
 *   key: 'tempNotification',
 *   localOnly: true
 * });
 * // Useful for session-based or offline-only notifications
 * ```
 *
 * @example
 * **Complete component integration:**
 * ```typescript
 * function MyComponent() {
 *   const nag = useNag({ key: 'groupCreation' });
 *
 *   if (nag.isLoading) {
 *     return <Spinner />;
 *   }
 *
 *   return (
 *     <div>
 *       {nag.shouldShow && (
 *         <Banner
 *           onDismiss={nag.dismiss}
 *           onCreateGroup={() => {
 *             // User took action, eliminate the nag permanently
 *             nag.eliminate();
 *             createGroup();
 *           }}
 *         >
 *           Create your first group! (Dismissed {nag.dismissCount} times)
 *         </Banner>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 */
export function useNag(config: NagConfig): NagHookReturn {
  const { key, refreshInterval, refreshCycle, localOnly = false } = config;

  const [nagState, setNagState] = useState<NagState>(createDefaultNagState());
  const [isLoading, setIsLoading] = useState(true);

  // Load initial state
  useEffect(() => {
    async function loadNagState() {
      setIsLoading(true);

      try {
        let state: NagState | null = null;

        if (!localOnly) {
          // Try to load from server first
          state = await getServerNagState(key);
        }

        if (!state) {
          // Fallback to localStorage
          state = getLocalNagState(key);
        }

        setNagState(state);
      } catch (error) {
        logger.log(`Failed to load nag state for key "${key}":`, error);
        // Use default state on error
        setNagState(createDefaultNagState());
      } finally {
        setIsLoading(false);
      }
    }

    loadNagState();
  }, [key, localOnly]);

  const shouldShow = useMemo(() => {
    if (isLoading) return false;

    return shouldShowNag(nagState, { refreshInterval, refreshCycle });
  }, [nagState, refreshInterval, refreshCycle, isLoading]);

  const updateNagState = useCallback(async (newState: NagState) => {
    // Update local state immediately for responsiveness
    setNagState(newState);

    // Save to localStorage as immediate fallback
    setLocalNagState(key, newState);

    if (!localOnly) {
      try {
        // Attempt to save to server
        await setServerNagState(key, newState);
      } catch (error) {
        logger.log(`Failed to sync nag state to server for key "${key}":`, error);
        // Local state already updated, so user experience continues smoothly
      }
    }
  }, [key, localOnly]);

  const dismiss = useCallback(() => {
    const newState = createDismissedState(nagState);
    updateNagState(newState);
  }, [nagState, updateNagState]);

  const eliminate = useCallback(() => {
    const newState = createEliminatedState(nagState);
    updateNagState(newState);
  }, [nagState, updateNagState]);

  return {
    shouldShow,
    dismiss,
    eliminate,
    dismissCount: nagState.dismissCount,
    isEliminated: nagState.eliminated,
    isLoading,
  };
}

/**
 * Utility function to manually eliminate a nag without needing the hook
 * Useful for eliminating nags from outside components or in response to global events
 *
 * @param key The nag key to eliminate
 * @param localOnly Whether to only update localStorage (skip server sync)
 *
 * @example
 * // Eliminate onboarding nag when user completes tutorial
 * eliminateNag('onboarding');
 *
 * @example
 * // Eliminate feature nag when user uses the feature
 * async function useFeature() {
 *   await eliminateNag('newFeature');
 *   // ... feature logic
 * }
 */
export async function eliminateNag(key: string, localOnly: boolean = false): Promise<void> {
  try {
    let currentState: NagState | null = null;

    if (!localOnly) {
      currentState = await getServerNagState(key);
    }

    if (!currentState) {
      currentState = getLocalNagState(key);
    }

    const newState = createEliminatedState(currentState);

    // Always update localStorage
    setLocalNagState(key, newState);

    if (!localOnly) {
      try {
        await setServerNagState(key, newState);
      } catch (error) {
        logger.log(`Failed to sync eliminated nag "${key}" to server:`, error);
      }
    }
  } catch (error) {
    logger.log(`Failed to eliminate nag "${key}":`, error);
  }
}

/**
 * Utility function to reset a nag back to its initial state
 * Useful for testing or administrative functions
 *
 * @param key The nag key to reset
 * @param localOnly Whether to only reset localStorage (skip server sync)
 *
 * @example
 * // Reset a nag for testing
 * await resetNag('onboarding');
 */
export async function resetNag(key: string, localOnly: boolean = false): Promise<void> {
  try {
    // Always remove from localStorage
    localStorage.removeItem(getLocalStorageKey(key));

    if (!localOnly) {
      try {
        // Reset to default state on server
        const defaultState = createDefaultNagState();
        await setServerNagState(key, defaultState);
      } catch (error) {
        logger.log(`Failed to reset nag "${key}" on server:`, error);
      }
    }
  } catch (error) {
    logger.log(`Failed to reset nag state for key "${key}":`, error);
  }
}

/**
 * Utility function to get current nag statistics
 * Useful for analytics or debugging
 *
 * @param key The nag key to inspect
 * @param localOnly Whether to only check localStorage (skip server query)
 * @returns Current nag state information
 *
 * @example
 * const stats = await getNagStats('onboarding');
 * console.log(`Nag dismissed ${stats.dismissCount} times`);
 */
export async function getNagStats(key: string, localOnly: boolean = false): Promise<NagState> {
  try {
    let state: NagState | null = null;

    if (!localOnly) {
      state = await getServerNagState(key);
    }

    if (!state) {
      state = getLocalNagState(key);
    }

    return state;
  } catch (error) {
    logger.log(`Failed to get nag stats for key "${key}":`, error);
    return createDefaultNagState();
  }
}

/**
 * Utility function to clear all nag data
 * Useful for user privacy controls or testing
 *
 * @param localOnly Whether to only clear localStorage (skip server cleanup)
 *
 * @example
 * // Clear all nag data when user clears app data
 * await clearAllNags();
 */
export async function clearAllNags(localOnly: boolean = false): Promise<void> {
  try {
    // Clear localStorage
    const keys = Object.keys(localStorage);
    const nagKeys = filterNagKeys(keys);
    nagKeys.forEach(key => localStorage.removeItem(key));

    if (!localOnly) {
      try {
        // Clear server settings - this would require knowing all nag keys
        // In practice, this might be better handled by a server-side cleanup function
        // For now, we'll warn that server cleanup is manual
        logger.log('Server-side nag cleanup requires manual intervention. Only localStorage cleared.');
      } catch (error) {
        logger.log('Failed to clear server nag data:', error);
      }
    }
  } catch (error) {
    logger.log('Failed to clear nag data:', error);
  }
}