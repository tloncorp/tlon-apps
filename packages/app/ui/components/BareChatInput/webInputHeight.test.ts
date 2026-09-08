// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WebScrollCoordinator } from '../Channel/PostList/webScrollCoordinator';
import {
  measureWebInputHeight,
  scheduleWebInputHeight,
} from './webInputHeight';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Actual element/style identity, with the browser's forced-layout clamp modeled. */
function fixture(
  options: {
    frameBox?: 'border-box' | 'content-box';
    framePadding?: number;
    frameBorder?: number;
    inputBox?: 'border-box' | 'content-box';
    inputPadding?: number;
    inputBorder?: number;
  } = {}
) {
  const frame = document.createElement('div');
  const input = document.createElement('textarea');
  frame.append(input);
  document.body.append(frame);
  frame.style.boxSizing = options.frameBox ?? 'border-box';
  frame.style.paddingBlock = `${options.framePadding ?? 0}px`;
  frame.style.borderBlock = `${options.frameBorder ?? 0}px solid black`;
  frame.style.setProperty('min-height', '0px', 'important');
  input.style.boxSizing = options.inputBox ?? 'border-box';
  input.style.paddingTop =
    input.style.paddingBottom = `${options.inputPadding ?? 0}px`;
  input.style.height = '55.5px';
  input.style.minHeight = '44px';
  input.value = 'first line\nsecond line';
  input.focus();
  input.setSelectionRange(3, 8, 'forward');
  const frameChrome =
    2 * ((options.framePadding ?? 0) + (options.frameBorder ?? 0));
  const inputPadding = 2 * (options.inputPadding ?? 0);
  const inputBorder = 2 * (options.inputBorder ?? 0);
  const inputBox = options.inputBox ?? 'border-box';
  const frameBox = options.frameBox ?? 'border-box';
  const inputCssHeight = () =>
    Math.max(44, Number.parseFloat(input.style.height) || 0);
  const inputOuterHeight = () =>
    inputCssHeight() +
    (inputBox === 'content-box' ? inputPadding + inputBorder : 0);
  const frameCssHeight = () =>
    Math.max(
      inputOuterHeight() + (frameBox === 'border-box' ? frameChrome : 0),
      Number.parseFloat(frame.style.minHeight) || 0
    );
  const frameOuterHeight = () =>
    frameCssHeight() + (frameBox === 'content-box' ? frameChrome : 0);
  const initialFrame = frameOuterHeight();
  let naturalCssHeight = 55.5;
  let offset = 1023.5;
  let maximum = offset;
  let extraContent = 0;
  let throwMeasurement = false;
  const measuredMaximums: number[] = [];
  const layout = () => {
    maximum = 1023.5 + extraContent + frameOuterHeight() - initialFrame;
    offset = Math.min(offset, maximum);
    measuredMaximums.push(maximum);
  };
  const nativeStyle = window.getComputedStyle.bind(window);
  vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
    const actual = nativeStyle(element);
    if (element !== frame) return actual;
    return new Proxy(actual, {
      get(target, key) {
        if (key === 'height') return `${frameCssHeight()}px`;
        return Reflect.get(target, key, target);
      },
    });
  });
  Object.defineProperties(input, {
    offsetHeight: {
      get: () => {
        layout();
        return inputOuterHeight();
      },
    },
    clientHeight: {
      get: () => {
        layout();
        return inputOuterHeight() - inputBorder;
      },
    },
    scrollHeight: {
      get: () => {
        layout();
        if (throwMeasurement) throw new Error('measurement failed');
        return (
          naturalCssHeight +
          (inputBox === 'content-box' ? inputPadding : -inputBorder)
        );
      },
    },
  });
  const owner = new WebScrollCoordinator({
    offset: () => offset,
    maximum: () => maximum,
    write: (top) => {
      offset = top;
    },
    visible: () => true,
    capture: () => [{ measure: () => 1500 - offset }],
  });
  owner.configure('channel', true, false);
  owner.goToEdge(false, false);
  owner.scrolled();
  return {
    input,
    frame,
    owner,
    measuredMaximums,
    get offset() {
      return offset;
    },
    get maximum() {
      return maximum;
    },
    get initialFrame() {
      return initialFrame;
    },
    measure() {
      const height = measureWebInputHeight(input, frame, 44);
      layout();
      return height;
    },
    naturalHeight(height: number) {
      naturalCssHeight = height;
    },
    beginReading() {
      owner.userInput(-1);
      offset -= 120;
      owner.scrolled();
      owner.endUserInput();
    },
    grow() {
      extraContent += 100;
      layout();
    },
    throwMeasurement() {
      throwMeasurement = true;
    },
  };
}

