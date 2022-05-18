import { BigIntOrderedMap } from '@urbit/api';
import { ChatReplying } from '../useChatStore';
import { ChatWrit } from '../../types/chat';

export interface IChatScroller {
  chat?: ChatReplying;
  messages: BigIntOrderedMap<ChatWrit>;
  replying?: string | null;
}
