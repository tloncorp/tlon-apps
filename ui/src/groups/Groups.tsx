import React, { useCallback, useEffect, useMemo } from 'react';
import { Outlet, useMatch, useNavigate } from 'react-router';
import {
  useGang,
  useGroup,
  useGroupsInitialized,
  useGroupState,
  useRouteGroup,
  useVessel,
} from '@/state/groups/groups';
import { useChatState } from '@/state/chat';
import { useHeapState } from '@/state/heap/heap';
import { useDiaryState } from '@/state/diary';
import { useIsMobile } from '@/logic/useMedia';
import useRecentChannel from '@/logic/useRecentChannel';
import _ from 'lodash';
import { canReadChannel } from '@/logic/utils';
import useReactQuerySubscription from '@/logic/useReactQuerySubscription';
import { Group } from '@/types/groups';

function Groups() {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const initialized = useGroupsInitialized();
  const { isLoading: isLoadingGroupData, data: groupData } =
    useReactQuerySubscription({
      queryKey: ['group', flag],
      app: 'groups',
      path: `/groups/${flag}/ui`,
      initialScryPath: `/groups/${flag}`,
    });
  console.log({ groupData });
  const group = useMemo(
    () => (isLoadingGroupData ? undefined : (groupData as Group)),
    [groupData, isLoadingGroupData]
  );
  const gang = useGang(flag);
  const vessel = useVessel(flag, window.our);
  const isMobile = useIsMobile();
  const root = useMatch({
    path: '/groups/:ship/:name',
    end: true,
  });
  const { recentChannel } = useRecentChannel(flag);

  useEffect(() => {
    // 1) If we've initialized and the group doesn't exist and you don't have
    // an invite to it, navigate back to home.
    // 2) If we've initialized and we have a group and we're at the root of
    // that group (/~ship/group-name), then check if we have stored a "recent
    // channel" for that group that matches one of the group's current channels.
    // 3) If we found a channel that matches what we have for "recent channel"
    // and you can read that channel (and you're not on mobile), navigate
    // directly to that channel.
    // 4) If we don't have a recent channel, grab a channel from our briefs for
    // that group, check if we can read it, and if we're not on mobile, then
    // navigate to that channel.
    // 5) If we're on mobile, just navigate to the channel list for the group.

    if (initialized && !group && !gang) {
      navigate('/');
    } else if (initialized && group && root) {
      const found = Object.entries(group.channels).find(
        ([nest, _c]) => recentChannel === nest
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

      canRead = channel && canReadChannel(channel[1], vessel, group?.bloc);
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

  // useEffect(() => {
  // let id = null as number | null;
  // useGroupState
  // .getState()
  // .initialize(flag, true)
  // .then((i) => {
  // id = i;
  // });
  // return () => {
  // if (id) {
  // api.unsubscribe(id);
  // }
  // };
  // }, [flag]);

  if (!group) {
    return null;
  }

  return (
    <div className="flex min-w-0 grow bg-gray-50">
      <Outlet />
    </div>
  );
}

export default Groups;
