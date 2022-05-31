import { BigIntOrderedMap } from '@urbit/api';
import { ReactElement } from 'react';
import { ChatWrit } from '../../types/chat';

export interface IChatScroller {
  whom: string;
  messages: BigIntOrderedMap<ChatWrit>;
  replying?: boolean;
  prefixedElement?: ReactElement;
}
