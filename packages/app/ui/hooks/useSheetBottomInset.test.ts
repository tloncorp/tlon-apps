import { afterEach, describe, expect, it, vi } from 'vitest';

import { useSheetBottomInset } from './useSheetBottomInset';

const platform = vi.hoisted(() => ({ OS: 'ios' }));
vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34 }),
}));

afterEach(() => {
  platform.OS = 'ios';
});

describe('useSheetBottomInset', () => {
  it.each(['ios', 'android'])(
    'adds nothing on %s, where the native sheet already clears the system bar',
    (os) => {
      platform.OS = os;
      expect(useSheetBottomInset()).toBe(0);
    }
  );

  it('keeps the window inset on web', () => {
    platform.OS = 'web';
    expect(useSheetBottomInset()).toBe(34);
  });
});
