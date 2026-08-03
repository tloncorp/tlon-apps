import { describe, expect, it } from 'vitest';

import { getTopLevelTabBarContentInset } from './topLevelTabBarMetrics';

describe('getTopLevelTabBarContentInset', () => {
  it('keeps ordinary content spacing on web', () => {
    expect(getTopLevelTabBarContentInset('web', 0, 16)).toBe(16);
  });

  it('includes the iOS bar, safe area, and content spacing', () => {
    expect(getTopLevelTabBarContentInset('ios', 34, 16)).toBe(99);
  });

  it('includes the Android bar and device inset', () => {
    expect(getTopLevelTabBarContentInset('android', 24, 16)).toBe(104);
  });
});
