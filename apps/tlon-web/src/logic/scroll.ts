import { throttle } from 'lodash';
import { RefObject, useCallback, useEffect, useRef, useState } from 'react';

import useIsEditingMessage from './useIsEditingMessage';

/**
 * Utility for tracking scrolling state. Caller should call `didScroll` whenever
 * a scroll event occurs.
 */
export function useIsScrolling(
  scrollElementRef: RefObject<HTMLElement>,
  options: {
    checkInterval: number;
    scrollStopDelay: number;
  } = {
    checkInterval: 200,
    scrollStopDelay: 200,
  }
) {
  const { checkInterval, scrollStopDelay } = options;
  const [isScrolling, setIsScrolling] = useState(false);
  const lastScrollTime = useRef(0);

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!el) return undefined;

    const handleScroll = throttle(() => {
      lastScrollTime.current = performance.now();
      setIsScrolling(true);
    }, 50);
    el.addEventListener('scroll', handleScroll, { passive: true });
    return () => el.removeEventListener('scroll', handleScroll);
  });

  // This performs a bit better than setting and clearing a million
  // setTimeouts, even debounced, but in the worst case takes 2 * checkInterval
  useEffect(() => {
    if (!isScrolling) return undefined;

    const interval = setInterval(() => {
      const delta = performance.now() - lastScrollTime.current;
      setIsScrolling(delta < scrollStopDelay);
    }, checkInterval);

    return () => clearInterval(interval);
  }, [isScrolling, checkInterval, scrollStopDelay]);
  return isScrolling;
}

/**
 * Invert mousewheel scroll so that it works properly on the inverted list. We
 * need to use `useEffect` here because we're preventing default, which we can't do
 * inside passive event listeners, which React uses in prop events by default.
 */
export function useInvertedScrollInteraction(
  scrollElementRef: RefObject<HTMLDivElement>,
  isInverted: boolean
) {
  const isEditing = useIsEditingMessage();
  const isEditingRef = useRef(isEditing);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    const el = scrollElementRef.current;
    if (!isInverted || !el) return undefined;

    const invertScrollWheel = (e: WheelEvent) => {
      el.scrollTop -= e.deltaY;
      e.preventDefault();
    };
    const invertSpaceAndArrows = (e: KeyboardEvent) => {
      if (isEditingRef.current) return;

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        el.scrollBy({ top: 30, behavior: e.repeat ? 'auto' : 'smooth' });
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        el.scrollBy({ top: -30, behavior: e.repeat ? 'auto' : 'smooth' });
      } else if (e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        el.scrollBy({
          top: el.clientHeight * (e.shiftKey ? 1 : -1),
          behavior: 'auto',
        });
      }
    };

    el.addEventListener('wheel', invertScrollWheel, false);
    el.addEventListener('keydown', invertSpaceAndArrows, true);

    return () => {
      el.removeEventListener('wheel', invertScrollWheel);
      el.removeEventListener('keydown', invertSpaceAndArrows);
    };
  }, [isInverted, scrollElementRef, isEditing]);
}

/**
 * Tracks whether a user has manually scrolled the given element.
 */
export function useUserHasScrolled(scrollElementRef: RefObject<HTMLElement>) {
  const [userHasScrolled, setUserHasScrolled] = useState(false);

  useEffect(() => {
    if (userHasScrolled) return undefined;
    const el = scrollElementRef.current;
    const triggerEvents = ['mousedown', 'touchmove', 'wheel', 'keydown'];
    const listenerOptions = { capture: true, passive: true };
    function handleInteraction() {
      setUserHasScrolled(true);
      triggerEvents.forEach((eventName) =>
        el?.removeEventListener(eventName, handleInteraction, listenerOptions)
      );
    }
    triggerEvents.forEach((eventName) => {
      el?.addEventListener(eventName, handleInteraction, listenerOptions);
    });
    return () => {
      triggerEvents.forEach((eventName) =>
        el?.removeEventListener(eventName, handleInteraction, listenerOptions)
      );
    };
  }, [scrollElementRef, userHasScrolled]);

  const resetUserHasScrolled = useCallback(() => {
    setUserHasScrolled(false);
  }, []);

  return { userHasScrolled, resetUserHasScrolled };
}
