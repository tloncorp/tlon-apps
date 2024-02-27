import React from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import BTree from 'sorted-btree';
import { describe, expect, it } from 'vitest';

import { render } from '../../../test/utils';
import ChatScroller from './ChatScroller';

describe('ChatScroller', () => {
  it('can render an empty list', () => {
    const ref = React.createRef<VirtuosoHandle>();
    const scrollRef = React.createRef<HTMLDivElement>();
    const result = render(
      <ChatScroller
        messages={[]}
        isLoadingOlder={false}
        isLoadingNewer={false}
        whom={'test'}
        scrollerRef={ref}
        scrollElementRef={scrollRef}
        isScrolling={false}
        hasLoadedNewest={false}
        hasLoadedOldest={false}
      />
    );
    expect(result.container.firstChild).toHaveClass('h-full');
  });
});
