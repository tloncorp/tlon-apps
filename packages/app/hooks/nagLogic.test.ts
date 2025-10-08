import { NagState } from '@tloncorp/shared/domain';
import { describe, expect, it } from 'vitest';

import {
  createDefaultNagState,
  createDismissedState,
  createEliminatedState,
  shouldShowNag,
} from './nagLogic';

describe('nagLogic', () => {
  const fixedTime = 1000000000000;

  describe('shouldShowNag', () => {
    it('should show nag initially when never dismissed and eligible time has passed', () => {
      const state: NagState = {
        ...createDefaultNagState(),
        firstEligibleTime: fixedTime - 1000,
      };
      const config = {};

      expect(shouldShowNag(state, config, fixedTime)).toBe(true);
    });

    it('should not show nag before initial delay has elapsed', () => {
      const state: NagState = {
        ...createDefaultNagState(),
        firstEligibleTime: fixedTime + 1000,
      };
      const config = {
        initialDelay: 2000,
      };

      expect(shouldShowNag(state, config, fixedTime)).toBe(false);
    });

    it('should not show nag if firstEligibleTime is not set (0)', () => {
      const state = createDefaultNagState();
      const config = {};

      expect(shouldShowNag(state, config, fixedTime)).toBe(false);
    });

    it('should not show nag if eliminated', () => {
      const state: NagState = {
        lastDismissed: 0,
        dismissCount: 0,
        eliminated: true,
        firstEligibleTime: 0,
      };
      const config = {};

      expect(shouldShowNag(state, config, fixedTime)).toBe(false);
    });

    it('should not show nag after dismissal without refresh interval', () => {
      const state: NagState = {
        lastDismissed: fixedTime - 1000,
        dismissCount: 1,
        eliminated: false,
        firstEligibleTime: 0,
      };
      const config = {};

      expect(shouldShowNag(state, config, fixedTime)).toBe(false);
    });

    it('should show nag again after refresh interval passes', () => {
      const oneDayAgo = fixedTime - 24 * 60 * 60 * 1000;
      const state: NagState = {
        lastDismissed: oneDayAgo,
        dismissCount: 1,
        eliminated: false,
        firstEligibleTime: 0,
      };
      const config = {
        refreshInterval: 12 * 60 * 60 * 1000, // 12 hours
      };

      expect(shouldShowNag(state, config, fixedTime)).toBe(true);
    });

    it('should not show nag if refresh interval has not passed', () => {
      const oneHourAgo = fixedTime - 1 * 60 * 60 * 1000;
      const state: NagState = {
        lastDismissed: oneHourAgo,
        dismissCount: 1,
        eliminated: false,
        firstEligibleTime: 0,
      };
      const config = {
        refreshInterval: 12 * 60 * 60 * 1000, // 12 hours
      };

      expect(shouldShowNag(state, config, fixedTime)).toBe(false);
    });

    it('should not show nag after reaching refresh cycle limit', () => {
      const oneDayAgo = fixedTime - 24 * 60 * 60 * 1000;
      const state: NagState = {
        lastDismissed: oneDayAgo,
        dismissCount: 3, // At limit
        eliminated: false,
        firstEligibleTime: 0,
      };
      const config = {
        refreshInterval: 12 * 60 * 60 * 1000, // 12 hours
        refreshCycle: 3,
      };

      expect(shouldShowNag(state, config, fixedTime)).toBe(false);
    });

    it('should show nag if under refresh cycle limit', () => {
      const oneDayAgo = fixedTime - 24 * 60 * 60 * 1000;
      const state: NagState = {
        lastDismissed: oneDayAgo,
        dismissCount: 2, // Under limit
        eliminated: false,
        firstEligibleTime: 0,
      };
      const config = {
        refreshInterval: 12 * 60 * 60 * 1000,
        refreshCycle: 3,
      };

      expect(shouldShowNag(state, config, fixedTime)).toBe(true);
    });
  });

  describe('createDismissedState', () => {
    it('should increment dismiss count and update timestamp', () => {
      const initialState: NagState = {
        lastDismissed: 0,
        dismissCount: 0,
        eliminated: false,
        firstEligibleTime: 0,
      };

      const result = createDismissedState(initialState, fixedTime);

      expect(result).toEqual({
        lastDismissed: fixedTime,
        dismissCount: 1,
        eliminated: false,
        firstEligibleTime: 0,
      });
    });

    it('should preserve other state when dismissing', () => {
      const initialState: NagState = {
        lastDismissed: fixedTime - 1000,
        dismissCount: 2,
        eliminated: false,
        firstEligibleTime: 0,
      };

      const result = createDismissedState(initialState, fixedTime);

      expect(result).toEqual({
        lastDismissed: fixedTime,
        dismissCount: 3,
        eliminated: false,
        firstEligibleTime: 0,
      });
    });
  });

  describe('createEliminatedState', () => {
    it('should set eliminated to true', () => {
      const initialState: NagState = {
        lastDismissed: fixedTime,
        dismissCount: 2,
        eliminated: false,
        firstEligibleTime: 0,
      };

      const result = createEliminatedState(initialState);

      expect(result).toEqual({
        lastDismissed: fixedTime,
        dismissCount: 2,
        eliminated: true,
        firstEligibleTime: 0,
      });
    });
  });

  describe('createDefaultNagState', () => {
    it('should create default state', () => {
      const result = createDefaultNagState();

      expect(result).toEqual({
        lastDismissed: 0,
        dismissCount: 0,
        eliminated: false,
        firstEligibleTime: 0,
      });
    });
  });
});
