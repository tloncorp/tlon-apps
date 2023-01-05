import React, { useRef } from 'react';
import {
  RenderComponentProps,
  useInfiniteLoader,
  useMasonry,
  usePositioner,
  useResizeObserver,
} from 'masonic';
import DiaryGridItem from '@/diary/DiaryList/DiaryGridItem';
import { DiaryLetter } from '@/types/diary';

interface DiaryGridProps {
  notes: [bigInt.BigInteger, DiaryLetter][];
  loadOlderNotes: () => Promise<void>;
}

const masonryItem = ({
  data,
}: RenderComponentProps<[bigInt.BigInteger, DiaryLetter]>) => (
  <DiaryGridItem time={data[0]} letter={data[1]} />
);

export default function DiaryGridView({
  notes,
  loadOlderNotes,
}: DiaryGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const maybeLoadMore = useInfiniteLoader(
    () => {
      loadOlderNotes();
    },
    { isItemLoaded: (index, items) => !!items[index], threshold: 3 }
  );

  const positioner = usePositioner(
    {
      columnCount: 2,
      width: gridContainerRef.current?.offsetWidth || 600,
      columnGutter: 16,
    },
    [notes.length]
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
    items: notes,
    onRender: maybeLoadMore,
    height,
    itemHeightEstimate: 220,
    scrollTop,
  });

  if (notes?.length !== 0) {
    return (
      <div
        className="h-full w-full overflow-y-auto py-8"
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
