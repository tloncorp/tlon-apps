import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/Layout/Layout';
import DMInviteInput, { Option } from '../dms/DMInviteInput';
import { newUw } from '../logic/utils';
import { useChatState } from '../state/chat';
import useSendMultiDm from '../state/chat/useSendMultiDm';

export default function NewDM() {
  const [ships, setShips] = useState<Option[]>([]);
  const isMultiDm = ships.length > 1;
  const navigate = useNavigate();
  const validShips = ships.every((ship) => ob.isValidPatp(ship.value));
  const newClubId = useMemo(() => newUw(), []);
  const { sendMessage: sendChat } = useChatState.getState();
  const sendMultiDm = useSendMultiDm(newClubId);
  const sendMessage = isMultiDm ? sendMultiDm : sendChat;

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
            newDm
            navigate={navigate}
            sendMessage={sendMessage}
            ships={ships.map((o) => o.value)}
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
