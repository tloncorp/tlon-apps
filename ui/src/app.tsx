import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  To,
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
import { IS_MOCK } from './api';
import Dms from './pages/Dms';
import Dm from './pages/Dm';

function SidebarRow(props: {
  className?: string;
  to: To;
  children?: React.ReactChild | React.ReactChild[];
}) {
  const { children, to, className = '' } = props;
  return (
    <li>
      <NavLink
        className={cn('flex items-center space-x-2 p-3', className)}
        to={to}
      >
        <div className="h-6 w-6 rounded border border-black" />
        {typeof children === 'string' ? <div>{children}</div> : children}
      </NavLink>
    </li>
  );
}

function GroupItem(props: { flag: string }) {
  const { flag } = props;
  const { meta } = useGroup(flag);
  return <SidebarRow to={`/groups/${flag}`}>{meta.title}</SidebarRow>;
}

function Divider(props: { title: string }) {
  const { title } = props;
  return (
    <div className="flex items-center space-x-2 p-2">
      <div>{title}</div>
      <div className="grow border-b border-black" />
    </div>
  );
}

function App() {
  const groups = useGroupList();

  useEffect(() => {
    useGroupState.getState().fetchAll();
    useChatState.getState().fetchFlags();
    useChatState.getState().fetchDms();
  }, []);

  return (
    <Router basename={IS_MOCK ? '/' : '/apps/homestead'}>
      <div className="flex h-full w-full">
        <ul className="h-full w-56 border-r border-black">
          <SidebarRow to="/foo">Groups</SidebarRow>
          <SidebarRow to="/dm">Direct Messages</SidebarRow>

          <SidebarRow to="/">Profile</SidebarRow>
          <SidebarRow to="/groups/new">New Group</SidebarRow>
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
          <Route path="/dm" element={<Dms />}>
            <Route path=":ship" element={<Dm />} />
            <Route index element={<div>Select a DM</div>} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
