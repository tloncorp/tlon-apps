import { describe, it, expect } from 'vitest';

import {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  createDefaultNagState,
  validateNagConfig,
  type NagState,
  type NagConfig,
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
      const oneDayAgo = fixedTime - (24 * 60 * 60 * 1000);
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
      const oneHourAgo = fixedTime - (1 * 60 * 60 * 1000);
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
      const oneDayAgo = fixedTime - (24 * 60 * 60 * 1000);
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
      const oneDayAgo = fixedTime - (24 * 60 * 60 * 1000);
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


  describe('validateNagConfig', () => {
    it('should pass validation for valid config', () => {
      const config: NagConfig = {
        key: 'test',
        refreshInterval: 1000,
        refreshCycle: 3,
      };

      const errors = validateNagConfig(config);
      expect(errors).toEqual([]);
    });

    it('should fail validation for missing key', () => {
      const config = {
        key: '',
      } as NagConfig;

      const errors = validateNagConfig(config);
      expect(errors).toContain('key must be a non-empty string');
    });

    it('should fail validation for invalid refreshInterval', () => {
      const config: NagConfig = {
        key: 'test',
        refreshInterval: -1000,
      };

      const errors = validateNagConfig(config);
      expect(errors).toContain('refreshInterval must be a positive number');
    });

    it('should fail validation for invalid refreshCycle', () => {
      const config: NagConfig = {
        key: 'test',
        refreshCycle: -1,
      };

      const errors = validateNagConfig(config);
      expect(errors).toContain('refreshCycle must be a positive integer');
    });

    it('should fail validation for non-integer refreshCycle', () => {
      const config: NagConfig = {
        key: 'test',
        refreshCycle: 2.5,
      };

      const errors = validateNagConfig(config);
      expect(errors).toContain('refreshCycle must be a positive integer');
    });

    it('should collect multiple validation errors', () => {
      const config = {
        key: '',
        refreshInterval: -1000,
        refreshCycle: -1,
      } as NagConfig;

      const errors = validateNagConfig(config);
      expect(errors).toHaveLength(3);
      expect(errors).toContain('key must be a non-empty string');
      expect(errors).toContain('refreshInterval must be a positive number');
      expect(errors).toContain('refreshCycle must be a positive integer');
    });
  });
});