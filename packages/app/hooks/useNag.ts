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

export type { NagConfig, NagBehaviorConfig } from './nagLogic';
export type { NagState } from '@tloncorp/shared/db';
export {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  validateNagConfig,
} from './nagLogic';

export interface NagHookReturn {
  shouldShow: boolean;
  dismiss: () => void;
  eliminate: () => void;
  dismissCount: number;
  isEliminated: boolean;
  isLoading: boolean;
}

export function useNag(config: NagConfig): NagHookReturn {
  const { key, refreshInterval, refreshCycle } = config;
  const storageItem = kv.createNagStorageItem(key);

  const { value: nagState, isLoading, setValue } = storageItem.useStorageItem();

  const shouldShow = useMemo(() => {
    if (isLoading) return false;

    return shouldShowNag(nagState, { refreshInterval, refreshCycle });
  }, [nagState, refreshInterval, refreshCycle, isLoading]);

  const updateNagState = useCallback(async (updater: (prev: NagState) => NagState) => {
    try {
      await setValue(updater);
    } catch (error) {
      logger.log(`Failed to save nag state for key "${key}":`, error);
    }
  }, [setValue, key]);

  const dismiss = useCallback(() => {
    updateNagState(createDismissedState);
  }, [updateNagState]);

  const eliminate = useCallback(() => {
    updateNagState(createEliminatedState);
  }, [updateNagState]);

  return {
    shouldShow,
    dismiss,
    eliminate,
    dismissCount: nagState.dismissCount,
    isEliminated: nagState.eliminated,
    isLoading,
  };
}
