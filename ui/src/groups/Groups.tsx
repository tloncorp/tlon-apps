import React, { useEffect } from 'react';
import { Outlet, useNavigate } from 'react-router';
import {
  useGang,
  useGroup,
  useGroupsInitialized,
  useGroupState,
  useRouteGroup,
} from '../state/groups/groups';
import useNavStore from '../components/Nav/useNavStore';
import api from '../api';
import { useIsMobile } from '../logic/useMedia';

function Groups() {
  const navigate = useNavigate();
  const flag = useRouteGroup();
  const initialized = useGroupsInitialized();
  const group = useGroup(flag);
  const gang = useGang(flag);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!isMobile) {
      useNavStore.getState().navigatePrimary('group', flag);
    } else {
      useNavStore.getState().navigatePrimary('hidden');
    }
  }, [flag, isMobile]);

  useEffect(() => {
    if (initialized && !group && !gang) {
      useNavStore.getState().navigatePrimary('main');
      navigate('/');
    }
  }, [gang, group, initialized, navigate]);

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
    <div className="flex grow overflow-y-scroll bg-gray-50">
      <Outlet />
    </div>
  );
}

export default Groups;
