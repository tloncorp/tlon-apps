import { randomElement } from '@/logic/utils';
import cn from 'classnames';
import * as React from 'react';

function ChatItemPlaceholder() {
  const background = `bg-gray-${randomElement([100, 200, 400])}`;

  return (
    <div className="flex w-full flex-col rounded-lg">
      <div className="flex w-full flex-1 space-x-3 rounded-lg p-2">
        <div className="flex h-6 w-6 justify-center rounded-md bg-gray-100 text-sm" />
        <div className="flex h-6 w-24 justify-center rounded-md bg-gray-100 text-sm" />
      </div>
      <div className="flex w-full flex-1 space-x-3 rounded-lg p-2">
        <div className={cn(background, 'h-12 w-full rounded-md')} />
      </div>
    </div>
  );
}

interface ChatScrollerPlaceholderProps {
  count: number;
}

function ChatScrollerPlaceholder({ count }: ChatScrollerPlaceholderProps) {
  return (
    <div className="flex h-full w-full animate-pulse flex-col justify-end space-y-3 p-2 sm:space-y-0">
      {new Array(count).fill(true).map((_, i) => (
        <ChatItemPlaceholder key={i} />
      ))}
    </div>
  );
}

export default React.memo(ChatScrollerPlaceholder);
