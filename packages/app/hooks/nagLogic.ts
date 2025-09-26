export interface NagState {
  lastDismissed: number;
  dismissCount: number;
  eliminated: boolean;
}

export interface NagBehaviorConfig {
  refreshInterval?: number;
  refreshCycle?: number;
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
  };
}

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