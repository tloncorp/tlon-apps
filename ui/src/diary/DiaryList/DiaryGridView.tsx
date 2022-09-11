import React from 'react';
import { Masonry, RenderComponentProps } from 'masonic';
import DiaryGridItem from '@/diary/DiaryList/DiaryGridItem';
import { DiaryNote } from '@/types/diary';

interface DiaryGridProps {
  notes: [bigInt.BigInteger, DiaryNote][];
}

const masonryItem = ({
  data,
}: RenderComponentProps<[bigInt.BigInteger, DiaryNote]>) => (
  <DiaryGridItem time={data[0]} note={data[1]} />
);

export default function DiaryGridView({ notes }: DiaryGridProps) {
  if (notes?.length !== 0) {
    return (
      <div className="h-full p-6">
        <div className="mx-auto h-full max-w-[600px]">
          <Masonry
            columnCount={2}
            columnGutter={16}
            items={notes}
            render={masonryItem}
          />
        </div>
      </div>
    );
  }

  return null;
}
