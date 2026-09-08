import { RefObject, useLayoutEffect, useRef } from 'react';

import {
  captureWebReadingPoints,
  isWebScrollSurfaceVisible,
} from './webReadingAnchor';
import { WebScrollCoordinator } from './webScrollCoordinator';

/** Control-modified wheel events represent browser zoom, including trackpad pinch. */
export function listScrollWheelDirection(
  event: Pick<
    WheelEvent,
    'isTrusted' | 'defaultPrevented' | 'ctrlKey' | 'deltaY'
  >
) {
  if (
    !event.isTrusted ||
    event.defaultPrevented ||
    event.ctrlKey ||
    event.deltaY === 0
  )
    return null;
  return Math.sign(event.deltaY);
}

export function listScrollKeyDirection(
  event: Pick<
    KeyboardEvent,
    | 'key'
    | 'shiftKey'
    | 'altKey'
    | 'ctrlKey'
    | 'metaKey'
    | 'defaultPrevented'
    | 'target'
  >
) {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey)
    return null;
  const target = event.target;
  if (
    target instanceof Element &&
    target.closest(
      'input,textarea,select,button,a,[contenteditable="true"],[role="textbox"],[role="button"]'
    )
  )
    return null;
  if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) return -1;
  if (['ArrowDown', 'PageDown', 'End'].includes(event.key)) return 1;
  if (event.key === ' ') return event.shiftKey ? -1 : 1;
  return null;
}

export function useWebScrollCoordinator({
  scrollerRef,
  contentRef,
  scope,
  anchorToEnd,
  followBlocked,
  onScrollIntentChanged,
  isFocused = true,
}: {
  scrollerRef: RefObject<HTMLDivElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  scope: string;
  anchorToEnd: boolean;
  followBlocked: boolean;
  onScrollIntentChanged?: () => void;
  isFocused?: boolean;
}) {
  const coordinatorRef = useRef<WebScrollCoordinator | null>(null);
  const intentChanged = useRef(onScrollIntentChanged);
  useLayoutEffect(() => {
    intentChanged.current = onScrollIntentChanged;
  });
  useLayoutEffect(() => {
    const list = scrollerRef.current;
    const content = contentRef.current;
    if (!list || !content) return;
    const coordinator = new WebScrollCoordinator({
      offset: () => list.scrollTop,
      maximum: () => Math.max(0, list.scrollHeight - list.clientHeight),
      write: (top, animated) =>
        list.scrollTo({ top, behavior: animated ? 'smooth' : 'instant' }),
      capture: () => captureWebReadingPoints(list, content),
      visible: () => isWebScrollSurfaceVisible(list),
      onIntentChanged: () => intentChanged.current?.(),
    });
    coordinatorRef.current = coordinator;
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    let userGesture = false;
    let scrollbarHeld = false;
    let observed = new Set<Element>();
    const updateObserved = () => {
      const next = new Set(coordinator.observedElements);
      for (const element of observed)
        if (!next.has(element) && element !== list && element !== content)
          resize.unobserve(element);
      for (const element of next)
        if (!observed.has(element)) resize.observe(element);
      observed = next;
    };
    const reconcile = () => {
      coordinator.reconcile();
      updateObserved();
    };
    const resize = new ResizeObserver(reconcile);
    resize.observe(list);
    resize.observe(content);
    const mutation = new MutationObserver(reconcile);
    // Local DOM changes can move an interior point while total height stays
    // unchanged. Observe this conversation, never the whole document.
    mutation.observe(content, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'hidden'],
    });
    const visibility = new MutationObserver(() =>
      coordinator.visibilityChanged()
    );
    for (let node = list.parentElement; node; node = node.parentElement) {
      visibility.observe(node, {
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'aria-hidden'],
      });
    }
    const armInputEnd = () => {
      if (idleTimer) clearTimeout(idleTimer);
      if (!scrollbarHeld)
        idleTimer = setTimeout(() => {
          userGesture = false;
          coordinator.endUserInput();
        }, 150);
    };
    const userInput = (direction: number) => {
      userGesture = true;
      coordinator.userInput(direction);
      updateObserved();
      armInputEnd();
    };
    const wheel = (event: WheelEvent) => {
      const direction = listScrollWheelDirection(event);
      if (direction !== null) userInput(direction);
    };
    const key = (event: KeyboardEvent) => {
      if (!event.isTrusted) return;
      const direction = listScrollKeyDirection(event);
      if (direction !== null) userInput(direction);
    };
    const pointer = (event: PointerEvent) => {
      // A scrollbar pointer may cancel a target before its first scroll event.
      // Ordinary clicks on message text do not disable end maintenance.
      if (event.isTrusted && event.target === list) {
        scrollbarHeld = true;
        userInput(0);
      }
    };
    const pointerUp = () => {
      if (!scrollbarHeld) return;
      scrollbarHeld = false;
      armInputEnd();
    };
    const scroll = () => {
      coordinator.scrolled();
      updateObserved();
      if (userGesture) armInputEnd();
    };
    const visible = () => coordinator.visibilityChanged();
    list.addEventListener('wheel', wheel, { passive: true });
    list.addEventListener('keydown', key);
    list.addEventListener('pointerdown', pointer);
    list.addEventListener('scroll', scroll, { passive: true });
    list.ownerDocument.addEventListener('visibilitychange', visible);
    list.ownerDocument.addEventListener('pointerup', pointerUp);
    list.ownerDocument.addEventListener('pointercancel', pointerUp);
    return () => {
      coordinator.dispose();
      if (idleTimer) clearTimeout(idleTimer);
      resize.disconnect();
      mutation.disconnect();
      visibility.disconnect();
      list.removeEventListener('wheel', wheel);
      list.removeEventListener('keydown', key);
      list.removeEventListener('pointerdown', pointer);
      list.removeEventListener('scroll', scroll);
      list.ownerDocument.removeEventListener('visibilitychange', visible);
      list.ownerDocument.removeEventListener('pointerup', pointerUp);
      list.ownerDocument.removeEventListener('pointercancel', pointerUp);
      if (coordinatorRef.current === coordinator) coordinatorRef.current = null;
    };
  }, [contentRef, scrollerRef]);

  // A React layout commit and an asynchronous image/reference layout use the
  // same owner. No effect-driven identity hash delays end maintenance a render.
  useLayoutEffect(() => {
    coordinatorRef.current?.configure(scope, anchorToEnd, followBlocked);
    coordinatorRef.current?.setFocused(isFocused);
    coordinatorRef.current?.reconcile();
  });
  return coordinatorRef;
}
