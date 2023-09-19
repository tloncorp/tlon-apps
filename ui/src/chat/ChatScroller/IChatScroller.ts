import { BigInteger } from 'big-integer';
import { ReactNode } from 'react';
import { VirtuosoHandle } from 'react-virtuoso';
import { NoteTuple } from '@/types/channel';

export interface IChatScroller {
  whom: string;
  messages: NoteTuple[];
  replying?: boolean;
  prefixedElement?: ReactNode;
  scrollTo?: BigInteger;
  scrollerRef: React.RefObject<VirtuosoHandle>;
  atBottomStateChange: (atBottom: boolean) => void;
  atTopStateChange: (atTop: boolean) => void;
}
