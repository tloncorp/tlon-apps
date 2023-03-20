import * as React from 'react';
import cn from 'classnames';
import { randomElement } from '@/logic/utils';

function DiaryChannelListItemPlaceholder() {
  const background = `bg-gray-${randomElement([100, 200, 400])}`;

  return (
    <div className="flex-col items-center justify-center">
      <div
        className={cn(
          background,
          'my-4 mx-auto h-[248px] min-w-[400px] max-w-[600px] rounded-md'
        )}
      />
    </div>
  );
}

interface DiaryChannelListPlaceholderProps {
  count: number;
}

function DiaryChannelListPlaceholder({
  count,
}: DiaryChannelListPlaceholderProps) {
  return (
    <div className="flex h-full w-full animate-pulse flex-col space-y-3 p-2 sm:space-y-0">
      {new Array(count).fill(true).map((_, i) => (
        <DiaryChannelListItemPlaceholder key={i} />
      ))}
    </div>
  );
}

export default React.memo(DiaryChannelListPlaceholder);
