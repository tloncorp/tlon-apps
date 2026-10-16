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

const clock: ScreenHeaderAction = {
  id: 'clock',
  icon: 'Clock',
  label: 'Scheduled tasks',
};

describe('native header title space', () => {
  it.each([320, 375, 393, 402, 430])(
    'keeps the whole title clear of two right actions at %i points',
    (width) => {
      const titleWidth = getNativeTitleMaxWidth({
        width,
        fontScale: 1,
        platform: 'ios',
        left: [back],
        right: [search, menu],
      });
      const titleRight = (width + titleWidth) / 2;
      // Measured on iOS 26 at 402 points: two icon buttons share a 100pt
      // platter, and a title within 12pt of it is no longer centered.
      const platterLeft = width - 16 - 100;
      expect(titleRight).toBeLessThanOrEqual(platterLeft - 12);
      expect(titleWidth).toBeGreaterThan(0);
    }
  );

  it('reserves the larger side and ignores hidden actions', () => {
    const args = {
      width: 375,
      fontScale: 1,
      platform: 'ios',
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
      platform: 'ios',
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
        platform: 'ios',
        left: [back],
        right: [search, menu],
      })
    ).toBe(0);
  });

  it('uses the available space on tablets and wide native windows', () => {
    const titleWidth = getNativeTitleMaxWidth({
      width: 1024,
      fontScale: 1,
      platform: 'ios',
      left: [back],
      right: [search, menu],
    });
    expect(titleWidth).toBeGreaterThan(700);
  });

  it.each([393, 402, 440])(
    'gives up centering under three right actions at %i points, where it would leave almost nothing',
    (width) => {
      const args = {
        width,
        fontScale: 1,
        platform: 'ios',
        left: [back],
        right: [search, clock, menu],
      };
      const titleWidth = getNativeTitleMaxWidth(args);
      // Back button: 16 + 44 + 12. Three buttons: 16 + 3 * 44 + 2 * 12 + 12.
      expect(titleWidth).toBe(width - 72 - 184);
      // Centered, it would have had this much.
      expect(width - 2 * 184).toBeLessThan(titleWidth / 2);
      // The same room whichever side the buttons are on.
      expect(
        getNativeTitleMaxWidth({ ...args, left: args.right, right: args.left })
      ).toBe(titleWidth);
    }
  );

  it('still centers under three right actions where there is room to', () => {
    expect(
      getNativeTitleMaxWidth({
        width: 1024,
        fontScale: 1,
        platform: 'ios',
        left: [back],
        right: [search, clock, menu],
      })
    ).toBe(1024 - 2 * 184);
  });

  it('gives up centering under three right actions on Android too', () => {
    expect(
      getNativeTitleMaxWidth({
        width: 360,
        fontScale: 1,
        platform: 'android',
        left: [back],
        right: [search, clock, menu],
      })
    ).toBe(360 - (16 + 32 + 12) - (16 + 32 * 3 + 12 * 2 + 12));
  });

  it('lets an iOS title with no leading buttons run up to the trailing ones', () => {
    const args = {
      width: 402,
      fontScale: 1,
      platform: 'ios',
      left: [],
      right: [search, menu],
    };
    const titleWidth = getNativeTitleMaxWidth(args);
    const platterLeft = 402 - 16 - 100;
    expect(16 + titleWidth).toBe(platterLeft - 12);
    expect(titleWidth).toBeGreaterThan(
      getNativeTitleMaxWidth({ ...args, left: [back] })
    );
    expect(
      getNativeTitleMaxWidth({ ...args, left: [{ ...back, visible: false }] })
    ).toBe(titleWidth);
  });

  it('lets an Android title with no leading buttons run up to the trailing ones', () => {
    const args = {
      width: 360,
      fontScale: 1,
      platform: 'android',
      left: [],
      right: [search, menu],
    };
    const titleWidth = getNativeTitleMaxWidth(args);
    // Measured at 360dp: two 32dp buttons 12dp apart, 16dp from the edge, with
    // 12dp of padding facing the title.
    const buttonsLeft = 360 - 16 - 32 * 2 - 12 - 12;
    expect(16 + titleWidth).toBe(buttonsLeft);
    expect(titleWidth).toBeGreaterThan(
      getNativeTitleMaxWidth({ ...args, left: [back] })
    );
  });

  it('keeps a centered Android title clear of two right actions', () => {
    const titleWidth = getNativeTitleMaxWidth({
      width: 360,
      fontScale: 1,
      platform: 'android',
      left: [back],
      right: [search, menu],
    });
    const buttonsLeft = 360 - 16 - 32 * 2 - 12 - 12;
    expect((360 + titleWidth) / 2).toBe(buttonsLeft);
  });
});
