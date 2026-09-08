import { describe, expect, it, vi } from 'vitest';
import {
  createNativeScrollOwnership,
  nativeAnchorViewOffset,
  runOwnedNativeScroll,
} from './nativeScrollOwnership';
import { createConversationEndAnchorRegistry } from '../../../contexts/conversationEndAnchor';

describe('native intent ownership', () => {
  it('a reentrant subscriber cannot grant the old command its newer permit', () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    let current = () => false;
    const unsubscribe = owner.subscribe(() => {
      unsubscribe();
      current = owner.navigate('follow');
    });
    const old = owner.navigate('read');
    expect(old()).toBe(false);
    expect(current()).toBe(true);
  });
  it('settlement retires its continuation if a subscriber starts a newer target', () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    owner.navigate('read');
    const unsubscribe = owner.subscribe(() => {
      unsubscribe();
      owner.navigate('follow');
    });
    expect(owner.finishNavigation()).toBe(false);
    expect(owner.getSnapshot()).toMatchObject({
      mode: 'follow',
      commandPending: true,
    });
  });
  it('publishes a pending target even when READ mode does not change', () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    const before = owner.getSnapshot();
    const listener = vi.fn();
    owner.subscribe(listener);
    owner.navigate('read');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(owner.getSnapshot()).toMatchObject({
      mode: 'read',
      commandPending: true,
    });
    expect(owner.getSnapshot().revision).toBeGreaterThan(before.revision);
    expect(before.commandPending).toBe(false);
  });
  it('settlement changes the phase without reviving older intent', () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    const old = owner.capture();
    const current = owner.navigate('read');
    const revision = owner.getSnapshot().revision;
    owner.finishNavigation();
    expect(owner.getSnapshot()).toMatchObject({
      revision,
      commandPending: false,
    });
    expect(old()).toBe(false);
    expect(current()).toBe(true);
  });
  it('drag and cover retire pending targets and publish the new owner', () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    owner.navigate('read');
    owner.beginGesture();
    expect(owner.getSnapshot().commandPending).toBe(false);
    owner.navigate('follow');
    owner.suspend();
    expect(owner.getSnapshot()).toMatchObject({
      active: false,
      mode: 'read',
      commandPending: false,
    });
  });
  it('unchanged activation and settlement keep the snapshot stable', () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    const current = owner.getSnapshot();
    const listener = vi.fn();
    owner.subscribe(listener);
    owner.activate();
    owner.finishNavigation();
    expect(owner.getSnapshot()).toBe(current);
    expect(listener).not.toHaveBeenCalled();
  });
  it('keeps READ until an actual user gesture reaches the exact bottom', () => {
    const owner = createNativeScrollOwnership('follow');
    owner.activate();
    const old = owner.capture();
    owner.beginGesture();
    owner.settleGesture(40, false);
    expect(owner.getMode()).toBe('read');
    owner.settleGesture(0, true);
    expect(owner.getMode()).toBe('read');
    owner.settleGesture(0, false);
    expect(owner.getMode()).toBe('follow');
    expect(old()).toBe(false);
  });
  it('ignores bottom observations without a current gesture', () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    owner.settleGesture(0, false);
    expect(owner.getMode()).toBe('read');
  });
  it.each(['read', 'follow'] as const)(
    'imperative %s navigation revokes old work even after returning to FOLLOW',
    (mode) => {
      const owner = createNativeScrollOwnership('follow');
      owner.activate();
      const old = owner.capture();
      owner.navigate(mode);
      owner.navigate('follow');
      expect(old()).toBe(false);
      expect(owner.capture()()).toBe(true);
    }
  );
  it('does not revalidate pre-cleanup permits during StrictMode restart', () => {
    const owner = createNativeScrollOwnership('follow');
    owner.activate();
    const old = owner.capture();
    owner.dispose();
    owner.activate();
    expect(old()).toBe(false);
    expect(owner.capture()()).toBe(true);
  });
  it.each(['drag', 'navigate', 'dispose'] as const)(
    'cancels a failed scroll retry after %s',
    async (action) => {
      const owner = createNativeScrollOwnership('follow');
      owner.activate();
      const frames: (() => void)[] = [];
      const scroll = vi.fn().mockRejectedValue(new Error('measurement'));
      runOwnedNativeScroll(owner.capture(), scroll, (fn) => frames.push(fn));
      await vi.waitFor(() => expect(frames).toHaveLength(1));
      if (action === 'drag') owner.beginGesture();
      else if (action === 'navigate') owner.navigate('read');
      else owner.dispose();
      frames.forEach((fn) => fn());
      await Promise.resolve();
      expect(scroll).toHaveBeenCalledTimes(1);
    }
  );
  it('retries one transient measurement failure while its action still owns the list', async () => {
    const owner = createNativeScrollOwnership('read');
    owner.activate();
    const frames: (() => void)[] = [];
    const scroll = vi.fn().mockRejectedValue(new Error('measurement'));
    runOwnedNativeScroll(owner.navigate('follow'), scroll, (fn) =>
      frames.push(fn)
    );
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    frames.forEach((fn) => fn());
    await Promise.resolve();
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(frames).toHaveLength(1);
  });
});

