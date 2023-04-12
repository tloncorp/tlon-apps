import cookies from 'browser-cookies';
import React, { Suspense, useEffect, useState } from 'react';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { Helmet } from 'react-helmet';
import _ from 'lodash';
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
import { IS_MOCK } from '@/api';
import Dms from '@/dms/Dms';
import NewDM from '@/dms/NewDm';
import ChatThread from '@/chat/ChatThread/ChatThread';
import useMedia, { useIsDark, useIsMobile } from '@/logic/useMedia';
import useErrorHandler from '@/logic/useErrorHandler';
import { useCalm, useSettingsLoaded, useTheme } from '@/state/settings';
import { useLocalState } from '@/state/local';
import ErrorAlert from '@/components/ErrorAlert';
import DMHome from '@/dms/DMHome';
import GroupsNav from '@/nav/GroupsNav';
import GroupInviteDialog from '@/groups/GroupInviteDialog';
import GroupLeaveDialog from '@/groups/GroupLeaveDialog';
import Message from '@/dms/Message';
import GroupAdmin from '@/groups/GroupAdmin/GroupAdmin';
import GroupMemberManager from '@/groups/GroupAdmin/GroupMemberManager';
import GroupChannelManager from '@/groups/ChannelsList/GroupChannelManager';
import GroupInfo from '@/groups/GroupAdmin/GroupInfo';
import NewGroup from '@/groups/NewGroup/NewGroup';
import ProfileModal from '@/profiles/ProfileModal';
import MultiDMEditModal from '@/dms/MultiDMEditModal';
import NewChannelModal from '@/channels/NewChannel/NewChannelModal';
import FindGroups from '@/groups/FindGroups';
import JoinGroupModal from '@/groups/Join/JoinGroupModal';
import RejectConfirmModal from '@/groups/Join/RejectConfirmModal';
import EditProfile from '@/profiles/EditProfile/EditProfile';
import HeapDetail from '@/heap/HeapDetail';
import groupsFavicon from '@/assets/groups.svg';
import talkFavicon from '@/assets/talk.svg';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import indexedDBPersistor from './indexedDBPersistor';
import Notifications, { MainWrapper } from './notifications/Notifications';
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
import Leap from './components/Leap/Leap';
import { isTalk, preSig } from './logic/utils';
import bootstrap from './state/bootstrap';
import AboutDialog from './components/AboutDialog';
import UpdateNotice from './components/UpdateNotice';
import MobileGroupChannelList from './groups/MobileGroupChannelList';
import LandscapeWayfinding from './components/LandscapeWayfinding';
import { useScheduler } from './state/scheduler';
import { LeapProvider } from './components/Leap/useLeap';
import VitaMessage from './components/VitaMessage';
import Dialog, { DialogContent } from './components/Dialog';
import useIsStandaloneMode from './logic/useIsStandaloneMode';
import Eyrie from './components/Eyrie';
import queryClient from './queryClient';
import EmojiPicker from './components/EmojiPicker';

const Grid = React.lazy(() => import('./components/Grid/grid'));
const TileInfo = React.lazy(() => import('./components/Grid/tileinfo'));
const AppModal = React.lazy(() => import('./components/Grid/appmodal'));

function SuspendedModal({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Dialog defaultOpen modal>
          <DialogContent className="bg-transparent" containerClass="w-full">
            <LoadingSpinner />
          </DialogContent>
        </Dialog>
      }
    >
      {children}
    </Suspense>
  );
}

const DiaryAddNote = React.lazy(() => import('./diary/diary-add-note'));
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
          <Route path="/about" element={<AboutDialog />} />
          <Route
            path="/grid"
            element={
              <SuspendedModal>
                <Grid />
              </SuspendedModal>
            }
          />
          <Route
            path="/app/:desk"
            element={
              <SuspendedModal>
                <AppModal />
              </SuspendedModal>
            }
          />
          <Route
            path="/app/:desk/info"
            element={
              <SuspendedModal>
                <TileInfo />
              </SuspendedModal>
            }
          />
          <Route path="/dm/:id/edit-info" element={<MultiDMEditModal />} />
          <Route path="/profile/:ship" element={<ProfileModal />} />
          <Route path="/gangs/:ship/:name" element={<JoinGroupModal />} />
          <Route
            path="/gangs/:ship/:name/reject"
            element={<RejectConfirmModal />}
          />
          {isMobile ? (
            <>
              <Route
                path="/groups/:ship/:name/channels/chat/:chShip/:chName/picker/:writShip/:writTime"
                element={<EmojiPicker />}
              />
              <Route
                path="/dm/:ship/picker/:writShip/:writTime"
                element={<EmojiPicker />}
              />
            </>
          ) : null}
        </Routes>
      ) : null}
    </>
  );
}

function HomeRoute({
  isMobile = true,
  isInGroups = false,
}: {
  isMobile: boolean;
  isInGroups: boolean;
}) {
  if (!isInGroups) {
    return <FindGroups title={`Find Groups • ${appHead('').title}`} />;
  }

  if (isMobile && isInGroups) {
    return <MobileGroupsNavHome />;
  }

  return (
    <Notifications
      child={GroupNotification}
      title={`All Notifications • ${appHead('').title}`}
    />
  );
}

