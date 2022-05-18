import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Location,
} from 'react-router-dom';
import Groups from './pages/Groups';
import Channel from './pages/Channel';
import { useGroupState } from './state/groups';
import NewGroup from './pages/NewGroup';
import NewChannel from './pages/NewChannel';
import Members from './pages/Members';
import Roles from './pages/Roles';
import { useChatState } from './state/chat';
import ChannelSettings from './pages/ChannelSettings';
import { IS_MOCK } from './api';
import Dms from './pages/Dms';
import Dm from './pages/Dm';
import NewDM from './pages/NewDm';
import Gang, { GangModal } from './pages/Gang';
import JoinGroup, { JoinGroupModal } from './pages/JoinGroup';

import Sidebar from './components/Sidebar/Sidebar';
import { DmThread, GroupChatThread } from './components/ChatThread/ChatThread';
import Policy from './pages/Policy';

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
  const location = useLocation();
  useEffect(() => {
    useGroupState.getState().start();
    useChatState.getState().fetchFlags();
    useChatState.getState().fetchDms();
  }, []);

  const state = location.state as { backgroundLocation?: Location } | null;

  return (
    <div className="flex h-full w-full">
      <Sidebar />
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/dm" element={<Dms />}>
          <Route path="new" element={<NewDM />} />
          <Route path=":ship" element={<Dm />}>
            <Route path="message/:idShip/:idTime" element={<DmThread />} />
          </Route>
          <Route index element={<div>Select a DM</div>} />
        </Route>

        <Route path="/gangs/:ship/:name" element={<Gang />} />
        <Route path="/groups/new" element={<NewGroup />} />
        <Route path="/groups/join" element={<JoinGroup />} />
        <Route path="/groups/:ship/:name" element={<Groups />}>
          <Route path="members" element={<Members />} />
          <Route path="roles" element={<Roles />} />
          <Route path="policy" element={<Policy />} />
          <Route path="channels/:app/:chShip/:chName" element={<Channel />}>
            <Route
              path="message/:idShip/:idTime"
              element={<GroupChatThread />}
            />
          </Route>
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
