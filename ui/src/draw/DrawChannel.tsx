import React, { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate, useParams } from 'react-router';
import bigInt from 'big-integer';
import { Virtuoso } from 'react-virtuoso';
import Layout from '@/components/Layout/Layout';
import {
  useChannel,
  useGroup,
  useRouteGroup,
  useVessel,
} from '@/state/groups/groups';
import {
  useNotesForDiary,
  useDiaryState,
  useDiaryDisplayMode,
  useDiaryPerms,
} from '@/state/diary';
import {
  DiarySetting,
  setChannelSetting,
  useDiarySettings,
  useDiarySortMode,
  useSettingsState,
} from '@/state/settings';
import ChannelHeader from '@/channels/ChannelHeader';
import { Link } from 'react-router-dom';
import useRecentChannel from '@/logic/useRecentChannel';
import {
  canReadChannel,
  canWriteChannel,
  isChannelJoined,
} from '@/logic/utils';
import useAllBriefs from '@/logic/useAllBriefs';
import { Excalidraw } from '@excalidraw/excalidraw';

function DrawChannel() {
  const [joining, setJoining] = useState(false);
  const { chShip, chName } = useParams();
  const chFlag = `${chShip}/${chName}`;
  const nest = `diary/${chFlag}`;
  const flag = useRouteGroup();
  const vessel = useVessel(flag, window.our);
  const location = useLocation();
  const navigate = useNavigate();
  const { setRecentChannel } = useRecentChannel(flag);
  const group = useGroup(flag);
  const channel = useChannel(flag, nest);
  const briefs = useAllBriefs();
  const joined = Object.keys(briefs).some((k) => k.includes('diary/'))
    ? isChannelJoined(nest, briefs)
    : true;

  const joinChannel = useCallback(async () => {
    setJoining(true);
    await useDiaryState.getState().joinDiary(flag, chFlag);
    setJoining(false);
  }, [flag, chFlag]);

  const initializeChannel = useCallback(async () => {
    await useDiaryState.getState().initialize(chFlag);
  }, [chFlag]);

  useEffect(() => {
    if (channel && !canReadChannel(channel, vessel, group?.bloc)) {
      navigate(`/groups/${flag}`);
      setRecentChannel('');
    }
  }, [flag, group, channel, vessel, navigate, setRecentChannel]);

  const perms = useDiaryPerms(chFlag);

  const canWrite = canWriteChannel(perms, vessel, group?.bloc);
  const canRead = channel
    ? canReadChannel(channel, vessel, group?.bloc)
    : false;

  useEffect(() => {
    if (!joined) {
      joinChannel();
    }
  }, [joined, joinChannel, channel]);

  useEffect(() => {
    if (joined && !joining && channel && canRead) {
      initializeChannel();
      setRecentChannel(nest);
    }
  }, [
    chFlag,
    nest,
    setRecentChannel,
    joined,
    initializeChannel,
    joining,
    briefs,
    channel,
    canRead,
  ]);

  return (
    <Layout
      stickyHeader
      className="flex-1 bg-gray-50"
      aside={<Outlet />}
      header={
        <ChannelHeader flag={flag} nest={nest} showControls>
          {canWrite ? (
            <Link
              to="edit"
              className="button shrink-0 bg-blue text-white dark:text-black"
            >
              Add Note
            </Link>
          ) : null}
        </ChannelHeader>
      }
    >
      <Excalidraw />
    </Layout>
  );
}

export default DrawChannel;
