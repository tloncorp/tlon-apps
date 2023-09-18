import { BigInteger } from 'big-integer';
import { ReactNode } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import BTree from 'sorted-btree';
import { Note, Quip } from '@/types/channel';

export interface IQuipScroller {
  whom: string;
  messages: BTree<BigInteger, Quip>;
  parentNote: Note;
  prefixedElement?: ReactNode;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
}
