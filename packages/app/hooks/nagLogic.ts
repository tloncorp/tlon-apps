import { NagState } from '@tloncorp/shared/domain';

export interface NagBehaviorConfig {
  refreshInterval?: number;
  refreshCycle?: number;
  initialDelay?: number;
}

export interface NagConfig extends NagBehaviorConfig {
  key: string;
}

export function shouldShowNag(
  state: NagState,
  config: NagBehaviorConfig,
  currentTime: number = Date.now()
): boolean {
  // If permanently eliminated, never show
  if (state.eliminated) {
    return false;
  }

  // If never dismissed, check if initial delay has elapsed
  if (state.dismissCount === 0) {
    // If firstEligibleTime is 0, initialize it now
    if (state.firstEligibleTime === 0) {
      return false; // Will be initialized in the hook
    }
    // Check if initial delay has elapsed
    return currentTime >= state.firstEligibleTime;
  }

  // If we have a refresh cycle limit and we've hit it, don't show
  if (
    config.refreshCycle !== undefined &&
    state.dismissCount >= config.refreshCycle
  ) {
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

export function createEliminatedState(currentState: NagState): NagState {
  return {
    ...currentState,
    eliminated: true,
  };
}

export function createDefaultNagState(): NagState {
  return {
    lastDismissed: 0,
    dismissCount: 0,
    eliminated: false,
    firstEligibleTime: 0,
  };
}
