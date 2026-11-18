import { describe, expect, it, vi } from 'vitest';

import type { ActionGroup } from './ActionSheet';
import { actionGroupsToMenuItems } from './actionMenuItems';

describe('actionGroupsToMenuItems', () => {
  it('leaves out every action the sheet would grey out', () => {
    const run = vi.fn();
    const groups: ActionGroup[] = [
      {
        accent: 'neutral',
        actions: [
          { title: 'Runs', action: run },
          { title: 'Disabled flag', action: run, disabled: true },
          { title: 'Disabled accent', action: run, accent: 'disabled' },
          { title: 'No action' },
        ],
      },
      {
        accent: 'disabled',
        actions: [{ title: 'Disabled group', action: run }],
      },
    ];
    expect(actionGroupsToMenuItems(groups).map((item) => item.title)).toEqual([
      'Runs',
    ]);
  });

  it('separates groups, marks negative actions and keeps keys unique', () => {
    const run = vi.fn();
    const groups: ActionGroup[] = [
      { accent: 'neutral', actions: [{ title: 'Same', action: run }] },
      {
        accent: 'negative',
        actions: [
          { title: 'Same', action: run },
          { title: 'Other', action: run, accent: 'neutral' },
        ],
      },
    ];
    const items = actionGroupsToMenuItems(groups);
    expect(items.map((item) => item.separatorBefore)).toEqual([
      false,
      true,
      false,
    ]);
    expect(items.map((item) => item.destructive)).toEqual([false, true, false]);
    expect(new Set(items.map((item) => item.key)).size).toBe(3);
  });
});
