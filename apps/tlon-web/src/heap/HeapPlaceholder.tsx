import cn from 'classnames';
import * as React from 'react';

import { useIsMobile } from '@/logic/useMedia';
import { randomElement } from '@/logic/utils';

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
          key={i}
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
