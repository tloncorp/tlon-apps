// @vitest-environment jsdom
import { act, createElement, useLayoutEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLifecyclePermit } from '../../../../hooks/useLifecyclePermit';
import { useWebScrollCoordinator } from './useWebScrollCoordinator';
import type { WebScrollCoordinator } from './webScrollCoordinator';
const geometry = vi.hoisted(() => ({ point: 510, exists: true }));
vi.mock('./webReadingAnchor', async () => {
  const actual =
    await vi.importActual<typeof import('./webReadingAnchor')>(
      './webReadingAnchor'
    );
  return {
    ...actual,
    captureWebReadingPoints: (list: HTMLElement) => [
      {
        measure: () =>
          geometry.exists ? geometry.point - list.scrollTop : null,
      },
    ],
  };
});
let root: Root,
  host: HTMLDivElement,
  list: HTMLDivElement,
  owner: WebScrollCoordinator,
  maximum: number;
let writes: Array<{ top: number; behavior: string }>;
let visit: ReturnType<typeof useLifecyclePermit>;
function Harness({ focused }: { focused: boolean }) {
  const scrollerRef = useRef<HTMLDivElement | null>(null),
    contentRef = useRef<HTMLDivElement | null>(null);
  visit = useLifecyclePermit(['channel-a'], focused);
  const coordinator = useWebScrollCoordinator({
    scrollerRef,
    contentRef,
    scope: 'channel-a',
    anchorToEnd: true,
    followBlocked: false,
    isFocused: focused,
  });
  useLayoutEffect(() => {
    owner = coordinator.current!;
  });
  return createElement(
    'div',
    {
      ref: (node: HTMLDivElement | null) => {
        scrollerRef.current = node;
        if (node) {
          list = node;
          if (!Object.hasOwn(node, 'clientHeight')) {
            Object.defineProperties(node, {
              clientHeight: { value: 699 },
              clientWidth: { value: 600 },
              scrollHeight: { get: () => maximum + 699 },
            });
            node.scrollTop = 160;
            node.scrollTo = (options?: ScrollToOptions | number) => {
              if (!options || typeof options === 'number')
                throw new Error('Unexpected coordinate overload');
              writes.push({
                top: options.top ?? 0,
                behavior: options.behavior ?? 'auto',
              });
              if (options.behavior !== 'smooth')
                node.scrollTop = options.top ?? 0;
            };
          }
        }
      },
    },
    createElement('div', { ref: contentRef })
  );
}
async function render(focused: boolean) {
  await act(async () => root.render(createElement(Harness, { focused })));
}
beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  document.head.innerHTML = '<style>*{opacity:1;visibility:visible}</style>';
  maximum = 700;
  writes = [];
  geometry.point = 510;
  geometry.exists = true;
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  );
  host = document.body.appendChild(document.createElement('div'));
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  document.head.innerHTML = '';
  vi.unstubAllGlobals();
});
// Real React DOM hook/coordinator, with controlled layout and point acquisition.
// Actual browser route rendering and presentation are separate product gates.
describe('retained web route focus through the real DOM adapter', () => {
  it('retires permits and rejects a covered direct latest command', async () => {
    await render(true);
    const permit = owner.captureScrollIntent(),
      sameOwner = owner,
      sameList = list;
    await render(false);
    expect(permit()).toBe(false);
    writes.length = 0;
    owner.goToEdge(false);
    expect(writes).toEqual([]);
    expect(owner).toBe(sameOwner);
    expect(list).toBe(sameList);
    await render(true);
    expect(permit()).toBe(false);
  });
  it('keeps the old bottom on return and resumes FOLLOW only after fresh latest', async () => {
    await render(true);
    owner.goToEdge(false, false);
    owner.scrolled();
    await render(false);
    writes.length = 0;
    maximum = 900;
    owner.reconcile();
    expect(writes).toEqual([]);
    await render(true);
    expect(list.scrollTop).toBe(700);
    maximum = 1000;
    owner.reconcile();
    expect(list.scrollTop).toBe(700);
    owner.goToEdge(false);
    maximum = 1100;
    owner.reconcile();
    expect(list.scrollTop).toBe(1100);
  });
  it('restores the exact interior point after covered reflow without writing while covered', async () => {
    await render(true);
    await render(false);
    writes.length = 0;
    geometry.point -= 100;
    maximum -= 100;
    owner.reconcile();
    expect(writes).toEqual([]);
    await render(true);
    expect(list.scrollTop).toBe(60);
    expect(geometry.point - list.scrollTop).toBe(350);
  });
  it('cancels a pending smooth target once and never restarts it on return', async () => {
    await render(true);
    owner.goToEdge(true);
    list.scrollTop = 250;
    owner.scrolled();
    const permit = owner.captureScrollIntent();
    await render(false);
    expect(writes.at(-1)).toEqual({ top: 250, behavior: 'instant' });
    writes.length = 0;
    maximum = 900;
    owner.reconcile();
    await render(true);
    expect(writes).toEqual([]);
    expect(list.scrollTop).toBe(250);
    expect(permit()).toBe(false);
  });
  it('keeps the saved legal offset when the covered reading point disappears', async () => {
    await render(true);
    await render(false);
    geometry.exists = false;
    maximum = 900;
    await render(true);
    expect(list.scrollTop).toBe(160);
    expect(writes).toEqual([]);
  });
  it('keeps the exact focused-visit capture dead after same-channel return', async () => {
    await render(true);
    const captured = visit.capture();
    await render(false);
    expect(captured()).toBe(false);
    await render(true);
    expect(captured()).toBe(false);
    expect(visit.capture()()).toBe(true);
  });
});
