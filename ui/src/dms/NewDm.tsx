import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import ob from 'urbit-ob';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { createStorageKey, newUv, preSig } from '@/logic/utils';
import { useChatState } from '@/state/chat';
import createClub from '@/state/chat/createClub';
import useSendMultiDm from '@/state/chat/useSendMultiDm';
import { ChatMemo } from '@/types/chat';
import { Link } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';

export default function NewDM() {
  const [ships, setShips] = useLocalStorage<ShipOption[]>(
    createStorageKey('new-dm-ships'),
    []
  );
  const isMultiDm = ships.length > 1;
  const navigate = useNavigate();
  const shipValues = useMemo(() => ships.map((o) => preSig(o.value)), [ships]);
  const newClubId = useMemo(() => newUv(), []);
  const sendMultiDm = useSendMultiDm(true, shipValues);

  const validShips = useCallback(
    () =>
      Boolean(shipValues.length) &&
      shipValues.every((ship) => ob.isValidPatp(ship)),
    [shipValues]
  );

  const sendDm = useCallback(
    async (whom: string, memo: ChatMemo) => {
      if (isMultiDm) {
        await sendMultiDm(whom, memo);
      } else {
        await useChatState.getState().sendMessage(whom, memo);
      }

      setShips([]);
      navigate(`/dm/${isMultiDm ? whom : preSig(whom)}`);
    },
    [navigate, sendMultiDm, isMultiDm, setShips]
  );

  const onEnter = useCallback(
    async (invites: ShipOption[]) => {
      if (isMultiDm) {
        await createClub(
          newClubId,
          invites.map((s) => s.value)
        );
        navigate(`/dm/${newClubId}`);
      } else {
        navigate(`/dm/${preSig(invites[0].value)}`);
      }
    },
    [newClubId, isMultiDm, navigate]
  );

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-gray-50 p-4">
          <ChatInput
            whom={
              ships && ships.length > 0
                ? ships.length > 1
                  ? newClubId
                  : ships[0].value
                : ''
            }
            showReply
            sendDisabled={!validShips()}
            sendMessage={sendDm}
          />
        </div>
      }
    >
      <div className="flex w-full items-center space-x-2 py-3 px-4">
        <div className="w-full">
          <ShipSelector
            ships={ships}
            setShips={setShips}
            onEnter={onEnter}
            isMulti={true}
          />
        </div>
        <Link className="secondary-button py-2.5" to="/">
          Cancel
        </Link>
      </div>
    </Layout>
  );
}
