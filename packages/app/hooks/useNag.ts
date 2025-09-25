import { useCallback, useMemo } from 'react';
import * as kv from '@tloncorp/shared/db';
import { createDevLogger } from '@tloncorp/shared';
import {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  type NagConfig,
} from './nagLogic';
import type { NagState } from '@tloncorp/shared/db';

const logger = createDevLogger('useNag', true);

// Re-export types and pure functions for convenience
export type { NagConfig, NagBehaviorConfig } from './nagLogic';
export type { NagState } from '@tloncorp/shared/db';
export {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
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
 * Map nag keys to their corresponding storage items
 */
function getNagStorageItem(nagKey: string) {
  switch (nagKey) {
    case 'contactBookPrompt':
      return kv.contactBookPromptNag;
    case 'notificationsPrompt':
      return kv.notificationsPromptNag;
    default:
      return kv.createNagStorageItem(nagKey);
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
 * - Client-side storage via keyValue store (localStorage/SecureStore)
 * - Automatic registration: No need to pre-register nag keys in schema
 * - Optimistic updates: Local state updated immediately, persisted automatically
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
  const { key, refreshInterval, refreshCycle } = config;
  const storageItem = getNagStorageItem(key);

  const { value: nagState, isLoading, setValue } = storageItem.useStorageItem();

  const shouldShow = useMemo(() => {
    if (isLoading) return false;

    return shouldShowNag(nagState, { refreshInterval, refreshCycle });
  }, [nagState, refreshInterval, refreshCycle, isLoading]);

  const updateNagState = useCallback(async (newState: NagState) => {
    try {
      await setValue(newState);
      logger.log(`Successfully updated nag state for key "${key}"`);
    } catch (error) {
      logger.log(`Failed to save nag state for key "${key}":`, error);
    }
  }, [setValue, key]);

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
