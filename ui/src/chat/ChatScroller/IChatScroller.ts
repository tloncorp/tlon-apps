import { BigIntOrderedMap } from '@urbit/api';
import { BigInteger } from 'big-integer';
import { ReactNode } from 'react';
import { ChatWrit } from '../../types/chat';

export interface IChatScroller {
  whom: string;
  messages: BigIntOrderedMap<ChatWrit>;
  replying?: boolean;
  prefixedElement?: ReactNode;
  scrollTo?: BigInteger;
}
