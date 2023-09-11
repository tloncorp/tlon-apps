import React, { useEffect, useState } from 'react';
import { useIsMobile } from './useMedia';
import { logTime } from './utils';

type Point = { x: number; y: number };
type Action = 'click' | 'longpress' | '';

interface LongPressOptions {
  withId?: boolean;
}

export default function useLongPress(options?: LongPressOptions) {
  const [action, setAction] = useState<Action>('');
  const [actionId, setActionId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const isLongPress = React.useRef(false);
  const downPoint = React.useRef<Point>({ x: 0, y: 0 });
  const currentPoint = React.useRef<Point>({ x: 0, y: 0 });

  const getActionId = (element: HTMLElement): string | null => {
    if (element.id) {
      return element.id;
    }
    if (element.parentElement) {
      return getActionId(element.parentElement);
    }
    return null;
  };

  const release = (point: Point) => {
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
  };

  const start = (element: HTMLElement) => {
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
  };

  const stop = (point: Point) => {
    logTime('stop', point, isLongPress.current);
    clearTimeout(timerRef.current);
    release(point);
  };

  const onClick = () => {
    if (isLongPress.current) {
      return;
    }
    setAction('click');
  };

  const onMouseDown = (e: React.MouseEvent) => {
    downPoint.current = { x: e.pageX, y: e.pageY };
    currentPoint.current = { x: e.pageX, y: e.pageY };
    start(e.target as HTMLElement);
  };

  const onMouseMove = (e: React.MouseEvent) => {
    currentPoint.current = { x: e.pageX, y: e.pageY };
  };

  const onMouseUp = (e: React.MouseEvent) => {
    stop({ x: e.pageX, y: e.pageY });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    downPoint.current = {
      x: e.changedTouches[0].pageX,
      y: e.changedTouches[0].pageY,
    };
    currentPoint.current = {
      x: e.changedTouches[0].pageX,
      y: e.changedTouches[0].pageY,
    };
    start(e.target as HTMLElement);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    currentPoint.current = {
      x: e.changedTouches[0].pageX,
      y: e.changedTouches[0].pageY,
    };
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    stop({ x: e.changedTouches[0].pageX, y: e.changedTouches[0].pageY });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    logTime('onContextMenu', action, isMobile, isLongPress.current);
    if (isMobile && (action === 'longpress' || isLongPress.current)) {
      e.preventDefault();
    }
  };

  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    },
    []
  );

  return {
    action,
    actionId: options?.withId ? actionId : undefined,
    handlers: {
      onClick,
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onContextMenu,
    },
  };
}
