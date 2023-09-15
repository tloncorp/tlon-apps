import { BigInteger } from 'big-integer';
import { ReactNode } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import BTree from 'sorted-btree';
import { Note } from '@/types/channel';

export interface IChatScroller {
  whom: string;
  messages: BTree<BigInteger, Note>;
  replying?: boolean;
  prefixedElement?: ReactNode;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
}
