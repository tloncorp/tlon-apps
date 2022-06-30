import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import ChatInput from '../chat/ChatInput/ChatInput';
import Layout from '../components/Layout/Layout';
import ShipSelector, { Option } from '../components/ShipSelector';
import { newUv } from '../logic/utils';
import { useChatState } from '../state/chat';
import createClub from '../state/chat/createClub';
import useSendMultiDm from '../state/chat/useSendMultiDm';

export default function NewDM() {
  const [ships, setShips] = useState<Option[]>([]);
  const isMultiDm = ships.length > 1;
  const navigate = useNavigate();
  const validShips = ships.every((ship) => ob.isValidPatp(ship.value));
  const newClubId = useMemo(() => newUv(), []);
  const { sendMessage: sendChat } = useChatState.getState();
  const sendMultiDm = useSendMultiDm(newClubId);
  const sendMessage = isMultiDm ? sendMultiDm : sendChat;

  const onEnter = useCallback(
    async (invites: Option[]) => {
      if (isMultiDm) {
        await createClub(
          newClubId,
          invites.map((s) => s.value)
        );
        navigate(`/dm/${newClubId}`);
      } else {
        navigate(`/dm/${invites[0].value}`);
      }
    },
    [newClubId, isMultiDm, navigate]
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
            newDm
            navigate={navigate}
            sendMessage={sendMessage}
            ships={ships.map((o) => o.value)}
          />
        </div>
      }
    >
      <div className="w-full py-3 px-4">
        <ShipSelector ships={ships} setShips={setShips} onEnter={onEnter} />
      </div>
    </Layout>
  );
}
