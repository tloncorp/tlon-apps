import React, { useEffect } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router';
import {
  useGang,
  useGroup,
  useGroupsInitialized,
  useGroupState,
  useRouteGroup,
} from '@/state/groups/groups';
import api from '@/api';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import { createStorageKey, nestToFlag } from '@/logic/utils';
import { useLocalStorage } from 'usehooks-ts';
import { useIsMobile } from '@/logic/useMedia';

function Groups() {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const initialized = useGroupsInitialized();
  const group = useGroup(flag);
  const gang = useGang(flag);
  const isMobile = useIsMobile();
  const root = useMatch({
    path: '/groups/:ship/:name',
    end: true,
  });
  const [recentChannel] = useLocalStorage(
    createStorageKey(`recent-chan:${flag}`),
    ''
  );

  useEffect(() => {
    if (initialized && !group && !gang) {
      navigate('/');
    } else if (initialized && group && root) {
      if (recentChannel && !isMobile) {
        navigate(`./channels/${recentChannel}`);
        return;
      }

      // done this way to prevent too many renders from useAllBriefs
      const allBriefs = {
        ...useChatState.getState().briefs,
        ...useHeapState.getState().briefs,
        ...useDiaryState.getState().briefs,
      };
      const channel = Object.entries(group.channels).find(([nest]) => {
        const [, chFlag] = nestToFlag(nest);
        return chFlag in allBriefs;
      });

      if (channel && !isMobile) {
        navigate(`./channels/${channel[0]}`);
      } else if (!isMobile) {
        navigate('./activity');
      }
    }
  }, [root, gang, group, isMobile, initialized, recentChannel, navigate]);

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
