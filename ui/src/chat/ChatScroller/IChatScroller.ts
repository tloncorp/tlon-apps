import { BigInteger } from 'big-integer';
import { ReactNode } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import BTree from 'sorted-btree';
import { ChatWrit } from '../../types/chat';

export interface IChatScroller {
  whom: string;
  messages: BTree<BigInteger, ChatWrit>;
  replying?: boolean;
  prefixedElement?: ReactNode;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
  scrollElementRef: React.RefObject<HTMLDivElement>;
  isScrolling: boolean;
}