describe('web textarea height measurement', () => {
  it.each(['scroll-first', 'reconcile-first'] as const)(
    'unchanged-height typing cannot collapse extent or revoke FOLLOW: %s',
    (order) => {
      const f = fixture();
      const permit = f.owner.captureScrollIntent();
      expect(f.measure()).toBe(55.5);
      expect(Math.min(...f.measuredMaximums)).toBe(1023.5);
      if (order === 'scroll-first') {
        f.owner.scrolled();
        f.owner.reconcile();
      } else {
        f.owner.reconcile();
        f.owner.scrolled();
      }
      expect(f.offset).toBe(1023.5);
      expect(permit()).toBe(true);
      f.grow();
      f.owner.reconcile();
      expect(f.offset).toBe(f.maximum);
    }
  );

  it('leaves a deliberate READ and interior point unchanged through typing and append', () => {
    const f = fixture();
    f.beginReading();
    const before = f.offset;
    f.measure();
    f.owner.scrolled();
    f.owner.reconcile();
    f.grow();
    f.owner.reconcile();
    expect(f.offset).toBe(before);
  });

  it('allows a genuine final shrink and preserves the witnessed FOLLOW clamp', () => {
    const f = fixture();
    const permit = f.owner.captureScrollIntent();
    f.naturalHeight(44);
    f.measure();
    f.owner.scrolled();
    f.owner.reconcile();
    expect(f.offset).toBe(f.maximum);
    expect(f.maximum).toBe(1012);
    f.grow();
    f.owner.reconcile();
    expect(f.offset).toBe(f.maximum);
    expect(permit()).toBe(true);
  });

  it('allows real growth while keeping existing FOLLOW', () => {
    const f = fixture();
    f.naturalHeight(77.5);
    f.measure();
    f.owner.reconcile();
    f.owner.scrolled();
    expect(f.offset).toBe(f.maximum);
    expect(f.maximum).toBe(1045.5);
  });

  it.each(['border-box', 'content-box'] as const)(
    'reserves the used frame size with fractional padding/borders: %s',
    (frameBox) => {
      const f = fixture({ frameBox, framePadding: 7.25, frameBorder: 1.5 });
      f.measure();
      expect(Math.min(...f.measuredMaximums)).toBe(1023.5);
      expect(f.frame.style.getPropertyValue('min-height')).toBe('0px');
      expect(f.frame.style.getPropertyPriority('min-height')).toBe('important');
    }
  );

  it.each(['border-box', 'content-box'] as const)(
    'keeps textarea padding and borders in the correct CSS height coordinate: %s',
    (inputBox) => {
      const f = fixture({ inputBox, inputPadding: 7, inputBorder: 1.5 });
      f.naturalHeight(80);
      expect(f.measure()).toBe(80);
      expect(f.input.style.height).toBe('80px');
    }
  );

  it('restores exact inline values and priorities if measurement throws', () => {
    const f = fixture();
    f.input.style.setProperty('height', '55.5px', 'important');
    f.throwMeasurement();
    expect(f.measure).toThrow('measurement failed');
    expect(f.input.style.getPropertyValue('height')).toBe('55.5px');
    expect(f.input.style.getPropertyPriority('height')).toBe('important');
    expect(f.frame.style.getPropertyValue('min-height')).toBe('0px');
    expect(f.frame.style.getPropertyPriority('min-height')).toBe('important');
    expect(Math.min(...f.measuredMaximums)).toBe(1023.5);
  });

  it('removes temporary declarations when original inline properties were absent', () => {
    const f = fixture();
    f.input.style.removeProperty('height');
    f.frame.style.removeProperty('min-height');
    f.throwMeasurement();
    expect(f.measure).toThrow();
    expect(f.input.style.getPropertyValue('height')).toBe('');
    expect(f.frame.style.getPropertyValue('min-height')).toBe('');
  });

  it('does not change text, selection, direction or focus', () => {
    const f = fixture();
    f.measure();
    expect(document.activeElement).toBe(f.input);
    expect(f.input.value).toBe('first line\nsecond line');
    expect([
      f.input.selectionStart,
      f.input.selectionEnd,
      f.input.selectionDirection,
    ]).toEqual([3, 8, 'forward']);
  });

  it.each(['disconnected-input', 'disconnected-frame', 'unrelated-frame'])(
    'rejects an invalid owned pair: %s',
    (kind) => {
      const f = fixture();
      if (kind === 'disconnected-input') f.input.remove();
      else if (kind === 'disconnected-frame') f.frame.remove();
      else document.body.append(f.input);
      expect(measureWebInputHeight(f.input, f.frame, 44)).toBeNull();
      expect(f.measuredMaximums).toEqual([]);
      expect(f.input.style.height).toBe('55.5px');
    }
  );
});

describe('queued draft height ownership', () => {
  function queued() {
    const f = fixture();
    let callback: FrameRequestCallback = () => {
      throw new Error('not scheduled');
    };
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((next) => {
      callback = next;
      return 7;
    });
    const cancelled = vi
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation(() => {});
    let current = true;
    const measured = vi.fn();
    const cancel = scheduleWebInputHeight(
      f.input,
      f.frame,
      44,
      () => current,
      measured
    );
    return {
      ...f,
      input: f.input,
      frame: f.frame,
      cancel,
      cancelled,
      measured,
      flush: () => callback(100),
      retire: () => {
        current = false;
      },
    };
  }

  it('cancellation rejects even an already-dispatched callback', () => {
    const f = queued();
    f.cancel();
    f.flush();
    expect(f.cancelled).toHaveBeenCalledWith(7);
    expect(f.measured).not.toHaveBeenCalled();
    expect(f.measuredMaximums).toEqual([]);
  });

  it('a replaced input scope cannot be revived by a later callback', () => {
    const f = queued();
    f.retire();
    f.flush();
    expect(f.measured).not.toHaveBeenCalled();
    expect(f.measuredMaximums).toEqual([]);
  });

  it('a disconnected frame does not write or report a new height', () => {
    const f = queued();
    f.frame.remove();
    f.flush();
    expect(f.measured).not.toHaveBeenCalled();
    expect(f.input.style.height).toBe('55.5px');
  });

  it('reports the current input height once after the scheduled frame', () => {
    const f = queued();
    expect(f.measured).not.toHaveBeenCalled();
    f.flush();
    f.flush();
    expect(f.measured).toHaveBeenCalledTimes(1);
    expect(f.measured).toHaveBeenCalledWith(55.5);
  });
});
