import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/Layout/Layout';
import DMInviteInput, { Option } from '../dms/DMInviteInput';
import { newUv } from '../logic/utils';
import { useChatState } from '../state/chat';
import useSendMultiDm from '../state/chat/useSendMultiDm';
import { ChatMemo } from '../types/chat';

export default function NewDM() {
  const [ships, setShips] = useState<Option[]>([]);
  const isMultiDm = ships.length > 1;
  const navigate = useNavigate();
  const shipValues = useMemo(() => ships.map((o) => o.value), [ships]);
  const validShips = shipValues.every((ship) => ob.isValidPatp(ship));
  const newClubId = useMemo(() => newUv(), []);
  const { sendMessage: sendChat } = useChatState.getState();
  const sendMultiDm = useSendMultiDm(true, shipValues);
  const sendDm = useCallback(
    (whom: string, memo: ChatMemo) => {
      sendChat(whom, memo);

      navigate(`/dm/${whom}`);
    },
    [navigate, sendChat]
  );

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-black/10 p-4">
          <ChatInput
            whom={
              ships && ships.length > 0
                ? ships.length > 1
                  ? newClubId
                  : ships[0].value
                : ''
            }
            showReply
            sendDisabled={!validShips}
            sendMessage={isMultiDm ? sendMultiDm : sendDm}
          />
        </div>
      }
    >
      <div className="w-full py-3 px-4">
        <DMInviteInput ships={ships} setShips={setShips} clubId={newClubId} />
      </div>
    </Layout>
  );
}
