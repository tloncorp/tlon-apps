import cookies from 'browser-cookies';
import React, { Suspense, useEffect, useState } from 'react';
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
import Dms from '@/dms/Dms';
import NewDM from '@/dms/NewDm';
import ChatThread from '@/chat/ChatThread/ChatThread';
import useMedia, { useIsDark, useIsMobile } from '@/logic/useMedia';
import useErrorHandler from '@/logic/useErrorHandler';
import { useSettingsState, useTheme } from '@/state/settings';
import {
  useAirLockErrorCount,
  useErrorCount,
  useLocalState,
  useSubscriptionStatus,
} from '@/state/local';
import useContactState from '@/state/contact';
import ErrorAlert from '@/components/ErrorAlert';
import DMHome from '@/dms/DMHome';
import GroupsNav from '@/nav/GroupsNav';
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
import talkFavicon from '@/assets/talk.svg';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { useHeapState } from './state/heap/heap';
import { useDiaryState } from './state/diary';
import useHarkState from './state/hark';
import Notifications, {
  GroupWrapper,
  MainWrapper,
} from './notifications/Notifications';
import ChatChannel from './chat/ChatChannel';
import HeapChannel from './heap/HeapChannel';
import DiaryChannel from './diary/DiaryChannel';
import DiaryNote from './diary/DiaryNote';
import DMNotification from './notifications/DMNotification';
import GroupNotification from './notifications/GroupNotification';
import EditCurioModal from './heap/EditCurioModal';
import GroupMembers from './groups/GroupAdmin/GroupMembers';
import GroupPendingManager from './groups/GroupAdmin/GroupPendingManager';
import LoadingSpinner from './components/LoadingSpinner/LoadingSpinner';
import DisconnectNotice from './components/DisconnectNotice';
import MobileGroupSidebar from './groups/GroupSidebar/MobileGroupSidebar';
import TalkNav from './nav/TalkNav';
import TalkHead from './dms/TalkHead';
import MobileMessagesSidebar from './dms/MobileMessagesSidebar';
import MobileSidebar from './components/Sidebar/MobileSidebar';
import MobileGroupsNavHome from './nav/MobileRoot';
import MobileGroupsActions from './groups/MobileGroupsActions';
import MobileGroupRoot from './nav/MobileGroupRoot';
import MobileGroupActions from './groups/MobileGroupActions';
import { useStorage } from './state/storage';
import { isTalk } from './logic/utils';
import bootstrap from './state/bootstrap';

const DiaryAddNote = React.lazy(() => import('./diary/DiaryAddNote'));
const SuspendedDiaryAddNote = (
  <Suspense
    fallback={
      <div className="h-screen w-full flex-1">
        <div className="align-center flex h-full w-full justify-center">
          <LoadingSpinner />
        </div>
      </div>
    }
  >
    <DiaryAddNote />
  </Suspense>
);

