import { describe, expect, it } from 'vitest';

import type { ScreenHeaderAction } from './actions';
import { getNativeTitleMaxWidth } from './titleLayout';

const back: ScreenHeaderAction = {
  id: 'back',
  icon: 'ChevronLeft',
  label: 'Back',
};
const search: ScreenHeaderAction = {
  id: 'search',
  icon: 'Search',
  label: 'Search',
};
const menu: ScreenHeaderAction = {
  id: 'menu',
  icon: 'RightSidebar',
  label: 'Details',
};

describe('native header title space', () => {
  it.each([320, 375, 393, 402, 430])(
    'keeps the whole title clear of two right actions at %i points',
    (width) => {
      const titleWidth = getNativeTitleMaxWidth({
        width,
        fontScale: 1,
        left: [back],
        right: [search, menu],
      });
      const titleRight = (width + titleWidth) / 2;
      const actionsLeft = width - 16 - 44 * 2 - 8;
      expect(titleRight).toBeLessThanOrEqual(actionsLeft - 8);
      expect(titleWidth).toBeGreaterThan(0);
    }
  );

  it('reserves the larger side and ignores hidden actions', () => {
    const args = {
      width: 375,
      fontScale: 1,
      left: [back],
      right: [search, menu],
    };
    const width = getNativeTitleMaxWidth(args);
    expect(
      getNativeTitleMaxWidth({ ...args, left: args.right, right: args.left })
    ).toBe(width);
    expect(
      getNativeTitleMaxWidth({
        ...args,
        right: [search, { ...menu, visible: false }],
      })
    ).toBeGreaterThan(width);
  });

  it('allows less title space for a text action at larger text sizes', () => {
    const args = {
      width: 375,
      left: [back],
      right: [{ id: 'edit', text: 'Edit' }],
    };
    expect(getNativeTitleMaxWidth({ ...args, fontScale: 2 })).toBeLessThan(
      getNativeTitleMaxWidth({ ...args, fontScale: 1 })
    );
  });

  it('does not force a minimum title width over crowded controls', () => {
    expect(
      getNativeTitleMaxWidth({
        width: 200,
        fontScale: 1,
        left: [back],
        right: [search, menu],
      })
    ).toBe(0);
  });

  it('uses the available space on tablets and wide native windows', () => {
    const titleWidth = getNativeTitleMaxWidth({
      width: 1024,
      fontScale: 1,
      left: [back],
      right: [search, menu],
    });
    expect(titleWidth).toBeGreaterThan(700);
  });
});
