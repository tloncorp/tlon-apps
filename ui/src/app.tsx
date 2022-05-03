import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from 'react-router-dom';
import cn from 'classnames';
import Groups from './pages/Groups';
import Channel from './pages/Channel';
import { useGroup, useGroupList, useGroupState } from './state/groups';
import NewGroup from './pages/NewGroup';
import NewChannel from './pages/NewChannel';
import Members from './pages/Members';
import Roles from './pages/Roles';
import { useChatState } from './state/chat';
import ChannelSettings from './pages/ChannelSettings';
import {IS_MOCK} from './api';

function SidebarRow(props: {
  icon?: string;
  img?: string;
  className?: string;
  children?: React.ReactChild | React.ReactChild[];
}) {
  const { children, icon, img, className = '' } = props;
  return (
    <li className={cn('flex space-x-2 p-2', className)}>
      <div className="h-6 w-6 rounded border" />
      {typeof children === 'string' ? <div>{children}</div> : children}
    </li>
  );
}

function GroupItem(props: { flag: string }) {
  const { flag } = props;
  const { meta } = useGroup(flag);
  return (
    <SidebarRow>
      <NavLink to={`/groups/${flag}`}>{meta.title}</NavLink>
    </SidebarRow>
  );
}

function Divider(props: { title: string }) {
  const { title } = props;
  return (
    <div className="flex items-center space-x-2 p-2">
      <div>{title}</div>
      <div className="grow border-b" />
    </div>
  );
}

function App() {
  const groups = useGroupList();
  const { groups: groupMap } = useGroupState();

  useEffect(() => {
    useGroupState.getState().fetchAll();
    useChatState.getState().fetchFlags();
  }, []);

  return (
    <Router basename={IS_MOCK ? "/" : "/apps/homestead"}>
      <div className="flex h-full w-full">
        <ul className="h-full w-56 border-r p-2">
          <SidebarRow>Groups</SidebarRow>
          <SidebarRow>Profile</SidebarRow>
          <SidebarRow>
            <NavLink to="/groups/new">New Group</NavLink>
          </SidebarRow>
          <Divider title="All Groups" />
          {groups.map((flag) => (
            <GroupItem key={flag} flag={flag} />
          ))}
        </ul>
        <Routes>
          <Route path="/groups/new" element={<NewGroup />} />
          <Route path="/groups/:ship/:name" element={<Groups />}>
            <Route path="members" element={<Members />} />
            <Route path="roles" element={<Roles />} />
            <Route path="channels/:app/:chShip/:chName" element={<Channel />} />
            <Route
              path="channels/:app/:chShip/:chName/settings"
              element={<ChannelSettings />}
            />
            <Route path="channels/new" element={<NewChannel />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
