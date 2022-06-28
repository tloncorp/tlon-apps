import { ChatMemo } from '../../types/chat';
import { useChatState } from './chat';

// `ChatInput` expects `sendMessage(whom, memo)`, so wrap it within a closure
export default function useSendMultiDm(clubId: string) {
  const { sendMultiDm } = useChatState.getState();
  const makeSender = () => (whom: string, memo: ChatMemo) => {
    sendMultiDm(clubId, whom, memo);
  };
  return makeSender();
}
