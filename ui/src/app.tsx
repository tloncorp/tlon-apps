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
import api from './api';
import Dms from './pages/Dms';
import Dm from './pages/Dm';
import NewDM from './pages/NewDm';
import Gang, { GangModal } from './pages/Gang';
import JoinGroup, { JoinGroupModal } from './pages/JoinGroup';
import Sidebar from './components/Sidebar/Sidebar';
import { DmThread, GroupChatThread } from './chat/ChatThread/ChatThread';
import Policy from './pages/Policy';
import GroupSidebar from './components/GroupSidebar';
import useMedia, { useIsMobile } from './logic/useMedia';
import useErrorHandler from './logic/useErrorHandler';
import { useSettingsState, useTheme } from './state/settings';
import { useLocalState } from './state/local';
import useContactState from './state/contact';
import ErrorAlert from './components/ErrorAlert';
import DMSidebar from './dms/DMSidebar';
import DMHome from './dms/DMHome';

interface RoutesProps {
  isMobile: boolean;
  state: { backgroundLocation?: Location } | null;
  location: Location;
}

function ChatRoutes({ isMobile, state, location }: RoutesProps) {
  return (
    <>
      <Routes>
        <Route path={isMobile ? '/' : '*'} element={<Sidebar />} />
      </Routes>
      <Routes>
        <Route
          path={isMobile ? '/groups/:ship/:name' : '/groups/:ship/:name/*'}
          element={<GroupSidebar />}
        />
        <Route path={isMobile ? '/dm' : '/dm/*'} element={<DMSidebar />} />
      </Routes>
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/dm/" element={<Dms />}>
          <Route index element={<DMHome />} />
          <Route path="new" element={<NewDM />} />
          <Route path=":ship" element={<Dm />}>
            <Route path="message/:idShip/:idTime" element={<DmThread />} />
          </Route>
        </Route>

        <Route path="/gangs/:ship/:name" element={<Gang />} />
        <Route path="/groups/new" element={<NewGroup />} />
        <Route path="/groups/join" element={<JoinGroup />} />
        <Route path="/groups/:ship/:name/*" element={<Groups />}>
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
    </>
  );
}

function GroupsRoutes({ isMobile, state, location }: RoutesProps) {
  return (
    <>
      <Routes>
        <Route path={isMobile ? '/' : '*'} element={<Sidebar />} />
      </Routes>
      <Routes>
        <Route
          path={isMobile ? '/groups/:ship/:name' : '/groups/:ship/:name/*'}
          element={<GroupSidebar />}
        />
        <Route path={isMobile ? '/dm' : '/dm/*'} element={<DMSidebar />} />
      </Routes>
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/dm/" element={<Dms />}>
          <Route index element={<DMHome />} />
          <Route path="new" element={<NewDM />} />
          <Route path=":ship" element={<Dm />}>
            <Route path="message/:idShip/:idTime" element={<DmThread />} />
          </Route>
        </Route>

        <Route path="/gangs/:ship/:name" element={<Gang />} />
        <Route path="/groups/new" element={<NewGroup />} />
        <Route path="/groups/join" element={<JoinGroup />} />
        <Route path="/groups/:ship/:name/*" element={<Groups />}>
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
    </>
  );
}

function App() {
  const handleError = useErrorHandler();
  const location = useLocation();
  const isMobile = useIsMobile();
  const IS_CHAT =
    import.meta.env.MODE === 'chat' || import.meta.env.MODE === 'chatmock';

  useEffect(() => {
    handleError(() => {
      useGroupState.getState().start();
      useChatState.getState().start();
      useChatState.getState().fetchDms();
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
      {IS_CHAT ? (
        <ChatRoutes isMobile={isMobile} state={state} location={location} />
      ) : (
        <GroupsRoutes isMobile={isMobile} state={state} location={location} />
      )}
    </div>
  );
}

function RoutedApp() {
  const mode = import.meta.env.MODE;
  const basename = (modeName: string) => {
    switch (modeName) {
      case 'mock':
      case 'chatmock':
        return '/';
      case 'chat':
        return '/apps/chatstead';
      default:
        return '/apps/homestead';
    }
  };
  return (
    <ErrorBoundary
      FallbackComponent={ErrorAlert}
      onReset={() => window.location.reload()}
    >
      <Router basename={basename(mode)}>
        <App />
      </Router>
    </ErrorBoundary>
  );
}

export default RoutedApp;
