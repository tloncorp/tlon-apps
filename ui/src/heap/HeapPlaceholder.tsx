import * as React from 'react';
import cn from 'classnames';
import { randomElement } from '@/logic/utils';
import { useIsMobile } from '@/logic/useMedia';

interface ChatScrollerPlaceholderProps {
  count: number;
}

function ChatScrollerPlaceholder({ count }: ChatScrollerPlaceholderProps) {
  const isMobile = useIsMobile();
  const getShade = (i: number) => (i % 3 === 2 ? 100 : i % 3 === 1 ? 200 : 400);

  return (
    <div
      className={cn(
        isMobile ? 'heap-grid-mobile' : 'heap-grid',
        'h-full w-full animate-pulse'
      )}
    >
      {new Array(count).fill(true).map((_, i) => (
        <div
          className={cn(
            `bg-gray-${getShade(i)}`,
            'rounded-lg',
            isMobile ? 'min-h-[165px]' : 'min-h-[270px]'
          )}
        />
      ))}
    </div>
  );
}

export default React.memo(ChatScrollerPlaceholder);
