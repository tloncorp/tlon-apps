import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Location,
  useLocation,
} from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import Groups from './pages/Groups';
import Channel from './pages/Channel';
import { useGroupState } from './state/groups';
import NewGroup from './pages/NewGroup';
import NewChannel from './pages/NewChannel';
import Members from './pages/Members';
import Roles from './pages/Roles';
import { useChatState } from './state/chat';
import ChannelSettings from './pages/ChannelSettings';
import api, { IS_MOCK } from './api';
import Gang, { GangModal } from './pages/Gang';
import JoinGroup, { JoinGroupModal } from './pages/JoinGroup';

import Sidebar from './components/Sidebar/Sidebar';
import ChatThread from './chat/ChatThread/ChatThread';
import Policy from './pages/Policy';
import GroupSidebar from './components/GroupSidebar';
import useMedia from './logic/useMedia';
import useErrorHandler from './logic/useErrorHandler';
import { useSettingsState, useTheme } from './state/settings';
import { useLocalState } from './state/local';
import useContactState from './state/contact';
import ErrorAlert from './components/ErrorAlert';

function App() {
  const handleError = useErrorHandler();
  const location = useLocation();
  const isMobile = useMedia('(max-width: 639px)');

  useEffect(() => {
    handleError(() => {
      useGroupState.getState().start();
      useChatState.getState().fetchFlags();
      const { initialize: settingsInitialize, fetchAll } =
        useSettingsState.getState();
      settingsInitialize(api);
      fetchAll();

      useContactState.getState().initialize(api);
    })();
  }, [handleError]);

  const theme = useTheme();
  const isDarkMode = useMedia('(prefers-color-scheme: dark)');

  useEffect(() => {
    if ((isDarkMode && theme === 'auto') || theme === 'dark') {
      document.body.classList.add('dark');
      useLocalState.setState({ currentTheme: 'dark' });
    } else {
      document.body.classList.remove('dark');
      useLocalState.setState({ currentTheme: 'light' });
    }
  }, [isDarkMode, theme]);

  const state = location.state as { backgroundLocation?: Location } | null;

  return (
    <div className="flex h-full w-full">
      <Routes>
        <Route path={isMobile ? '/' : '*'} element={<Sidebar />} />
      </Routes>
      <Routes>
        <Route
          path={isMobile ? '/groups/:ship/:name' : '/groups/:ship/:name/*'}
          element={<GroupSidebar />}
        />
      </Routes>
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/gangs/:ship/:name" element={<Gang />} />
        <Route path="/groups/new" element={<NewGroup />} />
        <Route path="/groups/join" element={<JoinGroup />} />
        <Route path="/groups/:ship/:name/*" element={<Groups />}>
          <Route path="members" element={<Members />} />
          <Route path="roles" element={<Roles />} />
          <Route path="policy" element={<Policy />} />
          <Route path="channels/:app/:chShip/:chName/*" element={<Channel />}>
            <Route path="message/:time" element={<ChatThread />} />
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
    <ErrorBoundary
      FallbackComponent={ErrorAlert}
      onReset={() => window.location.reload()}
    >
      <Router basename={IS_MOCK ? '/' : '/apps/homestead'}>
        <App />
      </Router>
    </ErrorBoundary>
  );
}

export default RoutedApp;
