import cookies from 'browser-cookies';
import React, { useEffect } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Location,
  useLocation,
} from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import Groups from '@/groups/Groups';
import Channel from '@/pages/Channel';
import { useGroupState } from '@/state/groups';
import Members from '@/pages/Members';
import Roles from '@/pages/Roles';
import { useChatState } from '@/state/chat';
import ChannelSettings from '@/pages/ChannelSettings';
import api, { IS_MOCK } from '@/api';
import Dms from '@/pages/Dms';
import Search from '@/pages/Search';
import NewDM from '@/pages/NewDm';
import Gang, { GangModal } from '@/pages/Gang';
import JoinGroup, { JoinGroupModal } from '@/pages/JoinGroup';
import { DmThread, GroupChatThread } from '@/chat/ChatThread/ChatThread';
import Policy from '@/pages/Policy';
import useMedia from '@/logic/useMedia';
import useIsChat from '@/logic/useIsChat';
import useErrorHandler from '@/logic/useErrorHandler';
import { useSettingsState, useTheme } from '@/state/settings';
import { useLocalState } from '@/state/local';
import useContactState from '@/state/contact';
import ErrorAlert from '@/components/ErrorAlert';
import DMHome from '@/dms/DMHome';
import Nav from '@/components/Nav/Nav';
import GroupInviteDialog from '@/groups/GroupInviteDialog';
import Message from '@/dms/Message';
import GroupAdmin from '@/groups/GroupAdmin/GroupAdmin';
import GroupMemberManager from '@/groups/GroupAdmin/GroupMemberManager';
import GroupInfo from '@/groups/GroupAdmin/GroupInfo';
import NewGroup from '@/groups/NewGroup/NewGroup';
import MultiDMEditModal from './dms/MultiDMEditModal';
import NewChannel from './channels/NewChannel/NewChannel';

interface RoutesProps {
  state: { backgroundLocation?: Location } | null;
  location: Location;
}

function ChatRoutes({ state, location }: RoutesProps) {
  return (
    <>
      <Nav />
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/dm/" element={<Dms />}>
          <Route index element={<DMHome />} />
          <Route path="new" element={<NewDM />} />
          <Route path=":ship" element={<Message />}>
            <Route path="search" element={<Search />} />
            <Route path="message/:idShip/:idTime" element={<DmThread />} />
          </Route>
        </Route>

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
        </Route>
      </Routes>
      {state?.backgroundLocation ? (
        <Routes>
          <Route path="/dm/:id/edit-info" element={<MultiDMEditModal />} />
        </Routes>
      ) : null}
    </>
  );
}

function GroupsRoutes({ state, location }: RoutesProps) {
  return (
    <>
      <Nav />
      <Routes location={state?.backgroundLocation || location}>
        <Route path="/gangs/:ship/:name" element={<Gang />} />
        <Route path="/groups/join" element={<JoinGroup />} />
        <Route path="/groups/:ship/:name/*" element={<Groups />}>
          <Route path="info" element={<GroupAdmin />}>
            <Route index element={<GroupInfo />} />
            <Route path="members" element={<GroupMemberManager />} />
            <Route path="applets" element={<div />} />
          </Route>
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
        </Route>
      </Routes>
      {state?.backgroundLocation ? (
        <Routes>
          <Route path="/groups/new" element={<NewGroup />} />
          <Route path="/groups/join" element={<JoinGroupModal />} />
          <Route path="/groups/:ship/:name">
            <Route path="invite" element={<GroupInviteDialog />} />
          </Route>
          <Route path="/gangs/:ship/:name" element={<GangModal />} />
          <Route
            path="/groups/:ship/:name/channels/new"
            element={<NewChannel />}
          />
        </Routes>
      ) : null}
    </>
  );
}

function authRedirect() {
  document.location = `${document.location.protocol}//${document.location.host}`;
}

function checkIfLoggedIn() {
  if (IS_MOCK) {
    return;
  }

  if (!('ship' in window)) {
    authRedirect();
  }

  const session = cookies.get(`urbauth-~${window.ship}`);
  if (!session) {
    authRedirect();
  }
}

function App() {
  const handleError = useErrorHandler();
  const location = useLocation();
  const isChat = useIsChat();

  useEffect(() => {
    handleError(() => {
      checkIfLoggedIn();
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
      {isChat ? (
        <ChatRoutes state={state} location={location} />
      ) : (
        <GroupsRoutes state={state} location={location} />
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
      case 'chatstaging':
      case 'staging':
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
