import { BigInteger } from 'big-integer';
import { ReactNode } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import BTree from 'sorted-btree';
import { Quip } from '@/types/channel';

export interface IQuipScroller {
  whom: string;
  messages: BTree<BigInteger, Quip>;
  replying?: boolean;
  prefixedElement?: ReactNode;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
}
