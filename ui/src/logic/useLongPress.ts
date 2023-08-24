import React, { useEffect, useState } from 'react';
import { useIsMobile } from './useMedia';
import { logTime } from './utils';

type Point = { x: number; y: number };
type Action = 'click' | 'longpress' | '';

export default function useLongPress() {
  const [action, setAction] = useState<Action>('');
  const isMobile = useIsMobile();
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const isLongPress = React.useRef(false);
  const downPoint = React.useRef<Point>({ x: 0, y: 0 });
  const currentPoint = React.useRef<Point>({ x: 0, y: 0 });

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
    }

    isLongPress.current = false;
  };

  const start = () => {
    logTime('start', downPoint.current);
    setAction('');

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
    start();
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
    start();
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
