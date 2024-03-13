import { Post, PostTuple } from '@tloncorp/shared/dist/urbit/channel';
import {
  RenderComponentProps,
  useInfiniteLoader,
  useMasonry,
  usePositioner,
  useResizeObserver,
} from 'masonic';
import React, { useRef } from 'react';

import DiaryGridItem from '@/diary/DiaryList/DiaryGridItem';
import { useIsMobile } from '@/logic/useMedia';

interface DiaryGridProps {
  outlines: PostTuple[];
  loadOlderNotes: (atBottom: boolean) => void;
}

const masonryItem = ({ data }: RenderComponentProps<PostTuple>) => (
  <DiaryGridItem time={data[0]} note={data[1]!} />
);

export default function DiaryGridView({
  outlines,
  loadOlderNotes,
}: DiaryGridProps) {
  const isMobile = useIsMobile();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const maybeLoadMore = useInfiniteLoader(
    () => {
      loadOlderNotes(true);
    },
    { isItemLoaded: (index, items) => !!items[index], threshold: 3 }
  );

  const positioner = usePositioner(
    {
      columnCount: isMobile ? 1 : 2,
      width: gridContainerRef.current?.offsetWidth || 600,
      columnGutter: 16,
    },
    [outlines.length]
  );
  const height = scrollContainerRef.current?.offsetHeight || window.innerHeight;
  const resizeObserver = useResizeObserver(positioner);
  const scrollTop = scrollContainerRef.current?.scrollTop || 0;

  const masonryGrid = useMasonry({
    positioner,
    resizeObserver,
    containerRef: scrollContainerRef,
    overscanBy: 10,
    render: masonryItem,
    items: outlines,
    onRender: maybeLoadMore,
    height,
    itemHeightEstimate: 220,
    scrollTop,
  });

  if (outlines?.length !== 0) {
    return (
      <div
        className="h-full w-full overflow-y-auto px-4 py-8"
        ref={scrollContainerRef}
      >
        <div
          className="mx-auto box-border w-full max-w-[600px]"
          ref={gridContainerRef}
        >
          {masonryGrid}
        </div>
      </div>
    );
  }

  return null;
}
