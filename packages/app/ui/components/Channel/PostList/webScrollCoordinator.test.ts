import { describe, expect, it, vi } from 'vitest';

import { WebScrollCoordinator } from './webScrollCoordinator';

// Controlled geometry tests the actual production owner; it cannot prove DOM
// rendering cadence or presentation. Real image/reference cases supply that gate.
function setup() {
  const state = {
    offset: 160,
    maximum: 700,
    point: 510,
    neighbor: 800,
    exists: true,
    visible: true,
  };
  const writes: Array<{ offset: number; animated: boolean }> = [];
  const changed = vi.fn();
  const coordinator = new WebScrollCoordinator({
    offset: () => state.offset,
    maximum: () => state.maximum,
    visible: () => state.visible,
    onIntentChanged: changed,
    write: (offset, animated) => {
      writes.push({ offset, animated });
      if (!animated) state.offset = offset;
    },
    capture: () => [
      { measure: () => (state.exists ? state.point - state.offset : null) },
      { measure: () => state.neighbor - state.offset },
    ],
  });
  coordinator.configure('channel-a', true, false);
  coordinator.navigate(() => state.offset, false, false, false);
  return { state, writes, coordinator, changed };
}

describe('web conversation scroll ownership', () => {
  it('never acquires FOLLOW from an unowned positive focus/layout scroll at the end', () => {
    const { state, coordinator } = setup();
    const permission = coordinator.captureScrollIntent();
    state.offset = state.maximum;
    coordinator.scrolled();
    expect(permission()).toBe(false);
    state.maximum += 100;
    coordinator.reconcile();
    expect(state.offset).toBe(700);
  });
  it('preserves the exact interior point when its stationary row shrinks100px', () => {
    const { state, coordinator, writes, changed } = setup();
    state.point -= 100;
    state.maximum -= 100;
    coordinator.reconcile();
    expect(state.offset).toBe(60);
    expect(state.point - state.offset).toBe(350);
    coordinator.reconcile();
    expect(writes).toEqual([{ offset: 60, animated: false }]);
    expect(changed).not.toHaveBeenCalled();
  });

  it('handles both independent completion orders without changing the reading point', () => {
    for (const changes of [
      [70, -100],
      [-100, 70],
    ]) {
      const { state, coordinator } = setup();
      for (const change of changes) {
        state.point += change;
        state.maximum += change;
        coordinator.reconcile();
        expect(state.point - state.offset).toBe(350);
      }
    }
  });

  it('continues FOLLOW through row growth, shrink and composer viewport changes', () => {
    const { state, coordinator, changed } = setup();
    coordinator.goToEdge(false, false);
    changed.mockClear();
    for (const maximum of [900, 600, 677, 600]) {
      state.maximum = maximum;
      coordinator.reconcile();
      expect(state.offset).toBe(maximum);
    }
    expect(changed).not.toHaveBeenCalled();
  });

  it('does not take over READ73px from latest when the composer grows', () => {
    const { state, coordinator } = setup();
    coordinator.goToEdge(false, false);
    coordinator.userInput(-1);
    state.offset -= 73;
    coordinator.scrolled();
    state.maximum += 77;
    coordinator.reconcile();
    expect(state.offset).toBe(627);
    state.maximum -= 77;
    coordinator.reconcile();
    expect(state.offset).toBe(627);
  });

  it('preserves wheel displacement when image reflow arrives before the scroll event', () => {
    const { state, coordinator } = setup();
    coordinator.userInput(-1);
    state.offset -= 20;
    state.point -= 100;
    state.maximum -= 100;
    coordinator.reconcile();
    expect(state.offset).toBe(40);
    expect(state.point - state.offset).toBe(370);
    coordinator.scrolled();
    coordinator.reconcile();
    expect(state.offset).toBe(40);
  });

  it('revokes a pending send before its RAF and never revives it on return to latest', () => {
    const { coordinator, changed } = setup();
    const permitted = coordinator.captureScrollIntent();
    expect(permitted()).toBe(true);
    coordinator.userInput(-1);
    expect(permitted()).toBe(false);
    expect(changed).toHaveBeenCalledOnce();
    coordinator.goToEdge(false);
    expect(permitted()).toBe(false);
    expect(coordinator.captureScrollIntent()()).toBe(true);
  });

  it('cancels the actual browser smooth target before user scrolling', () => {
    const { state, coordinator, writes } = setup();
    coordinator.goToEdge(true);
    state.offset = 250;
    coordinator.scrolled();
    coordinator.userInput(-1);
    expect(writes.at(-1)).toEqual({ offset: 250, animated: false });
    state.maximum = 900;
    coordinator.reconcile();
    expect(state.offset).toBe(250);
  });

  it('retargets an authorized smooth landing when content changes and follows only after arrival', () => {
    const { state, coordinator, writes } = setup();
    coordinator.goToEdge(true);
    state.maximum = 800;
    coordinator.reconcile();
    expect(writes.at(-1)).toEqual({ offset: 800, animated: true });
    state.offset = 800;
    coordinator.scrolled();
    state.maximum = 820;
    coordinator.reconcile();
    expect(state.offset).toBe(820);
  });

  it('permits real downward return to the exact edge without proximity takeover', () => {
    const { state, coordinator } = setup();
    coordinator.userInput(1);
    state.offset = 650;
    coordinator.scrolled();
    state.maximum = 730;
    coordinator.reconcile();
    expect(state.offset).toBe(650);
    state.offset = 730;
    coordinator.scrolled();
    state.maximum = 750;
    coordinator.reconcile();
    expect(state.offset).toBe(750);
  });

  it('uses the saved surviving neighbor after anchored text is deleted', () => {
    const { state, coordinator } = setup();
    state.exists = false;
    state.neighbor -= 70;
    state.maximum -= 70;
    coordinator.reconcile();
    expect(state.offset).toBe(90);
    expect(state.neighbor - state.offset).toBe(640);
  });

  it('clamps unreachable reading positions once and retains READ', () => {
    const { state, coordinator, writes } = setup();
    state.point -= 300;
    coordinator.reconcile();
    expect(state.offset).toBe(0);
    coordinator.reconcile();
    expect(writes).toHaveLength(1);
    state.maximum = 1000;
    coordinator.reconcile();
    expect(state.offset).toBe(0);
  });

  it('has a legal empty-list fallback and does not confuse short layout with new intent', () => {
    let offset = 0;
    let maximum = 0;
    const coordinator = new WebScrollCoordinator({
      offset: () => offset,
      maximum: () => maximum,
      visible: () => true,
      capture: () => [],
      write: (value) => {
        offset = value;
      },
    });
    coordinator.configure('empty', true, false);
    coordinator.goToEdge(false, false);
    maximum = 80;
    coordinator.reconcile();
    expect(offset).toBe(80);
    coordinator.userInput(-1);
    maximum = 100;
    coordinator.reconcile();
    expect(offset).toBe(80);
  });

  it('does not follow incomplete newer pagination until allowed, or if user moved meanwhile', () => {
    const { state, coordinator } = setup();
    coordinator.goToEdge(false, false);
    coordinator.configure('channel-a', true, true);
    state.maximum = 900;
    coordinator.reconcile();
    expect(state.offset).toBe(700);
    coordinator.userInput(-1);
    state.offset = 650;
    coordinator.scrolled();
    coordinator.configure('channel-a', true, false);
    coordinator.reconcile();
    expect(state.offset).toBe(650);
  });

  it.each(['scope', 'hidden', 'unmount'])(
    'invalidates permission permanently on%s',
    (reason) => {
      const { state, coordinator } = setup();
      const valid = coordinator.captureScrollIntent();
      if (reason === 'scope') coordinator.configure('channel-b', true, false);
      if (reason === 'hidden') {
        state.visible = false;
        coordinator.visibilityChanged();
        state.visible = true;
        coordinator.visibilityChanged();
      }
      if (reason === 'unmount') coordinator.dispose();
      expect(valid()).toBe(false);
    }
  );

  it('supports top-oriented single-column content without changing READ ownership', () => {
    const { state, coordinator } = setup();
    coordinator.configure('notebook', false, false);
    coordinator.goToEdge(false, false);
    expect(state.offset).toBe(0);
    coordinator.userInput(1);
    state.offset = 80;
    coordinator.scrolled();
    state.point += 40;
    coordinator.reconcile();
    expect(state.offset).toBe(120);
  });
});

