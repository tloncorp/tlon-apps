import { describe, expect, it } from 'vitest';

import { getTopLevelTabBarClearance } from './topLevelTabBarClearance';

describe('getTopLevelTabBarClearance', () => {
  it('reserves the floating pill band on iOS 26, whatever the safe area', () => {
    expect(
      getTopLevelTabBarClearance({
        platform: 'ios',
        floatingTabBar: true,
        bottomInset: 34,
      })
    ).toBe(84);
    expect(
      getTopLevelTabBarClearance({
        platform: 'ios',
        floatingTabBar: true,
        bottomInset: 0,
      })
    ).toBe(84);
  });

  it('stacks the legacy 49pt bar on the safe area before iOS 26', () => {
    expect(
      getTopLevelTabBarClearance({
        platform: 'ios',
        floatingTabBar: false,
        bottomInset: 0,
      })
    ).toBe(49);
    expect(
      getTopLevelTabBarClearance({
        platform: 'ios',
        floatingTabBar: false,
        bottomInset: 34,
      })
    ).toBe(83);
  });

  it('stacks the Android bar on the safe area, and reserves nothing elsewhere', () => {
    expect(
      getTopLevelTabBarClearance({
        platform: 'android',
        floatingTabBar: false,
        bottomInset: 24,
      })
    ).toBe(104);
    expect(
      getTopLevelTabBarClearance({
        platform: 'web',
        floatingTabBar: false,
        bottomInset: 0,
      })
    ).toBe(0);
  });
});
