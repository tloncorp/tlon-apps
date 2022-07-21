import { whomIsMultiDm } from '../../logic/utils';
import { ChatMemo } from '../../types/chat';
import { useChatState } from './chat';
import createClub from './createClub';

// `ChatInput` expects `sendMessage(whom, memo)`, so wrap it within a closure
export default function useSendMultiDm(newDm?: boolean, ships?: string[]) {
  const { sendMessage } = useChatState.getState();
  const makeSender = () => async (whom: string, memo: ChatMemo) => {
    if (newDm && whomIsMultiDm(whom) && ships) {
      await createClub(whom, ships);
    }
    sendMessage(whom, memo);
  };
  return makeSender();
}
