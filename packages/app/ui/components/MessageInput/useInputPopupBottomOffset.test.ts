import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useKeyboardHeight } from '../../hooks/useKeyboardHeight';
import { useInputPopupBottomOffset } from './useInputPopupBottomOffset';

const state = vi.hoisted(() => ({ isVisible: false, height: 0, bottom: 24 }));
vi.mock('react-native-keyboard-controller', () => ({
  useKeyboardState: (select: (value: typeof state) => unknown) => select(state),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: state.bottom }),
}));

describe('native input popup clearance', () => {
  beforeEach(() => {
    Object.assign(state, { isVisible: false, height: 0, bottom: 24 });
  });

  it('uses the safe area when the keyboard is hidden', () => {
    expect(useInputPopupBottomOffset(56)).toEqual({
      bottomOffset: 104,
      backdropBottom: 80,
    });
  });

  it('uses the controller height even when mounted with an open keyboard', () => {
    Object.assign(state, { isVisible: true, height: 300 });
    expect(useInputPopupBottomOffset(56)).toEqual({
      bottomOffset: 380,
      backdropBottom: 356,
    });
  });

  it('leaves a measured multiline composer outside the backdrop', () => {
    Object.assign(state, { isVisible: true, height: 300 });
    expect(useInputPopupBottomOffset(56, 120)).toEqual({
      bottomOffset: 380,
      backdropBottom: 420,
    });
  });

  it('does not use a retained height after dismissal', () => {
    state.height = 300;
    expect(useKeyboardHeight()).toBe(0);
    expect(useInputPopupBottomOffset(56).backdropBottom).toBe(80);
  });

  it('supports a zero safe-area inset', () => {
    state.bottom = 0;
    expect(useInputPopupBottomOffset(56).backdropBottom).toBe(56);
  });
});
