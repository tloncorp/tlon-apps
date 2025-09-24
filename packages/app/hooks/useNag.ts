import { useCallback, useMemo, useState, useEffect } from 'react';
import { setSetting, deleteSetting } from '../../shared/src/api/settingsApi';
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
  type NagState,
  type NagConfig,
} from './nagLogic';

const logger = createDevLogger('useNag', true);

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
    case 'notificationsPrompt':
      return 'nagStateNotificationsPrompt';
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
  logger.log(`Starting resetNag for key "${key}", localOnly: ${localOnly}`);
  
  try {
    // Remove from localStorage (web) or AsyncStorage equivalent if available
    try {
      const localStorageKey = getLocalStorageKey(key);
      logger.log(`Attempting to remove localStorage/AsyncStorage key: ${localStorageKey}`);
      
      // Only try localStorage if it exists (web environment)
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.removeItem(localStorageKey);
        logger.log(`Removed from localStorage: ${localStorageKey}`);
      } else {
        logger.log(`localStorage not available (React Native environment), skipping localStorage removal`);
      }
    } catch (error) {
      logger.log(`Failed to remove from localStorage:`, error);
      // Continue anyway - this isn't critical for registered nags
    }

    if (!localOnly) {
      const schemaField = getSchemaField(key);
      logger.log(`Schema field for key "${key}": ${String(schemaField)}`);
      
      if (schemaField) {
        try {
          // For registered nags, remove from database and server
          logger.log(`Setting database field ${String(schemaField)} to null`);
          await db.insertSettings({ [schemaField]: null });
          
          logger.log(`Deleting server setting: ${String(schemaField)}`);
          await deleteSetting(String(schemaField));
          
          logger.log(`Successfully reset nag "${key}" on server`);
        } catch (error) {
          logger.log(`Failed to reset nag "${key}" on server:`, error);
          throw error;
        }
      } else {
        logger.log(`No schema field found for key "${key}", skipping server operations`);
      }
    }
    
    logger.log(`Successfully reset nag "${key}"`);
  } catch (error) {
    logger.log(`Failed to reset nag state for key "${key}":`, error);
    console.error(`resetNag error for "${key}":`, error);
    throw error; 
  }
}

