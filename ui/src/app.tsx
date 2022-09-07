import cookies from 'browser-cookies';
import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Location,
  useLocation,
  useNavigate,
  NavigateFunction,
} from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import Groups from '@/groups/Groups';
import Channel from '@/channels/Channel';
import { useGroupState } from '@/state/groups';
import { useChatState } from '@/state/chat';
import api, { IS_MOCK } from '@/api';
import Dms from '@/pages/Dms';
import Search from '@/pages/Search';
import NewDM from '@/pages/NewDm';
import { DmThread, GroupChatThread } from '@/chat/ChatThread/ChatThread';
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
import GroupLeaveDialog from '@/groups/GroupLeaveDialog';
import Message from '@/dms/Message';
import GroupAdmin from '@/groups/GroupAdmin/GroupAdmin';
import GroupMemberManager from '@/groups/GroupAdmin/GroupMemberManager';
import GroupChannelManager from '@/groups/GroupAdmin/GroupChannelManager';
import GroupInfo from '@/groups/GroupAdmin/GroupInfo';
import NewGroup from '@/groups/NewGroup/NewGroup';
import ProfileModal from '@/profiles/ProfileModal';
import MultiDMEditModal from '@/dms/MultiDMEditModal';
import NewChannelModal from '@/channels/NewChannel/NewChannelModal';
import FindGroups from '@/groups/FindGroups';
import JoinGroupModal from '@/groups/Join/JoinGroupModal';
import ChannelIndex from '@/groups/ChannelIndex/ChannelIndex';
import RejectConfirmModal from '@/groups/Join/RejectConfirmModal';
import EditProfile from '@/profiles/EditProfile/EditProfile';
import HeapDetail from '@/heap/HeapDetail';
import groupsFavicon from '@/assets/groups.svg';
import chatFavicon from '@/assets/chat.svg';
import { useHeapState } from './state/heap/heap';
import { useDiaryState } from './state/diary';
import useHarkState from './state/hark';
import Notifications from './notifications/Notifications';
import ChatChannel from './chat/ChatChannel';
import HeapChannel from './heap/HeapChannel';
import DiaryChannel from './diary/DiaryChannel';
import DiaryNote from './diary/DiaryNote';
import DMNotification from './notifications/DMNotification';
import GroupNotification from './notifications/GroupNotification';
import EditCurioModal from './heap/EditCurioModal';
import DiaryAddNote from './diary/DiaryAddNote';
import GroupMembers from './groups/GroupAdmin/GroupMembers';
import GroupPendingManager from './groups/GroupAdmin/GroupPendingManager';

const appHead = (appName: string) => {
  switch (appName) {
    case 'chat':
      return {
        title: 'Messages',
        icon: chatFavicon,
      };
    default:
      return {
        title: 'Groups',
        icon: groupsFavicon,
      };
  }
};

interface RoutesProps {
  state: { backgroundLocation?: Location } | null;
  location: Location;
}

function ChatRoutes({ state, location }: RoutesProps) {
  return (
    <>
      <Nav />
      <Routes location={state?.backgroundLocation || location}>
        <Route
          path="/notifications"
          element={
            <Notifications
              child={DMNotification}
              title={`${appHead('chat').title} • All Notifications`}
            />
          }
        />
        <Route path="/dm/" element={<Dms />}>
          <Route index element={<DMHome />} />
          <Route path="new" element={<NewDM />} />
          <Route path=":ship" element={<Message />}>
            <Route path="search" element={<Search />} />
            <Route path="message/:idShip/:idTime" element={<DmThread />} />
          </Route>
        </Route>

        <Route path="/groups/:ship/:name/*" element={<Groups />}>
          <Route
            path="channels/join/:app/:chShip/:chName"
            element={<Channel />}
          />
          <Route
            path="channels/chat/:chShip/:chName"
            element={<ChatChannel title={`${appHead('chat').title} • `} />}
          >
            <Route
              path="message/:idShip/:idTime"
              element={<GroupChatThread />}
            />
          </Route>
        </Route>

        <Route
          path="/profile/edit"
          element={
            <EditProfile title={`${appHead('chat').title} • Edit Profile`} />
          }
        />
      </Routes>
      {state?.backgroundLocation ? (
        <Routes>
          <Route path="/dm/:id/edit-info" element={<MultiDMEditModal />} />
          <Route path="/profile/:ship" element={<ProfileModal />} />
          <Route path="/gangs/:ship/:name" element={<JoinGroupModal />} />
          <Route
            path="/gangs/:ship/:name/reject"
            element={<RejectConfirmModal />}
          />
        </Routes>
      ) : null}
    </>
  );
}

