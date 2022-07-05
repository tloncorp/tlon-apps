import React, { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups/groups';
import useNavStore from '../components/Nav/useNavStore';
import api from '../api';
import { useIsMobile } from '../logic/useMedia';

function Groups() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) {
      useNavStore.getState().navigatePrimary('group', flag);
    } else {
      useNavStore.getState().navigatePrimary('hidden');
    }
  }, [flag, isMobile]);

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
