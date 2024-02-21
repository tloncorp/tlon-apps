import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useIsMobile } from './useMedia';
import { logTime } from './utils';

type Point = { x: number; y: number };
type Action = 'click' | 'longpress' | '';

interface LongPressOptions {
  withId?: boolean;
}

const getActionId = (element: HTMLElement): string | null => {
  if (element.id) {
    return element.id;
  }
  if (element.parentElement) {
    return getActionId(element.parentElement);
  }
  return null;
};

export default function useLongPress(options?: LongPressOptions) {
  const [action, setAction] = useState<Action>('');
  const [actionId, setActionId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const isLongPress = React.useRef(false);
  const downPoint = React.useRef<Point>({ x: 0, y: 0 });
  const currentPoint = React.useRef<Point>({ x: 0, y: 0 });

  const release = useCallback((point: Point) => {
    if (
      isLongPress.current &&
      Math.abs(point.x - downPoint.current.x) < 10 &&
      Math.abs(point.y - downPoint.current.y) < 10
    ) {
      logTime('release', point, downPoint.current);
      setAction('longpress');
    } else {
      logTime('release without longpress', point, downPoint.current);
      setAction('');
      setActionId(null);
    }

    isLongPress.current = false;
  }, []);

  const start = useCallback(
    (element: HTMLElement) => {
      logTime('start', downPoint.current);
      setAction('');
      setActionId(null);

      if (options?.withId) {
        setActionId(getActionId(element));
      }

      timerRef.current = setTimeout(() => {
        isLongPress.current = true;
        release(currentPoint.current);
      }, 300);
    },
    [options?.withId, release]
  );

  const stop = useCallback(
    (point: Point) => {
      logTime('stop', point, isLongPress.current);
      clearTimeout(timerRef.current);
      release(point);
    },
    [release]
  );

  const onClick = useCallback(() => {
    if (isLongPress.current) {
      return;
    }
    setAction('click');
  }, []);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      downPoint.current = { x: e.pageX, y: e.pageY };
      currentPoint.current = { x: e.pageX, y: e.pageY };
      start(e.target as HTMLElement);
    },
    [start]
  );

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    currentPoint.current = { x: e.pageX, y: e.pageY };
  }, []);

  const onMouseUp = useCallback(
    (e: React.MouseEvent) => {
      stop({ x: e.pageX, y: e.pageY });
    },
    [stop]
  );

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      downPoint.current = {
        x: e.changedTouches[0].pageX,
        y: e.changedTouches[0].pageY,
      };
      currentPoint.current = {
        x: e.changedTouches[0].pageX,
        y: e.changedTouches[0].pageY,
      };
      start(e.target as HTMLElement);
    },
    [start]
  );

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    currentPoint.current = {
      x: e.changedTouches[0].pageX,
      y: e.changedTouches[0].pageY,
    };
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      stop({ x: e.changedTouches[0].pageX, y: e.changedTouches[0].pageY });
    },
    [stop]
  );

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      logTime('onContextMenu', action, isMobile, isLongPress.current);
      if (isMobile && (action === 'longpress' || isLongPress.current)) {
        e.preventDefault();
      }
    },
    [action, isMobile]
  );

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    },
    []
  );

  const handlers = useMemo(
    () => ({
      onClick,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onContextMenu,
    }),
    [
      onClick,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onContextMenu,
    ]
  );

  return {
    action,
    actionId: options?.withId ? actionId : undefined,
    handlers,
  };
}