describe('composer restore registration', () => {
  it('never restores a replacement owner, including same-handler ABA registration', () => {
    const registry = createConversationEndAnchorRegistry();
    const first = { capture: vi.fn(), restore: vi.fn() };
    const dispose = registry.register(first);
    registry.capture();
    dispose();
    registry.register({ capture: vi.fn(), restore: vi.fn() });
    registry.register(first);
    registry.restore();
    expect(first.restore).not.toHaveBeenCalled();
  });
  it('consumes capture before invoking reentrant restore', () => {
    const registry = createConversationEndAnchorRegistry();
    const restore = vi.fn(() => registry.restore());
    registry.register({ capture: vi.fn(), restore });
    registry.capture();
    registry.restore();
    expect(restore).toHaveBeenCalledTimes(1);
  });
  it('revokes capture if capture itself installs a new owner', () => {
    const registry = createConversationEndAnchorRegistry();
    const restore = vi.fn();
    registry.register({
      capture: () => registry.register({ capture: vi.fn(), restore }),
      restore,
    });
    registry.capture();
    registry.restore();
    expect(restore).not.toHaveBeenCalled();
  });
});

it('centers selected content in the usable viewport without double-counting native composer clearance', () => {
  // Native LegendList already subtracts its 140-point trailing inset. The
  // requested center of a 100-point row is the center of [120, 660], or390.
  const insetOffset = nativeAnchorViewOffset(120, 140, 0.5, true);
  const rowTop = 0.5 * (800 - 140 - 100) + insetOffset;
  expect(rowTop + 50).toBe(390);
  // Without a native trailing inset, encode that same bottom clearance once.
  expect(
    0.5 * (800 - 100) + nativeAnchorViewOffset(120, 140, 0.5, false) + 50
  ).toBe(390);
  expect(nativeAnchorViewOffset(120, 140, 0, true)).toBe(120);
  // The installed library adds 52 to the scroll offset for a last-row footer;
  // after compensating, the selected row still centers at exactly390.
  expect(
    0.5 * (800 - 140 - 100) +
      nativeAnchorViewOffset(120, 140, 0.5, true, 52) -
      52 +
      50
  ).toBe(390);
});

describe('owned command failure signals', () => {
  it('does not retry terminal dependency exhaustion or call successful finish', async () => {
    const error = { code: 'LEGEND_SCROLL_UNALIGNED' };
    const scroll = vi.fn().mockRejectedValue(error);
    const frame = vi.fn();
    const finish = vi.fn();
    const fail = vi.fn();
    runOwnedNativeScroll(() => true, scroll, frame, finish, fail);
    await vi.waitFor(() => expect(fail).toHaveBeenCalledTimes(1), {
      timeout: 50,
      interval: 1,
    });
    expect(scroll).toHaveBeenCalledTimes(1);
    expect(frame).not.toHaveBeenCalled();
    expect(finish).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledWith(error);
  });
  it('second ordinary rejection reports failure rather than successful completion', async () => {
    const error = new Error('measurement');
    const scroll = vi.fn().mockRejectedValue(error);
    const frames: (() => void)[] = [];
    const finish = vi.fn();
    const fail = vi.fn();
    runOwnedNativeScroll(
      () => true,
      scroll,
      (f) => frames.push(f),
      finish,
      fail
    );
    await vi.waitFor(() => expect(frames).toHaveLength(1), {
      timeout: 50,
      interval: 1,
    });
    expect(frames).toHaveLength(1);
    frames.shift()!();
    await vi.waitFor(() => expect(fail).toHaveBeenCalledTimes(1), {
      timeout: 50,
      interval: 1,
    });
    expect(scroll).toHaveBeenCalledTimes(2);
    expect(finish).not.toHaveBeenCalled();
    expect(fail).toHaveBeenCalledTimes(1);
    expect(fail).toHaveBeenCalledWith(error);
  });
});
