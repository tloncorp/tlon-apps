import React, { useEffect } from 'react';
import { Outlet } from 'react-router';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import useNavStore from '../components/Nav/useNavStore';
import api from '../api';

function Groups() {
  const flag = useRouteGroup();
  const group = useGroup(flag);

  useEffect(() => {
    useNavStore.getState().setLocationGroups(flag);
  }, [flag]);

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
    <div className="flex grow">
      <Outlet />
    </div>
  );
}

export default Groups;
