import { ReactNode, useRef } from 'react';

import { BucketFileNavigation } from './BucketFileViewer.shared';

export function BucketFilePager({
  children,
  navigation,
}: {
  children: ReactNode;
  navigation?: BucketFileNavigation;
}) {
  const touch = useRef<{ x: number; y: number } | null>(null);
  const move = (direction: number) => {
    if (!navigation) return;
    const index = navigation.index + direction;
    if (index >= 0 && index < navigation.items.length)
      navigation.onSelect(index);
  };
  const isControl = (target: EventTarget | null) =>
    target instanceof Element &&
    target.closest('audio,video,button,input,textarea,select,[role="button"]');
  return (
    <div
      role="region"
      aria-label="File preview"
      tabIndex={0}
      style={{ display: 'flex', flex: 1, minHeight: 0, outline: 'none' }}
      onKeyDown={(event) => {
        if (
          isControl(event.target) ||
          event.altKey ||
          event.ctrlKey ||
          event.metaKey ||
          event.shiftKey
        )
          return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          move(event.key === 'ArrowLeft' ? -1 : 1);
        }
      }}
      onTouchStart={(event) => {
        const first = event.touches[0];
        touch.current =
          !isControl(event.target) && event.touches.length === 1
            ? { x: first.clientX, y: first.clientY }
            : null;
      }}
      onTouchCancel={() => {
        touch.current = null;
      }}
      onTouchEnd={(event) => {
        const start = touch.current;
        touch.current = null;
        if (!start) return;
        const end = event.changedTouches[0];
        const dx = end.clientX - start.x;
        if (
          Math.abs(dx) > 60 &&
          Math.abs(dx) > Math.abs(end.clientY - start.y) * 2
        )
          move(dx < 0 ? 1 : -1);
      }}
    >
      {children}
    </div>
  );
}