function GroupsRoutes({ state, location }: RoutesProps) {
  return (
    <>
      <Routes location={state?.backgroundLocation || location}>
        <Route element={<Nav />}>
          <Route
            index
            element={
              <Notifications
                child={GroupNotification}
                title={`${appHead('').title} • Activity`}
              />
            }
          />
          <Route
            path="/notifications"
            element={
              <Notifications
                child={GroupNotification}
                title={`${appHead('').title} • All Notifications`}
              />
            }
          />
          {/* Find by Invite URL */}
          <Route
            path="/groups/find/:ship/:name"
            element={
              <FindGroups title={`${appHead('').title} • Find Groups`} />
            }
          />
          {/* Find by Nickname or @p */}
          <Route
            path="/groups/find/:ship"
            element={
              <FindGroups title={`${appHead('').title} • Find Groups`} />
            }
          />
          <Route
            path="/groups/find"
            element={
              <FindGroups title={`${appHead('').title} • Find Groups`} />
            }
          />
          <Route
            path="/groups/:ship/:name/*"
            element={
              <Notifications
                child={GroupNotification}
                title={`${appHead('').title} • Activity`}
              />
            }
          >
            <Route path="info" element={<GroupAdmin />}>
              <Route
                index
                element={<GroupInfo title={`${appHead('').title} • Info`} />}
              />
              <Route
                path="members"
                element={
                  <GroupMembers title={`${appHead('').title} • Members`} />
                }
              >
                <Route index element={<GroupMemberManager />} />
                <Route path="pending" element={<GroupPendingManager />} />
                <Route path="banned" element={<div />} />
              </Route>
              <Route
                path="channels"
                element={
                  <GroupChannelManager
                    title={`${appHead('').title} • Channels`}
                  />
                }
              />
            </Route>
            <Route
              path="channels/join/:app/:chShip/:chName"
              element={<Channel />}
            />
            <Route
              path="channels/chat/:chShip/:chName"
              element={<ChatChannel title={`${appHead('').title} • `} />}
            >
              <Route
                path="message/:idShip/:idTime"
                element={<GroupChatThread />}
              />
            </Route>
            <Route
              path="channels/heap/:chShip/:chName"
              element={<HeapChannel title={`${appHead('').title} • `} />}
            />
            <Route
              path="channels/heap/:chShip/:chName/curio/:idCurio"
              element={<HeapDetail />}
            />
            <Route
              path="channels/diary/:chShip/:chName"
              element={<DiaryChannel />}
            />
            <Route
              path="channels/diary/:chShip/:chName/note/:noteId"
              element={<DiaryNote />}
            />
            <Route
              path="channels/diary/:chShip/:chName/add"
              element={<DiaryAddNote />}
            />
            <Route
              path="channels"
              element={
                <ChannelIndex title={`${appHead('').title} • All Channels`} />
              }
            />
          </Route>
          <Route path="/dm/:ship" element={<Message />} />
          <Route
            path="/profile/edit"
            element={
              <EditProfile title={`${appHead('').title} • Edit Profile`} />
            }
          />
        </Route>
      </Routes>
      {state?.backgroundLocation ? (
        <Routes>
          <Route path="/groups/new" element={<NewGroup />} />
          <Route path="/groups/:ship/:name">
            <Route path="invite" element={<GroupInviteDialog />} />
          </Route>
          <Route
            path="/groups/:ship/:name/leave"
            element={<GroupLeaveDialog />}
          />
          <Route path="/gangs/:ship/:name" element={<JoinGroupModal />} />
          <Route
            path="/gangs/:ship/:name/reject"
            element={<RejectConfirmModal />}
          />
          <Route
            path="/groups/:ship/:name/channels/heap/:chShip/:chName/curio/:idCurio/edit"
            element={<EditCurioModal />}
          />
          <Route
            path="/groups/:ship/:name/channels/new"
            element={<NewChannelModal />}
          />
          <Route
            path="/groups/:ship/:name/channels/new/:section"
            element={<NewChannelModal />}
          />
          <Route path="/profile/:ship" element={<ProfileModal />} />
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

function handleGridRedirect(navigate: NavigateFunction) {
  const query = new URLSearchParams(window.location.search);

  if (query.has('grid-note')) {
    navigate(decodeURIComponent(query.get('grid-note')!));
  } else if (query.has('grid-link')) {
    navigate(decodeURIComponent(query.get('grid-link')!));
  }
}

function App() {
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const location = useLocation();
  const isChat = useIsChat();

  useEffect(() => {
    handleError(() => {
      checkIfLoggedIn();
      handleGridRedirect(navigate);
      // TODO: Clean up this order for different apps
      useGroupState.getState().start();
      useChatState.getState().start();
      useHeapState.getState().start();
      useDiaryState.getState().start();

      useChatState.getState().fetchDms();
      useHarkState.getState().start();
      const { initialize: settingsInitialize, fetchAll } =
        useSettingsState.getState();
      settingsInitialize(api);
      fetchAll();

      useContactState.getState().initialize(api);
    })();
  }, [navigate, handleError]);

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
  const app = import.meta.env.VITE_APP;
  const [userThemeColor, setUserThemeColor] = useState('#ffffff');

  const basename = (modeName: string, appName: string) => {
    if (mode === 'mock' || mode === 'staging') {
      return '/';
    }

    switch (appName) {
      case 'chat':
        return '/apps/chatstead';
      default:
        return '/apps/homestead';
    }
  };

  const theme = useTheme();
  const isDarkMode = useMedia('(prefers-color-scheme: dark)');

  useEffect(() => {
    if ((isDarkMode && theme === 'auto') || theme === 'dark') {
      document.body.classList.add('dark');
      useLocalState.setState({ currentTheme: 'dark' });
      setUserThemeColor('#000000');
    } else {
      document.body.classList.remove('dark');
      useLocalState.setState({ currentTheme: 'light' });
      setUserThemeColor('#ffffff');
    }
  }, [isDarkMode, theme]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorAlert}
      onReset={() => window.location.reload()}
    >
      <Router basename={basename(mode, app)}>
        <Helmet>
          <title>{appHead(app).title}</title>
          <link
            rel="icon"
            href={appHead(app).icon}
            sizes="any"
            type="image/svg+xml"
          />
          <meta name="theme-color" content={userThemeColor} />
        </Helmet>
        <App />
      </Router>
    </ErrorBoundary>
  );
}

export default RoutedApp;