// Regression controls model the browser's own range clamp separately from an
// application write. They intentionally deliver its scroll event in both orders
// relative to the ResizeObserver/layout reconciliation callback.
describe('passive browser range clamp keeps only an existing FOLLOW owner', () => {
  const orders = ['reconcile-first', 'scroll-first'] as const;
  function deliver(
    coordinator: WebScrollCoordinator,
    order: (typeof orders)[number]
  ) {
    if (order === 'reconcile-first') {
      coordinator.reconcile();
      coordinator.scrolled();
    } else {
      coordinator.scrolled();
      coordinator.reconcile();
    }
  }

  it.each(orders)(
    'keeps FOLLOW and pending permits after shrink: %s',
    (order) => {
      const { state, coordinator, changed } = setup();
      coordinator.goToEdge(false, false);
      coordinator.scrolled(); // Drain the prior application write first.
      const permit = coordinator.captureScrollIntent();
      state.maximum = 600;
      state.offset = 600; // Browser auto-clamp, not the surface.write callback.
      deliver(coordinator, order);
      expect(permit()).toBe(true);
      expect(changed).not.toHaveBeenCalled();
      state.maximum = 740;
      coordinator.reconcile();
      expect(state.offset).toBe(740);
    }
  );

  it.each(orders)(
    'does not reverse upward intent racing shrink: %s',
    (order) => {
      const { state, coordinator } = setup();
      coordinator.goToEdge(false, false);
      coordinator.scrolled();
      const permit = coordinator.captureScrollIntent();
      coordinator.userInput(-1);
      state.maximum = 600;
      state.offset = 600;
      deliver(coordinator, order);
      state.maximum = 740;
      coordinator.reconcile();
      expect(state.offset).toBe(600);
      expect(permit()).toBe(false);
      coordinator.goToEdge(false);
      expect(permit()).toBe(false);
    }
  );

  it.each(orders)(
    'retains blocked FOLLOW without following unloaded newer posts: %s',
    (order) => {
      const { state, coordinator } = setup();
      coordinator.goToEdge(false, false);
      coordinator.scrolled();
      coordinator.configure('channel-a', true, true);
      state.maximum = 900;
      coordinator.reconcile();
      expect(state.offset).toBe(700);
      state.maximum = 600;
      state.offset = 600;
      deliver(coordinator, order);
      state.maximum = 740;
      coordinator.reconcile();
      expect(state.offset).toBe(600);
      coordinator.configure('channel-a', true, false);
      coordinator.reconcile();
      expect(state.offset).toBe(740);
    }
  );

  it.each(orders)(
    'does not upgrade a READ owner clamped to the end: %s',
    (order) => {
      const { state, coordinator } = setup();
      coordinator.navigate(() => 650, false, false, false);
      coordinator.scrolled();
      state.maximum = 600;
      state.offset = 600;
      deliver(coordinator, order);
      state.maximum = 740;
      coordinator.reconcile();
      expect(state.offset).toBe(600);
    }
  );

  it('rejects unexplained passive movement even if it lands at the existing end', () => {
    const { state, coordinator } = setup();
    coordinator.goToEdge(false, false);
    coordinator.scrolled();
    const permit = coordinator.captureScrollIntent();
    state.offset = 650;
    coordinator.scrolled();
    state.offset = 700;
    coordinator.scrolled();
    state.maximum = 740;
    coordinator.reconcile();
    expect(state.offset).toBe(700);
    expect(permit()).toBe(false);
  });

  it.each(orders)(
    'preserves the top FOLLOW edge without treating a lower maximum as a bottom command: %s',
    (order) => {
      const { state, coordinator } = setup();
      coordinator.configure('top-list', false, false);
      coordinator.goToEdge(false, false);
      coordinator.scrolled();
      const permit = coordinator.captureScrollIntent();
      state.maximum = 600;
      deliver(coordinator, order);
      state.maximum = 740;
      coordinator.reconcile();
      expect(state.offset).toBe(0);
      expect(permit()).toBe(true);
    }
  );
});
