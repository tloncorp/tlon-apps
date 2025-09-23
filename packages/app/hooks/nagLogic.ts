export interface NagState {
  /** Timestamp when the nag was last dismissed */
  lastDismissed: number;
  /** Number of times this nag has been dismissed */
  dismissCount: number;
  /** Whether this nag has been permanently eliminated */
  eliminated: boolean;
}

/**
 * Base configuration for nag behavior
 */
export interface NagBehaviorConfig {
  /** Time in milliseconds after which the nag can be shown again */
  refreshInterval?: number;
  /** Maximum number of times the user can dismiss this nag */
  refreshCycle?: number;
}

/**
 * Complete configuration for a nag, including storage settings
 */
export interface NagConfig extends NagBehaviorConfig {
  /** Unique identifier for this nag */
  key: string;
  /** Whether to use only localStorage (skip server storage) */
  localOnly?: boolean;
}

/**
 * Determines if a nag should be shown based on its current state and configuration
 *
 * @param state Current nag state
 * @param config Configuration with refresh settings
 * @param currentTime Current timestamp (defaults to Date.now())
 *
 * @returns true if nag should be shown, false otherwise
 *
 * @remarks
 * Priority order for hiding nags:
 * 1. Permanently eliminated (always hidden)
 * 2. Refresh cycle limit reached (hidden until reset)
 * 3. No refresh interval set (hidden after first dismissal)
 * 4. Refresh interval not yet elapsed (hidden temporarily)
 *
 * @example
 * ```typescript
 * const state = { lastDismissed: Date.now() - 1000, dismissCount: 1, eliminated: false };
 * const config = { refreshInterval: 5000 }; // 5 seconds
 * const shouldShow = shouldShowNag(state, config); // false (too soon)
 * ```
 */
export function shouldShowNag(
  state: NagState,
  config: NagBehaviorConfig,
  currentTime: number = Date.now()
): boolean {
  // If permanently eliminated, never show
  if (state.eliminated) {
    return false;
  }

  // If never dismissed, show it
  if (state.dismissCount === 0) {
    return true;
  }

  // If we have a refresh cycle limit and we've hit it, don't show
  if (config.refreshCycle !== undefined && state.dismissCount >= config.refreshCycle) {
    return false;
  }

  // If no refresh interval, it stays dismissed
  if (config.refreshInterval === undefined) {
    return false;
  }

  // Check if enough time has passed since last dismissal
  const timeSinceLastDismissal = currentTime - state.lastDismissed;
  return timeSinceLastDismissal >= config.refreshInterval;
}

/**
 * Creates a new state after dismissing a nag
 *
 * @param currentState The current nag state
 * @param dismissTime Timestamp when dismissed (defaults to Date.now())
 *
 * @returns New state with incremented dismiss count and updated timestamp
 *
 * @remarks
 * This function is pure - it doesn't modify the input state but returns a new one.
 * The dismiss count is incremented and the last dismissed time is updated.
 *
 * @example
 * ```typescript
 * const state = { lastDismissed: 0, dismissCount: 0, eliminated: false };
 * const newState = createDismissedState(state);
 * // newState.dismissCount === 1, newState.lastDismissed === Date.now()
 * ```
 */
export function createDismissedState(
  currentState: NagState,
  dismissTime: number = Date.now()
): NagState {
  return {
    ...currentState,
    lastDismissed: dismissTime,
    dismissCount: currentState.dismissCount + 1,
  };
}

/**
 * Creates a new state after permanently eliminating a nag
 *
 * @param currentState The current nag state
 *
 * @returns New state with eliminated flag set to true
 *
 * @remarks
 * Once a nag is eliminated, it will never be shown again regardless of
 * refresh intervals or cycles. This is typically called when the user
 * takes the action the nag was promoting.
 *
 * @example
 * ```typescript
 * const state = { lastDismissed: 123, dismissCount: 2, eliminated: false };
 * const eliminatedState = createEliminatedState(state);
 * // eliminatedState.eliminated === true
 * // shouldShowNag(eliminatedState, config) will always return false
 * ```
 */
export function createEliminatedState(currentState: NagState): NagState {
  return {
    ...currentState,
    eliminated: true,
  };
}

// Backward compatibility aliases - to be deprecated
/** @deprecated Use createDismissedState instead */
export const dismissNag = createDismissedState;
/** @deprecated Use createEliminatedState instead */
export const eliminateNagState = createEliminatedState;

/**
 * Creates a default nag state
 */
export function createDefaultNagState(): NagState {
  return {
    lastDismissed: 0,
    dismissCount: 0,
    eliminated: false,
  };
}

/**
 * Serializes nag state to JSON string for storage
 */
export function serializeNagState(state: NagState): string {
  return JSON.stringify(state);
}

/**
 * Deserializes nag state from JSON string, returns null on error
 */
export function deserializeNagState(serialized: string): NagState | null {
  try {
    const parsed = JSON.parse(serialized);

    // Validate the parsed object has the required structure
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.lastDismissed === 'number' &&
      typeof parsed.dismissCount === 'number' &&
      typeof parsed.eliminated === 'boolean'
    ) {
      return parsed as NagState;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Generates the localStorage key for a nag
 */
export function getLocalStorageKey(nagKey: string): string {
  return `nag_state_${nagKey}`;
}

/**
 * Generates the settings key for a nag
 */
export function getSettingsKey(nagKey: string): string {
  return `nagState_${nagKey}`;
}

/**
 * Validates nag configuration
 */
export function validateNagConfig(config: NagConfig): string[] {
  const errors: string[] = [];

  if (!config.key || typeof config.key !== 'string') {
    errors.push('key must be a non-empty string');
  }

  if (config.refreshInterval !== undefined) {
    if (typeof config.refreshInterval !== 'number' || config.refreshInterval <= 0) {
      errors.push('refreshInterval must be a positive number');
    }
  }

  if (config.refreshCycle !== undefined) {
    if (typeof config.refreshCycle !== 'number' || config.refreshCycle <= 0 || !Number.isInteger(config.refreshCycle)) {
      errors.push('refreshCycle must be a positive integer');
    }
  }

  return errors;
}