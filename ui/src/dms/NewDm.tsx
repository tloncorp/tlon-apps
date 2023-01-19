import _ from 'lodash';
import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import { Link } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';
import ob from 'urbit-ob';
import ChatInput from '@/chat/ChatInput/ChatInput';
import Layout from '@/components/Layout/Layout';
import ShipSelector, { ShipOption } from '@/components/ShipSelector';
import { createStorageKey, newUv, preSig } from '@/logic/utils';
import { useChatState, useMultiDms } from '@/state/chat';
import createClub from '@/state/chat/createClub';
import { ChatMemo } from '@/types/chat';

export default function NewDM() {
  const multiDms = useMultiDms();
  const [ships, setShips] = useLocalStorage<ShipOption[]>(
    createStorageKey('new-dm-ships'),
    []
  );
  const isMultiDm = ships.length > 1;
  const navigate = useNavigate();
  const shipValues = useMemo(() => ships.map((o) => preSig(o.value)), [ships]);
  const newClubId = useMemo(() => newUv(), []);

  const existingDM = useMemo(() => {
    if (ships.length !== 1) {
      return null;
    }

    const { briefs: chatBriefs } = useChatState.getState();
    return (
      Object.entries(chatBriefs).find(([flag, _brief]) => {
        const theShip = preSig(ships[0].value);
        const sameDM = theShip === flag;
        return sameDM;
      })?.[0] ?? null
    );
  }, [ships]);
  const existingMultiDm = useMemo(() => {
    const { briefs } = useChatState.getState();
    return Object.entries(multiDms).reduce<string>((key, [k, v]) => {
      const theShips = [...v.hive, ...v.team];
      const sameDM =
        _.difference(shipValues, theShips).length === 0 &&
        shipValues.length === theShips.length;
      const brief = briefs[key];
      const newBrief = briefs[k];
      const newer = !brief || (brief && newBrief && newBrief.last > brief.last);
      if (sameDM && newer) {
        return k;
      }

      return key;
    }, '');
  }, [multiDms, shipValues]);
  const who =
    ships.length > 0
      ? isMultiDm
        ? existingMultiDm || newClubId
        : ships[0].value
      : '';

  const validShips = useCallback(
    () =>
      Boolean(shipValues.length) &&
      shipValues.every((ship) => ob.isValidPatp(ship)),
    [shipValues]
  );

  const sendDm = useCallback(
    async (whom: string, memo: ChatMemo) => {
      if (isMultiDm && shipValues && whom !== existingMultiDm) {
        await createClub(whom, shipValues);
      }

      await useChatState.getState().sendMessage(whom, memo);
      setShips([]);
      navigate(`/dm/${isMultiDm ? whom : preSig(whom)}`);
    },
    [isMultiDm, shipValues, existingMultiDm, setShips, navigate]
  );

  const onEnter = useCallback(
    async (invites: ShipOption[]) => {
      if (existingMultiDm) {
        navigate(`/dm/${existingMultiDm}`);
      } else if (isMultiDm) {
        await createClub(
          newClubId,
          invites.map((s) => s.value)
        );
        navigate(`/dm/${newClubId}`);
      } else {
        navigate(`/dm/${preSig(invites[0].value)}`);
      }

      setShips([]);
    },
    [newClubId, isMultiDm, existingMultiDm, navigate, setShips]
  );

  const navigateExistingDM = useCallback(() => {
    if (!existingDM) {
      return;
    }
    navigate(`/dm/${preSig(existingDM)}`);
    setShips([]);
  }, [existingDM, navigate, setShips]);

  return (
    <Layout
      className="flex-1"
      footer={
        <div className="border-t-2 border-gray-50 p-4">
          <ChatInput
            whom={who}
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
        {existingDM ? (
          <button
            className="secondary-button w-32 bg-blue py-2.5"
            onClick={navigateExistingDM}
          >
            Go to DM
          </button>
        ) : null}
      </div>
    </Layout>
  );
}
