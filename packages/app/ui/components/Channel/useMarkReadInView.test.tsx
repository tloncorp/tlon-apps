import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMarkReadInView } from './useMarkReadInView';

type Props = Parameters<typeof useMarkReadInView>[0];

function Harness(props: Props) {
  useMarkReadInView(props);
  return null;
}

let renderer: ReactTestRenderer;
const markRead = vi.fn();

function render(props: Partial<Props>) {
  const element = (
    <Harness
      canMarkRead={props.canMarkRead ?? true}
      inView={props.inView ?? true}
      stamp={props.stamp === undefined ? '1' : props.stamp}
      markRead={props.markRead ?? markRead}
    />
  );
  act(() => {
    if (renderer) {
      renderer.update(element);
    } else {
      renderer = create(element);
    }
  });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  markRead.mockClear();
});
afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined as unknown as ReactTestRenderer;
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe('marking a channel read once its posts are on screen', () => {
  it('reads after a short delay', () => {
    render({});
    advance(149);
    expect(markRead).not.toHaveBeenCalled();
    advance(1);
    expect(markRead).toHaveBeenCalledOnce();
  });

  it('reads at once when the reader leaves the channel before the delay', () => {
    render({});
    advance(50);
    render({ canMarkRead: false, inView: false });
    expect(markRead).toHaveBeenCalledOnce();
    advance(500);
    expect(markRead).toHaveBeenCalledOnce();
  });

  it('reads at once when the channel unmounts before the delay', () => {
    render({});
    advance(50);
    act(() => renderer.unmount());
    renderer = undefined as unknown as ReactTestRenderer;
    expect(markRead).toHaveBeenCalledOnce();
  });

  it('does not read on leaving when nothing was scheduled', () => {
    render({ canMarkRead: false });
    render({ canMarkRead: false, inView: false });
    act(() => renderer.unmount());
    renderer = undefined as unknown as ReactTestRenderer;
    expect(markRead).not.toHaveBeenCalled();
  });

  it('drops a scheduled read when the reader goes idle in view', () => {
    render({});
    advance(50);
    render({ canMarkRead: false });
    advance(500);
    render({ canMarkRead: false, inView: false });
    expect(markRead).not.toHaveBeenCalled();
  });

  it('does not send the same unread twice, and leaving after a read sends nothing', () => {
    render({});
    advance(150);
    // a failed read rolls the unread back unchanged
    render({ canMarkRead: false });
    render({});
    advance(500);
    render({ canMarkRead: false, inView: false });
    expect(markRead).toHaveBeenCalledOnce();
  });

  it('reads again when new activity arrives', () => {
    render({});
    advance(150);
    render({ stamp: '2' });
    advance(150);
    expect(markRead).toHaveBeenCalledTimes(2);
  });

  it('restarts the delay when the activity changes before the read', () => {
    render({});
    advance(100);
    render({ stamp: '2' });
    advance(100);
    expect(markRead).not.toHaveBeenCalled();
    advance(50);
    expect(markRead).toHaveBeenCalledOnce();
  });

  it('uses the latest markRead without restarting the delay', () => {
    const later = vi.fn();
    render({});
    advance(100);
    render({ markRead: later });
    advance(50);
    expect(markRead).not.toHaveBeenCalled();
    expect(later).toHaveBeenCalledOnce();
  });
});
