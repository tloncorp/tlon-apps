import { describe, expect, it, vi } from 'vitest';

import {
  type ScreenHeaderAction,
  type ScreenHeaderIconAction,
  type ScreenHeaderMenuAction,
  attachLatestScreenHeaderActionCallbacks,
  getScreenHeaderActionPresentation,
  visibleScreenHeaderActions,
} from './actions';

describe('screen header actions', () => {
  it('preserves declaration order while excluding hidden actions', () => {
    const actions: ScreenHeaderAction[] = [
      { kind: 'text', id: 'first', text: 'First' },
      { kind: 'text', id: 'hidden', text: 'Hidden', visible: false },
      { kind: 'icon', id: 'last', icon: 'Search', label: 'Search' },
    ];

    expect(visibleScreenHeaderActions(actions).map((item) => item.id)).toEqual([
      'first',
      'last',
    ]);
  });

  it('forwards button presses to the latest enabled callback', () => {
    const original = vi.fn();
    const latest = vi.fn();
    const actionsRef: { current: ScreenHeaderAction[] } = {
      current: [
        {
          kind: 'icon',
          id: 'search',
          icon: 'Search',
          label: 'Search',
          onPress: original,
        },
      ],
    };
    const forwarded = attachLatestScreenHeaderActionCallbacks(
      getScreenHeaderActionPresentation(actionsRef.current, (color) => color),
      actionsRef
    );

    actionsRef.current = [
      {
        kind: 'icon',
        id: 'search',
        icon: 'Search',
        label: 'Search',
        onPress: latest,
      },
    ];
    (forwarded[0] as ScreenHeaderIconAction).onPress?.();
    expect(original).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();

    actionsRef.current = [
      {
        kind: 'icon',
        id: 'search',
        icon: 'Search',
        label: 'Search',
        onPress: latest,
        disabled: true,
      },
    ];
    (forwarded[0] as ScreenHeaderIconAction).onPress?.();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('forwards menu actions by stable identity after reordering', () => {
    const original = vi.fn();
    const latest = vi.fn();
    const actionsRef: { current: ScreenHeaderAction[] } = {
      current: [
        {
          kind: 'menu',
          id: 'options',
          icon: 'Overflow',
          label: 'Options',
          items: [
            { id: 'read', label: 'Mark all read', onPress: original },
            { id: 'settings', label: 'Settings', onPress: vi.fn() },
          ],
        },
      ],
    };
    const forwarded = attachLatestScreenHeaderActionCallbacks(
      getScreenHeaderActionPresentation(actionsRef.current, (color) => color),
      actionsRef
    );

    actionsRef.current = [
      {
        kind: 'menu',
        id: 'options',
        icon: 'Overflow',
        label: 'Options',
        items: [
          { id: 'settings', label: 'Settings', onPress: vi.fn() },
          { id: 'read', label: 'Mark all read', onPress: latest },
        ],
      },
    ];
    (forwarded[0] as ScreenHeaderMenuAction).items[0]?.onPress();
    expect(original).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
  });

  it('captures all rendered state and resolved colors in its signature', () => {
    const resolveColor = (color: string | undefined) =>
      color === '$accent' ? '#00ff00' : color;
    const base: ScreenHeaderAction[] = [
      {
        kind: 'icon',
        id: 'add',
        icon: 'Add',
        label: 'Add',
        tint: '$accent',
        testID: 'add-button',
      },
      {
        kind: 'menu',
        id: 'options',
        icon: 'Overflow',
        label: 'Options',
        items: [{ id: 'read', label: 'Mark all read', onPress: vi.fn() }],
      },
    ];
    const serialize = (actions: ScreenHeaderAction[]) =>
      JSON.stringify(getScreenHeaderActionPresentation(actions, resolveColor));
    const signature = serialize(base);

    expect(signature).toContain('#00ff00');
    expect(signature).toContain('add-button');
    expect(signature).not.toBe(
      serialize([
        { ...base[0], label: 'Create' } as ScreenHeaderAction,
        base[1],
      ])
    );
    expect(signature).not.toBe(
      serialize([base[0], { ...base[1], label: 'More' } as ScreenHeaderAction])
    );
  });
});
