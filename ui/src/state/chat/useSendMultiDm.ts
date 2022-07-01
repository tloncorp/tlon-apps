import { whomIsMultiDm } from '../../logic/utils';
import { ChatMemo } from '../../types/chat';
import { useChatState } from './chat';
import createClub from './createClub';

// `ChatInput` expects `sendMessage(whom, memo)`, so wrap it within a closure
export default function useSendMultiDm(newDm?: boolean, ships?: string[]) {
  const { sendMultiDm } = useChatState.getState();
  const makeSender = () => async (whom: string, memo: ChatMemo) => {
    if (newDm && whomIsMultiDm(whom) && ships) {
      await createClub(whom, ships);
    }
    sendMultiDm(whom, memo);
  };
  return makeSender();
}
