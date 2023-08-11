import * as React from 'react';
import cn from 'classnames';
import { randomElement } from '@/logic/utils';

// TODO: fix layout

function HeapPlaceholderItem() {
  const background = `bg-gray-${randomElement([100, 200, 400])}`;

  return (
    <div className={cn(background, 'mx-8 h-[300px] w-[300px] rounded-lg')} />
  );
}

interface ChatScrollerPlaceholderProps {
  count: number;
}

function ChatScrollerPlaceholder({ count }: ChatScrollerPlaceholderProps) {
  return (
    <div className="flex h-full w-full animate-pulse flex-col flex-wrap justify-evenly overflow-hidden p-2">
      {new Array(count).fill(true).map((_, i) => (
        <HeapPlaceholderItem key={i} />
      ))}
    </div>
  );
}

export default React.memo(ChatScrollerPlaceholder);
