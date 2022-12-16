import React, {useState, useRef, useCallback, useEffect} from 'react';
import { Masonry, MasonryScroller, RenderComponentProps, useContainerPosition, useInfiniteLoader, useMasonry, usePositioner, useResizeObserver, useScroller } from 'masonic';
import { useElementSize, useWindowSize } from 'usehooks-ts';
import DiaryGridItem from '@/diary/DiaryList/DiaryGridItem';
import { DiaryLetter, DiaryNote } from '@/types/diary';
import { debounce } from 'lodash';

interface DiaryGridProps {
  notes: [bigInt.BigInteger, DiaryLetter][];
  loadOlderNotes: () => Promise<void>
}

const masonryItem = ({
  data,
}: RenderComponentProps<[bigInt.BigInteger, DiaryLetter]>) => (
  <DiaryGridItem time={data[0]} letter={data[1]} />
);

export default function DiaryGridView({ notes, loadOlderNotes }: DiaryGridProps) {
  // const [containerRef, {width, height}] = useElementSize();
  const containerRef = useRef<HTMLDivElement>(null);
  const {width: windowWidth, height: windowHeight} = useWindowSize();
  const {offset, width} = useContainerPosition(containerRef, [windowWidth, windowHeight]);
  const {scrollTop, isScrolling} = useScroller(offset);
  // debugger;
  // console.log(width, height);
  const positioner = usePositioner({
    width: containerRef.current?.offsetWidth,
    columnCount: 2,
    columnGutter: 16
  });
  const resizeObserver = useResizeObserver(positioner);
  console.log({width, offset});
  const maybeLoadMore = useInfiniteLoader((startIndex, stopIndex, currentItems) => {
    console.log(scrollTop);
    if(startIndex > currentItems.length){
      loadOlderNotes();
    }
  }, {isItemLoaded: (index, items) => !!items[index], threshold: 3});
  // const masonryGrid = useMasonry(
  //   {
  //     positioner,
  //     resizeObserver,
  //     items: notes,
  //     windowHeight,
  //     scrollTop,
  //     isScrolling,
  //     overscanBy: 10,
  //     render: masonryItem,
  //     onRender: maybeLoadMore
  //   }
  // );


  if (notes?.length !== 0) {
    return (
      <div className='h-full w-full overflow-y-auto' ref={containerRef}>
        <div className='mx-auto box-border h-full w-full max-w-[600px]'>
          {/* {masonryGrid} */}
          <MasonryScroller
            positioner={positioner}
            // offset={containerRef.current?.offsetTop}
            height={containerRef?.current?.offsetHeight || 0}
            containerRef={containerRef}
            overscanBy={3}
            resizeObserver={resizeObserver}
            render={masonryItem}
            items={notes}
            onRender={maybeLoadMore}
           />
        </div>
      </div>
    );
  }

  return null;
}
