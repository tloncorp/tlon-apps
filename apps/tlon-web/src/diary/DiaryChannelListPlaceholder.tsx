import { randomElement } from '@/logic/utils';
import cn from 'classnames';
import * as React from 'react';

function DiaryChannelListItemPlaceholder() {
  const background = `bg-gray-${randomElement([100, 200, 400])}`;

  return (
    <div className="flex-col items-center justify-center px-5 sm:px-5">
      <div
        className={cn(
          background,
          'mx-auto my-4 h-48 w-full max-w-[560px] rounded-lg'
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
