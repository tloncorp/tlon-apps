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

function SidebarRow(props: {
  icon?: string;
  img?: string;
  className?: string;
  children?: React.ReactChild | React.ReactChild[];
}) {
  const { children, icon, img, className = '' } = props;
  return (
    <li className={cn('flex p-2 space-x-2', className)}>
      <div className="border w-6 h-6 rounded"></div>
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
    <div className="flex p-2 space-x-2 items-center">
      <div>{title}</div>
      <div className="grow border-b"></div>
    </div>
  );
}

function App() {
  const groups = useGroupList();
  useEffect(() => {
    useGroupState.getState().fetchAll();
  }, []);
  return (
    <Router basename="/apps/homestead">
      <div className="h-full w-full flex">
        <ul className="h-full p-2 w-56 border-r">
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
            <Route path="channels/:app/:chShip/:chName" element={<Channel />} />
            <Route path="channels/new" element={<NewChannel />} />
          </Route>
        </Routes>
      </div>
    </Router>
  );
}

export default App;
