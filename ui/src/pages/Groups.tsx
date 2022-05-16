import React, { useEffect } from 'react';
import { Outlet, Route, Routes } from 'react-router';
import { useGroup, useGroupState, useRouteGroup } from '../state/groups';
import api from '../api';
import GroupSidebar from '../components/GroupSidebar';
import useSidebars from '../state/sidebars';

function Groups() {
  const flag = useRouteGroup();
  const group = useGroup(flag);
  const { isMobile } = useSidebars();

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
      <Routes>
        <Route
          index={isMobile ? true : undefined}
          path={isMobile ? undefined : '/*'}
          element={<GroupSidebar flag={flag} group={group} />}
        />
      </Routes>
      <Outlet />
    </div>
  );
}

export default Groups;
