import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getDisplayTheme, normalizeTheme } from '../../ui/utils/themeUtils';

describe('Theme Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeTheme', () => {
    it('should return the input theme when it is a valid theme name', () => {
      expect(normalizeTheme('light')).toBe('light');
      expect(normalizeTheme('dark')).toBe('dark');
      expect(normalizeTheme('dracula')).toBe('dracula');
    });

    it('should return "auto" for invalid inputs', () => {
      expect(normalizeTheme('invalid-theme')).toBe('auto');
      expect(normalizeTheme('')).toBe('auto');
      expect(normalizeTheme(42 as unknown as string)).toBe('auto');
    });
  });

  describe('getDisplayTheme', () => {
    it('should return the input theme when not "auto"', () => {
      expect(getDisplayTheme('light', false)).toBe('light');
      expect(getDisplayTheme('dark', false)).toBe('dark');
      expect(getDisplayTheme('dracula', false)).toBe('dracula');
    });

    it('should return "dark" when theme is "auto" and system is dark', () => {
      expect(getDisplayTheme('auto', true)).toBe('dark');
    });

    it('should return "light" when theme is "auto" and system is light', () => {
      expect(getDisplayTheme('auto', false)).toBe('light');
    });
  });
});