const appHead = (appName: string) => {
  switch (appName) {
    case 'chat':
      return {
        title: 'Talk',
        icon: talkFavicon,
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
  isMobile: boolean;
  isSmall: boolean;
}

function ChatRoutes({ state, location, isMobile, isSmall }: RoutesProps) {
  return (
    <>
      <Routes location={state?.backgroundLocation || location}>
        <Route element={<TalkNav />}>
          <Route
            index
            element={isMobile ? <MobileMessagesSidebar /> : <DMHome />}
          />
          <Route
            path="/notifications"
            element={
              <Notifications
                child={DMNotification}
                title={`• ${appHead('chat').title}`}
              />
            }
          />
          <Route path="/dm/" element={<Dms />}>
            <Route index element={<DMHome />} />
            <Route path="new" element={<NewDM />} />
            <Route path=":ship" element={<Message />}>
              {isSmall ? null : (
                <Route
                  path="message/:idShip/:idTime"
                  element={<ChatThread />}
                />
              )}
            </Route>
            {isSmall && (
              <Route
                path=":ship/message/:idShip/:idTime"
                element={<ChatThread />}
              />
            )}
          </Route>

          <Route path="/groups/:ship/:name/*" element={<Groups />}>
            <Route
              path="channels/join/:app/:chShip/:chName"
              element={<Channel />}
            />
            <Route path="channels/chat/:chShip/:chName">
              <Route
                index
                element={<ChatChannel title={` • ${appHead('').title}`} />}
              />
              <Route
                path="*"
                element={<ChatChannel title={` • ${appHead('').title}`} />}
              >
                {isSmall ? null : (
                  <Route
                    path="message/:idShip/:idTime"
                    element={<ChatThread />}
                  />
                )}
              </Route>
              {isSmall ? (
                <Route
                  path="message/:idShip/:idTime"
                  element={<ChatThread />}
                />
              ) : null}
            </Route>
          </Route>

          <Route
            path="/profile/edit"
            element={
              <EditProfile title={`Edit Profile • ${appHead('chat').title}`} />
            }
          />
        </Route>
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

function GroupsRoutes({ state, location, isMobile, isSmall }: RoutesProps) {
  return (
    <>
      <Routes location={state?.backgroundLocation || location}>
        <Route element={<GroupsNav />}>
          <Route element={isMobile ? <MobileSidebar /> : undefined}>
            <Route
              index
              element={
                isMobile ? (
                  <MobileGroupsNavHome />
                ) : (
                  <Notifications
                    child={GroupNotification}
                    title={`All Notifications • ${appHead('').title}`}
                  />
                )
              }
            />
            <Route
              path="/notifications"
              element={
                <MainWrapper isMobile={isMobile}>
                  <Notifications
                    child={GroupNotification}
                    title={`All Notifications • ${appHead('').title}`}
                  />
                </MainWrapper>
              }
            />
            {/* Find by Invite URL */}
            <Route
              path="/find/:ship/:name"
              element={
                <FindGroups title={`Find Groups • ${appHead('').title}`} />
              }
            />
            {/* Find by Nickname or @p */}
            <Route
              path="/find/:ship"
              element={
                <FindGroups title={`Find Groups • ${appHead('').title}`} />
              }
            />
            <Route
              path="/find"
              element={
                <FindGroups title={`Find Groups • ${appHead('').title}`} />
              }
            />
            <Route
              path="/profile/edit"
              element={
                <EditProfile title={`Edit Profile • ${appHead('').title}`} />
              }
            />
            <Route path="/actions" element={<MobileGroupsActions />} />
          </Route>
          <Route path="/groups/:ship/:name" element={<Groups />}>
            <Route element={isMobile ? <MobileGroupSidebar /> : undefined}>
              <Route index element={isMobile ? <MobileGroupRoot /> : null} />
              <Route
                path="activity"
                element={
                  <GroupWrapper isMobile={isMobile}>
                    <Notifications
                      child={GroupNotification}
                      title={`• ${appHead('').title}`}
                    />
                  </GroupWrapper>
                }
              />
              <Route path="info" element={<GroupAdmin />}>
                <Route
                  index
                  element={<GroupInfo title={`• ${appHead('').title}`} />}
                />
                <Route
                  path="members"
                  element={<GroupMembers title={`• ${appHead('').title}`} />}
                >
                  <Route index element={<GroupMemberManager />} />
                  <Route path="pending" element={<GroupPendingManager />} />
                  <Route path="banned" element={<div />} />
                </Route>
                <Route
                  path="channels"
                  element={
                    <GroupChannelManager title={`• ${appHead('').title}`} />
                  }
                />
              </Route>
              <Route
                path="channels"
                element={<ChannelIndex title={` • ${appHead('').title}`} />}
              />
              <Route path="actions" element={<MobileGroupActions />} />
            </Route>
            <Route
              path="channels/join/:app/:chShip/:chName"
              element={<Channel />}
            />
            <Route path="channels/chat/:chShip/:chName">
              <Route
                index
                element={<ChatChannel title={` • ${appHead('').title}`} />}
              />
              <Route
                path="*"
                element={<ChatChannel title={` • ${appHead('').title}`} />}
              >
                {isSmall ? null : (
                  <Route
                    path="message/:idShip/:idTime"
                    element={<ChatThread />}
                  />
                )}
              </Route>
              {isSmall ? (
                <Route
                  path="message/:idShip/:idTime"
                  element={<ChatThread />}
                />
              ) : null}
            </Route>
            <Route path="channels/heap/:chShip/:chName">
              <Route
                index
                element={<HeapChannel title={` • ${appHead('').title}`} />}
              />
              <Route path="curio/:idCurio" element={<HeapDetail />} />
            </Route>
            <Route path="channels/diary/:chShip/:chName">
              <Route index element={<DiaryChannel />} />
              <Route path="note/:noteId" element={<DiaryNote />} />
              <Route path="edit">
                <Route index element={SuspendedDiaryAddNote} />
                <Route path=":id" element={SuspendedDiaryAddNote} />
              </Route>
            </Route>
          </Route>
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
  const isMobile = useIsMobile();
  const isSmall = useMedia('(max-width: 1023px)');
  const subscription = useSubscriptionStatus();
  const errorCount = useErrorCount();
  const airLockErrorCount = useAirLockErrorCount();

  useEffect(() => {
    handleError(() => {
      checkIfLoggedIn();
      handleGridRedirect(navigate);
    })();
  }, [handleError, navigate]);

  useEffect(() => {
    handleError(() => {
      bootstrap();
    })();
  }, [handleError]);

  const state = location.state as { backgroundLocation?: Location } | null;

  useEffect(() => {
    if (
      (errorCount > 4 || airLockErrorCount > 1) &&
      subscription === 'connected'
    ) {
      useLocalState.setState({ subscription: 'disconnected' });
    }
  }, [errorCount, subscription, airLockErrorCount]);

  return (
    <div className="flex h-full w-full flex-col">
      {subscription === 'disconnected' || subscription === 'reconnecting' ? (
        <DisconnectNotice />
      ) : null}
      {isTalk ? (
        <>
          <TalkHead />
          <ChatRoutes
            state={state}
            location={location}
            isMobile={isMobile}
            isSmall={isSmall}
          />
        </>
      ) : (
        <GroupsRoutes
          state={state}
          location={location}
          isMobile={isMobile}
          isSmall={isSmall}
        />
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
        return '/apps/talk';
      default:
        return '/apps/groups';
    }
  };

  const theme = useTheme();
  const isDarkMode = useIsDark();

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
          {app === 'groups' ? (
            <link rel="manifest" href="/src/assets/manifest.json" />
          ) : (
            <link rel="manifest" href="/src/assets/chatmanifest.json" />
          )}
        </Helmet>
        <TooltipProvider skipDelayDuration={400}>
          <App />
        </TooltipProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default RoutedApp;