function ActivityRoute({ isInGroups = false }: { isInGroups: boolean }) {
  if (!isInGroups) {
    return <FindGroups title={`Find Groups • ${appHead('').title}`} />;
  }

  return (
    <Notifications
      child={GroupNotification}
      title={`All Notifications • ${appHead('').title}`}
    />
  );
}

function GroupsRoutes({ state, location, isMobile, isSmall }: RoutesProps) {
  const groups = queryClient.getQueryCache().find(['groups'])?.state.data;
  const isInGroups = groups !== undefined ? !_.isEmpty(groups) : true;

  return (
    <>
      <Routes location={state?.backgroundLocation || location}>
        <Route element={<GroupsNav />}>
          <Route element={isMobile ? <MobileSidebar /> : undefined}>
            <Route
              index
              element={
                <HomeRoute isMobile={isMobile} isInGroups={isInGroups} />
              }
            />
            <Route
              path="/notifications"
              element={<ActivityRoute isInGroups={isInGroups} />}
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
            <Route
              path="/leap"
              element={
                <MainWrapper title="Leap" isMobile={isMobile}>
                  <Leap openDefault />
                </MainWrapper>
              }
            />
          </Route>
          <Route path="/groups/:ship/:name" element={<Groups />}>
            <Route element={isMobile ? <MobileGroupSidebar /> : undefined}>
              <Route
                index
                element={isMobile ? <MobileGroupChannelList /> : null}
              />
              <Route
                path="activity"
                element={
                  <Notifications
                    child={GroupNotification}
                    title={`• ${appHead('').title}`}
                  />
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
              </Route>
              <Route
                path="channels"
                element={
                  <GroupChannelManager title={` • ${appHead('').title}`} />
                }
              />
            </Route>
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
          <Route path="/about" element={<AboutDialog />} />
          <Route
            path="/grid"
            element={
              <SuspendedModal>
                <Grid />
              </SuspendedModal>
            }
          />
          <Route
            path="/app/:desk"
            element={
              <SuspendedModal>
                <AppModal />
              </SuspendedModal>
            }
          />
          <Route
            path="/app/:desk/info"
            element={
              <SuspendedModal>
                <TileInfo />
              </SuspendedModal>
            }
          />
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
          {isMobile ? (
            <Route
              path="/groups/:ship/:name/channels/chat/:chShip/:chName/picker/:writShip/:writTime"
              element={<EmojiPicker />}
            />
          ) : null}
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
    fetch('/~/name')
      .then((res) => res.text())
      .then((name) => {
        if (name !== preSig(window.ship)) {
          authRedirect();
        }
      })
      .catch(() => {
        authRedirect();
      });
  }
}

function handleGridRedirect(navigate: NavigateFunction) {
  const query = new URLSearchParams(window.location.search);

  if (query.has('grid-note')) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    navigate(decodeURIComponent(query.get('grid-note')!));
  } else if (query.has('grid-link')) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    navigate(decodeURIComponent(query.get('grid-link')!));
  }
}

function Scheduler() {
  useScheduler();
  return null;
}

function App() {
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isSmall = useMedia('(max-width: 1023px)');
  const settingsLoaded = useSettingsLoaded();
  const { disableWayfinding } = useCalm();

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

  return (
    <div className="flex h-full w-full flex-col">
      {settingsLoaded && !disableWayfinding && <LandscapeWayfinding />}
      <DisconnectNotice />
      <UpdateNotice />
      <LeapProvider>
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
        <Leap />
      </LeapProvider>
      <VitaMessage />
    </div>
  );
}

function RoutedApp() {
  const mode = import.meta.env.MODE;
  const app = import.meta.env.VITE_APP;
  const [userThemeColor, setUserThemeColor] = useState('#ffffff');
  const isStandAlone = useIsStandaloneMode();
  const body = document.querySelector('body');

  const basename = (appName: string) => {
    if (mode === 'mock' || mode === 'staging') {
      return '/';
    }

    switch (appName) {
      case 'chat':
        return isStandAlone ? '/apps/talk/' : '/apps/talk';
      default:
        return isStandAlone ? '/apps/groups/' : '/apps/groups';
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

  useEffect(() => {
    if (isStandAlone) {
      // this is necessary for the desktop PWA to not have extra padding at the bottom.
      body?.style.setProperty('padding-bottom', '0px');
    }
  }, [isStandAlone, body]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorAlert}
      onReset={() => window.location.reload()}
    >
      <Router basename={basename(app)}>
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
        <PersistQueryClientProvider
          client={queryClient}
          persistOptions={{
            persister: indexedDBPersistor(`${window.our}-landscape`),
          }}
        >
          <TooltipProvider skipDelayDuration={400}>
            <App />
            <Scheduler />
            {import.meta.env.DEV && <Eyrie />}
          </TooltipProvider>
          <ReactQueryDevtools initialIsOpen={false} />
        </PersistQueryClientProvider>
      </Router>
    </ErrorBoundary>
  );
}

export default RoutedApp;
