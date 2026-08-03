import { describe, expect, it, vi } from 'vitest';

import {
  type HeaderIconItemConfig,
  type HeaderMenuItemConfig,
  type ScreenHeaderItemConfig,
  forwardLatestHeaderItemCallbacks,
  getScreenHeaderItemSignature,
  visibleHeaderItemConfigs,
} from './screenHeaderItemModel';

describe('screen header item model', () => {
  it('preserves declaration order while excluding hidden items', () => {
    const configs: ScreenHeaderItemConfig[] = [
      { id: 'first', text: 'First' },
      { id: 'hidden', text: 'Hidden', visible: false },
      { id: 'last', icon: 'Search', label: 'Search' },
    ];

    expect(visibleHeaderItemConfigs(configs).map((item) => item.id)).toEqual([
      'first',
      'last',
    ]);
  });

  it('forwards button presses to the latest enabled callback', () => {
    const original = vi.fn();
    const latest = vi.fn();
    const configsRef: { current: ScreenHeaderItemConfig[] } = {
      current: [
        { id: 'search', icon: 'Search', label: 'Search', onPress: original },
      ],
    };
    const forwarded = forwardLatestHeaderItemCallbacks(configsRef);

    configsRef.current = [
      { id: 'search', icon: 'Search', label: 'Search', onPress: latest },
    ];
    (forwarded[0] as HeaderIconItemConfig).onPress?.();
    expect(original).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();

    configsRef.current = [
      {
        id: 'search',
        icon: 'Search',
        label: 'Search',
        onPress: latest,
        disabled: true,
      },
    ];
    (forwarded[0] as HeaderIconItemConfig).onPress?.();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('forwards menu actions after the menu is updated', () => {
    const original = vi.fn();
    const latest = vi.fn();
    const configsRef: { current: ScreenHeaderItemConfig[] } = {
      current: [
        {
          id: 'options',
          menu: {
            icon: 'Overflow',
            label: 'Options',
            items: [{ label: 'Mark all read', onPress: original }],
          },
        },
      ],
    };
    const forwarded = forwardLatestHeaderItemCallbacks(configsRef);

    configsRef.current = [
      {
        id: 'options',
        menu: {
          icon: 'Overflow',
          label: 'Options',
          items: [{ label: 'Mark all read', onPress: latest }],
        },
      },
    ];
    (forwarded[0] as HeaderMenuItemConfig).menu.items[0]?.onPress();
    expect(original).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('captures rendered state and resolved tint in its signature', () => {
    const resolveColor = (color: string | undefined) =>
      color === '$accent' ? '#00ff00' : color;
    const enabled = getScreenHeaderItemSignature(
      [
        {
          id: 'add',
          icon: 'Add',
          label: 'Add',
          tint: '$accent',
        },
      ],
      resolveColor
    );
    const disabled = getScreenHeaderItemSignature(
      [
        {
          id: 'add',
          icon: 'Add',
          label: 'Add',
          tint: '$accent',
          disabled: true,
        },
      ],
      resolveColor
    );

    expect(enabled).toContain('#00ff00');
    expect(disabled).not.toBe(enabled);
  });
});
