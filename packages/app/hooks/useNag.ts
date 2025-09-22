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
  filterNagKeys,
  validateNagConfig,
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
 * Map nag keys to their corresponding schema fields
 */
function getSchemaField(nagKey: string): keyof db.Settings | null {
  switch (nagKey) {
    case 'contactBookPrompt':
      return 'nagStateContactBookPrompt';
    default:
      return null;
  }
}

/**
 * Get stored state for a nag key
 * Uses database as primary storage with localStorage fallback
 */
async function getNagState(key: string): Promise<NagState> {
  try {
    // Try database first (includes server sync)
    const settings = await db.getSettings();
    if (settings) {
      const schemaField = getSchemaField(key);
      if (schemaField) {
        const rawState = settings[schemaField as keyof typeof settings];
        if (typeof rawState === 'string') {
          const state = deserializeNagState(rawState);
          if (state) {
            return state;
          }
        }
      }
    }
  } catch (error) {
    logger.log(`Failed to get nag state from database for key "${key}":`, error);
  }

  // Fallback to localStorage for unregistered nags or database errors
  try {
    const stored = localStorage.getItem(getLocalStorageKey(key));
    if (stored) {
      const state = deserializeNagState(stored);
      if (state) {
        return state;
      }
    }
  } catch (error) {
    logger.log(`Failed to get nag state from localStorage for key "${key}":`, error);
  }

  return createDefaultNagState();
}

/**
 * Save state for a nag key
 * Uses database + server sync for registered nags, localStorage for others
 */
async function saveNagState(key: string, state: NagState): Promise<void> {
  const stateJson = serializeNagState(state);
  const schemaField = getSchemaField(key);

  if (schemaField) {
    // Registered nag: use database + server sync
    try {
      logger.log(`Setting nag state for key "${key}" (field: ${String(schemaField)}) with value:`, stateJson);

      // Store in local database immediately
      await db.insertSettings({ [schemaField]: stateJson });

      // Sync to server using the proper schema field name
      await setSetting(String(schemaField), stateJson);

      logger.log(`Successfully set nag state for key "${key}"`);
    } catch (error) {
      logger.log(`Failed to save nag state for key "${key}":`, error);
      throw error;
    }
  } else {
    // Unregistered nag: use localStorage only
    try {
      localStorage.setItem(getLocalStorageKey(key), stateJson);
      logger.log(`Saved unregistered nag "${key}" to localStorage`);
    } catch (error) {
      logger.log(`Failed to save nag state to localStorage for key "${key}":`, error);
      throw error;
    }
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
        const state = localOnly
          ? (() => {
              // For localOnly, use localStorage directly
              try {
                const stored = localStorage.getItem(getLocalStorageKey(key));
                if (stored) {
                  const state = deserializeNagState(stored);
                  if (state) return state;
                }
              } catch (error) {
                logger.log(`Failed to get local nag state for key "${key}":`, error);
              }
              return createDefaultNagState();
            })()
          : await getNagState(key);

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

    if (localOnly) {
      // For localOnly, use localStorage directly
      try {
        localStorage.setItem(getLocalStorageKey(key), serializeNagState(newState));
      } catch (error) {
        logger.log(`Failed to save local nag state for key "${key}":`, error);
      }
    } else {
      try {
        // Use unified save function (database + server or localStorage)
        await saveNagState(key, newState);
      } catch (error) {
        logger.log(`Failed to save nag state for key "${key}":`, error);
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
    // Get current state
    const currentState = localOnly
      ? (() => {
          try {
            const stored = localStorage.getItem(getLocalStorageKey(key));
            if (stored) {
              const state = deserializeNagState(stored);
              if (state) return state;
            }
          } catch (error) {
            logger.log(`Failed to get local nag state for key "${key}":`, error);
          }
          return createDefaultNagState();
        })()
      : await getNagState(key);

    const newState = createEliminatedState(currentState);

    // Save eliminated state
    if (localOnly) {
      try {
        localStorage.setItem(getLocalStorageKey(key), serializeNagState(newState));
      } catch (error) {
        logger.log(`Failed to save local nag state for key "${key}":`, error);
      }
    } else {
      await saveNagState(key, newState);
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
        // Reset to default state using the unified save function
        const defaultState = createDefaultNagState();
        await saveNagState(key, defaultState);
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
    return localOnly
      ? (() => {
          try {
            const stored = localStorage.getItem(getLocalStorageKey(key));
            if (stored) {
              const state = deserializeNagState(stored);
              if (state) return state;
            }
          } catch (error) {
            logger.log(`Failed to get local nag state for key "${key}":`, error);
          }
          return createDefaultNagState();
        })()
      : await getNagState(key);
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