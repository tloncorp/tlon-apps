import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
  useLocation,
  Location,
} from 'react-router-dom';
import cn from 'classnames';
import Groups from './pages/Groups';
import Channel from './pages/Channel';
import {
  useGangList,
  useGroup,
  useGroupList,
  useGroupState,
} from './state/groups';
import NewGroup from './pages/NewGroup';
import NewChannel from './pages/NewChannel';
import Members from './pages/Members';
import Roles from './pages/Roles';
import { useChatState } from './state/chat';
import ChannelSettings from './pages/ChannelSettings';
import { IS_MOCK } from './api';
import Gang, { GangModal } from './pages/Gang';
import GangName from './components/GangName/GangName';
import JoinGroup, { JoinGroupModal } from './pages/JoinGroup';
import Policy from './pages/Policy';

function SidebarRow(props: {
  className?: string;
  children?: React.ReactChild | React.ReactChild[];
  img?: string;
}) {
  const { img, children, className = '' } = props;
  return (
    <li className={cn('flex items-center space-x-2 p-2', className)}>
      {(img || '').length > 0 ? (
        <img className="h-6 w-6 rounded border" src={img} />
      ) : (
        <div className="h-6 w-6 rounded border" />
      )}
      {typeof children === 'string' ? <div>{children}</div> : children}
    </li>
  );
}

function GroupItem(props: { flag: string }) {
  const { flag } = props;
  const { meta } = useGroup(flag);
  return (
    <SidebarRow img={meta.image}>
      <NavLink to={`/groups/${flag}`}>{meta.title}</NavLink>
    </SidebarRow>
  );
}

function GangItem(props: { flag: string }) {
  const { flag } = props;
  return (
    <SidebarRow>
      <NavLink to={`/gangs/${flag}`}>
        <GangName flag={flag} />
      </NavLink>
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
  const location = useLocation();
  const groups = useGroupList();
  const gangs = useGangList();

  useEffect(() => {
    useGroupState.getState().start();
    useChatState.getState().fetchFlags();
  }, []);

  const state = location.state as { backgroundLocation?: Location } | null;

  return (
    <div className="flex h-full w-full">
      <ul className="h-full w-56 border-r p-2">
        <SidebarRow>Groups</SidebarRow>
        <SidebarRow>Profile</SidebarRow>
        <SidebarRow>
          <NavLink to="/groups/new">New Group</NavLink>
        </SidebarRow>
        <SidebarRow>
          <NavLink to="/groups/join">Join Group</NavLink>
        </SidebarRow>
        <Divider title="All Groups" />
        {groups.map((flag) => (
          <GroupItem key={flag} flag={flag} />
        ))}
        {gangs.length > 0 ? <Divider title="Pending" /> : null}
        {gangs.map((flag) => (
          <GangItem key={flag} flag={flag} />
        ))}
      </ul>
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/gangs/:ship/:name" element={<Gang />} />
        <Route path="/groups/new" element={<NewGroup />} />
        <Route path="/groups/join" element={<JoinGroup />} />
        <Route path="/groups/:ship/:name" element={<Groups />}>
          <Route path="members" element={<Members />} />
          <Route path="roles" element={<Roles />} />
          <Route path="policy" element={<Policy />} />
          <Route path="channels/:app/:chShip/:chName" element={<Channel />} />
          <Route
            path="channels/:app/:chShip/:chName/settings"
            element={<ChannelSettings />}
          />
          <Route path="channels/new" element={<NewChannel />} />
        </Route>
      </Routes>
      {state?.backgroundLocation ? (
        <Routes>
          <Route path="/groups/join" element={<JoinGroupModal />} />
          <Route path="/gangs/:ship/:name" element={<GangModal />} />
        </Routes>
      ) : null}
    </div>
  );
}

function RoutedApp() {
  return (
    <Router basename={IS_MOCK ? '/' : '/apps/homestead'}>
      <App />
    </Router>
  );
}

export default RoutedApp;
