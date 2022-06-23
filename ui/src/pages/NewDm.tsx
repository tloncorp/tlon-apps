import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/Layout/Layout';
import DMInviteInput, { Option } from '../dms/DMInviteInput';
import { useChatState } from '../state/chat';

export default function NewDM() {
  const [ships, setShips] = useState<Option[]>([]);
  const isMultiDm = ships.length > 1;
  const navigate = useNavigate();
  const validShips = ships.every((ship) => ob.isValidPatp(ship.value));

  const { sendMessage: sendChat } = useChatState.getState();
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const sendMultiDm = () => {}; // TODO: is no-op okay? since it will be navigated away anyways
  const sendMessage = isMultiDm ? sendMultiDm : sendChat;

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-black/10 p-4">
          <ChatInput
            whom={ships && ships.length > 0 ? ships[0].value : ''}
            showReply
            sendDisabled={!validShips}
            newDm
            navigate={navigate}
            sendMessage={sendMessage}
          />
        </div>
      }
    >
      <div className="w-full py-3 px-4">
        <DMInviteInput ships={ships} setShips={setShips} />
      </div>
    </Layout>
  );
}
