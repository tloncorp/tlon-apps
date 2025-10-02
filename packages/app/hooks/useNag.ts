import { useCallback, useEffect, useMemo } from 'react';
import * as kv from '@tloncorp/shared/db';
import { createDevLogger } from '@tloncorp/shared';
import {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  createDefaultNagState,
  type NagConfig,
} from './nagLogic';
import type { NagState } from '@tloncorp/shared/db';

const logger = createDevLogger('useNag', true);

export type { NagConfig, NagBehaviorConfig } from './nagLogic';
export type { NagState } from '@tloncorp/shared/db';
export {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  createDefaultNagState,
  validateNagConfig,
} from './nagLogic';

export interface NagHookReturn {
  shouldShow: boolean;
  dismiss: () => void;
  eliminate: () => void;
  reset: () => void;
  dismissCount: number;
  isEliminated: boolean;
  isLoading: boolean;
}

export function useNag(config: NagConfig): NagHookReturn {
  const { key, refreshInterval, refreshCycle, initialDelay } = config;
  const storageItem = kv.createNagStorageItem(key);

  const { value: nagState, isLoading, setValue } = storageItem.useStorageItem();

  const updateNagState = useCallback(async (updater: (prev: NagState) => NagState) => {
    try {
      await setValue(updater);
    } catch (error) {
      logger.log(`Failed to save nag state for key "${key}":`, error);
    }
  }, [setValue, key]);

  // Initialize firstEligibleTime when needed
  useEffect(() => {
    if (!isLoading && nagState.firstEligibleTime === 0 && nagState.dismissCount === 0) {
      const eligibleTime = initialDelay ? Date.now() + initialDelay : Date.now();
      updateNagState((prev) => ({ ...prev, firstEligibleTime: eligibleTime }));
    }
  }, [isLoading, nagState.firstEligibleTime, nagState.dismissCount, initialDelay, updateNagState]);

  const shouldShow = useMemo(() => {
    if (isLoading) return false;

    const result = shouldShowNag(nagState, { refreshInterval, refreshCycle, initialDelay });

    logger.log(`shouldShow for "${key}":`, {
      result,
      nagState,
      config: { refreshInterval, refreshCycle, initialDelay },
      timeSinceLastDismissal: Date.now() - nagState.lastDismissed,
    });

    return result;
  }, [nagState, refreshInterval, refreshCycle, initialDelay, isLoading, key]);

  const dismiss = useCallback(() => {
    logger.log(`Dismissing nag "${key}"`);
    updateNagState(createDismissedState);
  }, [updateNagState, key]);

  const eliminate = useCallback(() => {
    updateNagState(createEliminatedState);
  }, [updateNagState]);

  const reset = useCallback(() => {
    logger.log(`Resetting nag "${key}"`);
    updateNagState(() => createDefaultNagState());
  }, [updateNagState, key]);

  return {
    shouldShow,
    dismiss,
    eliminate,
    reset,
    dismissCount: nagState.dismissCount,
    isEliminated: nagState.eliminated,
    isLoading,
  };
}
