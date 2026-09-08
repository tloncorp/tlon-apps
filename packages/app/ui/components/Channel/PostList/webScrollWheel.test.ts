import { describe, expect, it, vi } from 'vitest';

import { listScrollWheelDirection } from './useWebScrollCoordinator';
import { WebScrollCoordinator } from './webScrollCoordinator';

describe('list wheel ownership', () => {
  const wheel = (deltaY: number, ctrlKey = false) => ({
    isTrusted: true,
    defaultPrevented: false,
    ctrlKey,
    deltaY,
  });

  it.each([-120, 120])('ignores Control-wheel/pinch delta %s', (deltaY) => {
    expect(listScrollWheelDirection(wheel(deltaY, true))).toBeNull();
  });

  it.each([-120, 120])('retains ordinary vertical wheel delta %s', (deltaY) => {
    expect(listScrollWheelDirection(wheel(deltaY))).toBe(Math.sign(deltaY));
  });

  it('ignores untrusted, prevented, and zero vertical wheel input', () => {
    expect(
      listScrollWheelDirection({ ...wheel(-1), isTrusted: false })
    ).toBeNull();
    expect(
      listScrollWheelDirection({ ...wheel(-1), defaultPrevented: true })
    ).toBeNull();
    expect(listScrollWheelDirection(wheel(0))).toBeNull();
  });

  // Controlled owner geometry verifies the event classification consequence;
  // these values do not simulate actual browser zoom or presented frames.
  it.each([-120, 120])(
    'keeps existing FOLLOW and send permission through zoom delta %s and reflow',
    (deltaY) => {
      let offset = 700;
      let maximum = 700;
      const changed = vi.fn();
      const owner = new WebScrollCoordinator({
        offset: () => offset,
        maximum: () => maximum,
        write: (top) => {
          offset = top;
        },
        capture: () => [],
        visible: () => true,
        onIntentChanged: changed,
      });
      owner.configure('channel', true, false);
      owner.goToEdge(false, false);
      const permission = owner.captureScrollIntent();
      const direction = listScrollWheelDirection(wheel(deltaY, true));
      if (direction !== null) owner.userInput(direction);
      maximum = 800;
      owner.reconcile();
      owner.scrolled();
      expect(offset).toBe(800);
      expect(permission()).toBe(true);
      expect(changed).not.toHaveBeenCalled();
    }
  );

  it('ordinary upward wheel still revokes FOLLOW and a pending send before movement', () => {
    let offset = 700;
    let maximum = 700;
    const changed = vi.fn();
    const owner = new WebScrollCoordinator({
      offset: () => offset,
      maximum: () => maximum,
      write: (top) => {
        offset = top;
      },
      capture: () => [],
      visible: () => true,
      onIntentChanged: changed,
    });
    owner.configure('channel', true, false);
    owner.goToEdge(false, false);
    const permission = owner.captureScrollIntent();
    const direction = listScrollWheelDirection(wheel(-120));
    if (direction !== null) owner.userInput(direction);
    expect(permission()).toBe(false);
    expect(changed).toHaveBeenCalledOnce();
    maximum = 800;
    owner.reconcile();
    expect(offset).toBe(700);
  });
});
