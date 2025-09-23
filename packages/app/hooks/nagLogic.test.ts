import { describe, it, expect } from 'vitest';

import {
  shouldShowNag,
  createDismissedState,
  createEliminatedState,
  createDefaultNagState,
  serializeNagState,
  deserializeNagState,
  getLocalStorageKey,
  getSettingsKey,
  validateNagConfig,
  type NagState,
  type NagConfig,
} from './nagLogic';

describe('nagLogic', () => {
  const fixedTime = 1000000000000; // Fixed timestamp for testing

  describe('shouldShowNag', () => {
    it('should show nag initially when never dismissed', () => {
      const state = createDefaultNagState();
      const config = {};

      expect(shouldShowNag(state, config, fixedTime)).toBe(true);
    });

    it('should not show nag if eliminated', () => {
      const state: NagState = {
        lastDismissed: 0,
        dismissCount: 0,
        eliminated: true,
      };
      const config = {};

      expect(shouldShowNag(state, config, fixedTime)).toBe(false);
    });

    it('should not show nag after dismissal without refresh interval', () => {
      const state: NagState = {
        lastDismissed: fixedTime - 1000,
        dismissCount: 1,
        eliminated: false,
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
      };
      const config = {
        refreshInterval: 12 * 60 * 60 * 1000, // 12 hours
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
      };

      const result = createDismissedState(initialState, fixedTime);

      expect(result).toEqual({
        lastDismissed: fixedTime,
        dismissCount: 1,
        eliminated: false,
      });
    });

    it('should preserve other state when dismissing', () => {
      const initialState: NagState = {
        lastDismissed: fixedTime - 1000,
        dismissCount: 2,
        eliminated: false,
      };

      const result = createDismissedState(initialState, fixedTime);

      expect(result).toEqual({
        lastDismissed: fixedTime,
        dismissCount: 3,
        eliminated: false,
      });
    });
  });

  describe('createEliminatedState', () => {
    it('should set eliminated to true', () => {
      const initialState: NagState = {
        lastDismissed: fixedTime,
        dismissCount: 2,
        eliminated: false,
      };

      const result = createEliminatedState(initialState);

      expect(result).toEqual({
        lastDismissed: fixedTime,
        dismissCount: 2,
        eliminated: true,
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
      });
    });
  });

  describe('serializeNagState and deserializeNagState', () => {
    it('should serialize and deserialize state correctly', () => {
      const state: NagState = {
        lastDismissed: fixedTime,
        dismissCount: 5,
        eliminated: true,
      };

      const serialized = serializeNagState(state);
      const deserialized = deserializeNagState(serialized);

      expect(deserialized).toEqual(state);
    });

    it('should return null for invalid JSON', () => {
      const result = deserializeNagState('invalid json');
      expect(result).toBeNull();
    });

    it('should return null for missing required fields', () => {
      const invalidState = JSON.stringify({ lastDismissed: 123 }); // missing fields
      const result = deserializeNagState(invalidState);
      expect(result).toBeNull();
    });

    it('should return null for wrong types', () => {
      const invalidState = JSON.stringify({
        lastDismissed: 'not a number',
        dismissCount: 0,
        eliminated: false,
      });
      const result = deserializeNagState(invalidState);
      expect(result).toBeNull();
    });
  });

  describe('getLocalStorageKey', () => {
    it('should generate correct localStorage key', () => {
      expect(getLocalStorageKey('test')).toBe('nag_state_test');
      expect(getLocalStorageKey('onboarding')).toBe('nag_state_onboarding');
    });
  });

  describe('getSettingsKey', () => {
    it('should generate correct settings key', () => {
      expect(getSettingsKey('test')).toBe('nagState_test');
      expect(getSettingsKey('onboarding')).toBe('nagState_onboarding');
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