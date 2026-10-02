import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { startForegroundTimeout } from './foregroundTimeout';

function mockAppState(initialState: string) {
  const listeners = new Set<(state: string) => void>();
  const remove = vi.fn();
  const appState = {
    currentState: initialState,
    addEventListener: vi.fn(
      (_type: 'change', listener: (state: string) => void) => {
        listeners.add(listener);
        return {
          remove: () => {
            remove();
            listeners.delete(listener);
          },
        };
      }
    ),
  };

  return {
    appState,
    remove,
    listenerCount: () => listeners.size,
    setState(state: string) {
      appState.currentState = state;
      listeners.forEach((listener) => listener(state));
    },
  };
}

describe('startForegroundTimeout', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires after the budget of active time', () => {
    const { appState } = mockAppState('active');
    const onFire = vi.fn();

    const timeout = startForegroundTimeout(5_000, onFire, { appState });

    vi.advanceTimersByTime(4_999);
    expect(onFire).not.toHaveBeenCalled();
    expect(timeout.activeElapsedMs()).toBe(4_999);

    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(timeout.activeElapsedMs()).toBe(5_000);
  });

  it('does not count a background stretch longer than the budget', () => {
    const state = mockAppState('active');
    const onFire = vi.fn();

    const timeout = startForegroundTimeout(5_000, onFire, {
      appState: state.appState,
    });

    vi.advanceTimersByTime(2_000);
    state.setState('background');
    vi.advanceTimersByTime(60_000);
    expect(onFire).not.toHaveBeenCalled();
    expect(timeout.activeElapsedMs()).toBe(2_000);

    state.setState('active');
    vi.advanceTimersByTime(2_999);
    expect(onFire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
    expect(timeout.activeElapsedMs()).toBe(5_000);
  });

  it('treats inactive like background', () => {
    const state = mockAppState('active');
    const onFire = vi.fn();

    startForegroundTimeout(5_000, onFire, { appState: state.appState });

    vi.advanceTimersByTime(1_000);
    state.setState('inactive');
    vi.advanceTimersByTime(10_000);
    state.setState('background');
    vi.advanceTimersByTime(10_000);
    expect(onFire).not.toHaveBeenCalled();

    state.setState('active');
    vi.advanceTimersByTime(4_000);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('does not start counting until the app is first active', () => {
    const state = mockAppState('background');
    const onFire = vi.fn();

    const timeout = startForegroundTimeout(5_000, onFire, {
      appState: state.appState,
    });

    vi.advanceTimersByTime(60_000);
    expect(onFire).not.toHaveBeenCalled();
    expect(timeout.activeElapsedMs()).toBe(0);

    state.setState('active');
    vi.advanceTimersByTime(4_999);
    expect(onFire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onFire).toHaveBeenCalledTimes(1);
  });

  it('cancel stops the timer and removes the AppState subscription', () => {
    const state = mockAppState('active');
    const onFire = vi.fn();

    const timeout = startForegroundTimeout(5_000, onFire, {
      appState: state.appState,
    });
    expect(state.listenerCount()).toBe(1);

    vi.advanceTimersByTime(1_000);
    timeout.cancel();

    expect(state.remove).toHaveBeenCalledTimes(1);
    expect(state.listenerCount()).toBe(0);
    expect(vi.getTimerCount()).toBe(0);

    vi.advanceTimersByTime(10_000);
    expect(onFire).not.toHaveBeenCalled();
    expect(timeout.activeElapsedMs()).toBe(1_000);
  });

  it('removes the AppState subscription once it fires', () => {
    const state = mockAppState('active');
    const onFire = vi.fn();

    startForegroundTimeout(5_000, onFire, { appState: state.appState });
    vi.advanceTimersByTime(5_000);

    expect(onFire).toHaveBeenCalledTimes(1);
    expect(state.remove).toHaveBeenCalledTimes(1);
    expect(state.listenerCount()).toBe(0);
  });

  it('falls back to a plain timeout when AppState is unavailable', () => {
    const state = mockAppState('background');
    const onFire = vi.fn();

    startForegroundTimeout(5_000, onFire, {
      appState: { ...state.appState, isAvailable: false },
    });

    expect(state.appState.addEventListener).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5_000);
    expect(onFire).toHaveBeenCalledTimes(1);
  });
});
