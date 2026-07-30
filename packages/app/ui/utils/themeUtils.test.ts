import { describe, expect, it } from 'vitest';

import { getNativeColorScheme } from './themeUtils';

describe('getNativeColorScheme', () => {
  it('keeps the automatic theme tied to system appearance', () => {
    expect(getNativeColorScheme('auto')).toBe('unspecified');
  });

  it('uses light native chrome for light app themes', () => {
    expect(getNativeColorScheme('light')).toBe('light');
    expect(getNativeColorScheme('peony')).toBe('light');
  });

  it.each([
    'dark',
    'dracula',
    'greenscreen',
    'gruvbox',
    'monokai',
    'nord',
    'solarized',
  ] as const)('uses dark native chrome for %s', (theme) => {
    expect(getNativeColorScheme(theme)).toBe('dark');
  });
});
