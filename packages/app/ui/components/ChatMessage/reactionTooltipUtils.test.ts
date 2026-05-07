import { describe, expect, test } from 'vitest';

import {
  TOOLTIP_USER_DISPLAY_COUNT,
  getReactionTooltipDisplayPlan,
} from './reactionTooltipUtils';

describe('getReactionTooltipDisplayPlan', () => {
  test('empty', () => {
    expect(getReactionTooltipDisplayPlan([])).toEqual({
      displayed: [],
      moreCount: 0,
    });
  });

  test('one user', () => {
    const users = [{ id: '~ravmel-ropdyl' }];
    const plan = getReactionTooltipDisplayPlan(users);
    expect(plan.displayed).toHaveLength(1);
    expect(plan.displayed[0].id).toBe('~ravmel-ropdyl');
    expect(plan.moreCount).toBe(0);
  });

  test('three users', () => {
    const users = [
      { id: '~ravmel-ropdyl' },
      { id: '~rilfun-lidlen' },
      { id: '~solfer-magfed' },
    ];
    const plan = getReactionTooltipDisplayPlan(users);
    expect(plan.displayed).toHaveLength(3);
    expect(plan.moreCount).toBe(0);
  });

  test('five users', () => {
    const users = [
      { id: '~ravmel-ropdyl' },
      { id: '~rilfun-lidlen' },
      { id: '~solfer-magfed' },
      { id: '~nocsyx-lassul' },
      { id: '~latter-bolden' },
    ];
    const plan = getReactionTooltipDisplayPlan(users);
    expect(plan.displayed).toHaveLength(3);
    expect(plan.displayed.map((u) => u.id)).toEqual([
      '~ravmel-ropdyl',
      '~rilfun-lidlen',
      '~solfer-magfed',
    ]);
    expect(plan.moreCount).toBe(2);
  });

  test('large', () => {
    const users = Array.from({ length: 100 }, (_, i) => ({
      id: `user-${i}`,
    }));
    const plan = getReactionTooltipDisplayPlan(users);
    expect(plan.displayed).toHaveLength(3);
    expect(plan.moreCount).toBe(97);
  });

  test('respects display count constant', () => {
    expect(TOOLTIP_USER_DISPLAY_COUNT).toBe(3);
  });
});
