import { unixToDa } from '@urbit/api';
import bigInt, { BigInteger } from 'big-integer';
import _ from 'lodash';

export interface Window {
  oldest: BigInteger;
  newest: BigInteger;
  loadedOldest: boolean;
  loadedNewest: boolean;
  latest?: boolean;
}

export interface WindowSet {
  latest?: Window;
  windows: Window[];
}

export const emptyWindow: Window = {
  oldest: unixToDa(Date.now()),
  newest: bigInt(0),
  loadedOldest: false,
  loadedNewest: false,
};
export const emptyWindowSet: WindowSet = {
  latest: emptyWindow,
  windows: [emptyWindow],
};

function inWindow(window: Window, time: BigInteger) {
  return time.geq(window.oldest) && time.leq(window.newest);
}

export function getWindow(
  window?: WindowSet,
  time?: string
): Window | undefined {
  if (!window) {
    return undefined;
  }

  if (!time) {
    return window.latest;
  }

  for (let i = 0; i <= window.windows.length - 1; i += 1) {
    if (inWindow(window.windows[i], bigInt(time))) {
      return window.windows[i];
    }
  }

  return undefined;
}

export function combineWindowSet(windows: Window[]) {
  const result: Window[] = [];
  let last: Window;

  _.forEachRight(windows, (r) => {
    if (!last || r.newest.lt(last.oldest)) {
      result.unshift((last = r));
    } else if (r.oldest.lt(last.oldest)) {
      last.oldest = r.oldest;
      last.latest = last.latest || r.latest;
      last.loadedOldest = r.loadedOldest;
    }
  });

  return result;
}

export function extendCurrentWindow(
  newWindow: Window,
  windows?: WindowSet,
  time?: string
) {
  if (!windows) {
    return {
      latest: newWindow.latest || !time ? newWindow : undefined,
      windows: [newWindow],
    };
  }

  const current = getWindow(windows, time);
  const areEqual = (a: Window, b: Window) =>
    a.oldest.eq(b.oldest) && a.newest.eq(b.newest);
  const newWindowSet =
    current && windows.windows.some((w) => areEqual(w, current))
      ? windows.windows.map((w) => {
          if (areEqual(w, current)) {
            return {
              ...newWindow,
              latest: newWindow.latest || w.latest,
              newest: newWindow.newest.gt(w.newest)
                ? newWindow.newest
                : w.newest,
              oldest: newWindow.oldest.lt(w.oldest)
                ? newWindow.oldest
                : w.oldest,
            };
          }
          return w;
        })
      : [...windows.windows, newWindow];

  const combined = combineWindowSet(
    newWindowSet.sort(
      (a, b) =>
        a.newest.subtract(b.newest).toJSNumber() ||
        a.oldest.subtract(b.oldest).toJSNumber()
    )
  );

  return {
    latest: combined.find((w) => w.latest),
    windows: combined,
  };
}
