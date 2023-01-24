import React, { useEffect } from 'react';
import { Outlet, useMatch, useNavigate } from 'react-router';
import {
  useGang,
  useGroup,
  useGroupsInitialized,
  useGroupState,
  useRouteGroup,
  useVessel,
} from '@/state/groups/groups';
import api from '@/api';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import { useIsMobile } from '@/logic/useMedia';
import useRecentChannel from '@/logic/useRecentChannel';
import _ from 'lodash';
import { canReadChannel } from '@/logic/utils';

function Groups() {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const initialized = useGroupsInitialized();
  const group = useGroup(flag);
  const gang = useGang(flag);
  const vessel = useVessel(flag, window.our);
  const isMobile = useIsMobile();
  const root = useMatch({
    path: '/groups/:ship/:name',
    end: true,
  });
  const { recentChannel } = useRecentChannel(flag);

  useEffect(() => {
    if (initialized && !group && !gang) {
      navigate('/');
    } else if (initialized && group && root) {
      const found = Object.entries(group.channels).find(
        ([nest, channel]) => recentChannel === nest
      );

      let canRead = found && canReadChannel(found[1], vessel, group?.bloc);
      if (recentChannel && canRead && !isMobile) {
        navigate(`./channels/${recentChannel}`);
        return;
      }

      // done this way to prevent too many renders from useAllBriefs
      const allBriefs = {
        ..._.mapKeys(useChatState.getState().briefs, (v, k) => `chat/${k}`),
        ..._.mapKeys(useHeapState.getState().briefs, (v, k) => `heap/${k}`),
        ..._.mapKeys(useDiaryState.getState().briefs, (v, k) => `diary/${k}`),
      };
      const channel = Object.entries(group.channels).find(
        ([nest]) => nest in allBriefs
      );

      // canRead = channel && canReadChannel(channel[1], vessel, group?.bloc);
      canRead = true;
      if (channel && canRead && !isMobile) {
        navigate(`./channels/${channel[0]}`);
      } else if (!isMobile) {
        navigate('./channels');
      }
    }
  }, [
    root,
    gang,
    group,
    vessel,
    isMobile,
    initialized,
    recentChannel,
    navigate,
  ]);

  useEffect(() => {
    let id = null as number | null;
    useGroupState
      .getState()
      .initialize(flag)
      .then((i) => {
        id = i;
      });
    return () => {
      if (id) {
        api.unsubscribe(id);
      }
    };
  }, [flag]);

  if (!group) {
    return null;
  }

  return (
    <div className="flex grow bg-gray-50">
      <Outlet />
    </div>
  );
}

export default Groups;
