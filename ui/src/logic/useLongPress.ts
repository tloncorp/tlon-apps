import React, { useEffect, useState } from 'react';

export default function useLongPress(waitForUpEvent = false) {
  const [action, setAction] = useState('');
  const timerRef = React.useRef<ReturnType<typeof setTimeout>>();
  const isLongPress = React.useRef(false);
  const downPoint = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const start = () => {
    setAction('');

    timerRef.current = setTimeout(() => {
      isLongPress.current = true;
      if (!waitForUpEvent) {
        setAction('longpress');
      }
    }, 300);
  };

  const stop = (point: { x: number; y: number }) => {
    clearTimeout(timerRef.current);

    if (
      waitForUpEvent &&
      isLongPress.current &&
      Math.abs(point.x - downPoint.current.x) < 10 &&
      Math.abs(point.y - downPoint.current.y) < 10
    ) {
      setAction('longpress');
    } else {
      setAction('');
    }

    isLongPress.current = false;
  };

  const onClick = () => {
    if (isLongPress.current) {
      return;
    }
    setAction('click');
  };

  const onMouseDown = (e: React.MouseEvent) => {
    downPoint.current = { x: e.pageX, y: e.pageY };
    start();
  };

  const onMouseUp = (e: React.MouseEvent) => {
    stop({ x: e.pageX, y: e.pageY });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    downPoint.current = {
      x: e.changedTouches[0].pageX,
      y: e.changedTouches[0].pageY,
    };
    start();
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    stop({ x: e.changedTouches[0].pageX, y: e.changedTouches[0].pageY });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
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
      onMouseUp,
      onTouchStart,
      onTouchEnd,
      onContextMenu,
    },
  };
}
