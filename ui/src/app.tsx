import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import Sidebar from './components/Sidebar/Sidebar';
import ChatThread from './components/ChatThread/ChatThread';

function App() {
  useEffect(() => {
    useGroupState.getState().fetchAll();
    useChatState.getState().fetchFlags();
  }, []);

  return (
    <Router basename={IS_MOCK ? '/' : '/apps/homestead'}>
      <div className="flex h-full w-full">
        <Sidebar />
        <Routes>
          <Route path="/groups/new" element={<NewGroup />} />
          <Route path="/groups/:ship/:name" element={<Groups />}>
            <Route path="members" element={<Members />} />
            <Route path="roles" element={<Roles />} />
            <Route path="channels/:app/:chShip/:chName" element={<Channel />}>
              <Route path="message/:time" element={<ChatThread />} />
            </Route>
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
