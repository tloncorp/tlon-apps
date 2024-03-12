// Copyright 2022, Tlon Corporation
import { TooltipProvider } from '@radix-ui/react-tooltip';
import cookies from 'browser-cookies';
import { usePostHog } from 'posthog-js/react';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { Helmet } from 'react-helmet';
import {
  Location,
  NavigateFunction,
  Route,
  BrowserRouter as Router,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';

import { IS_MOCK } from '@/api';
import NewChannelModal from '@/channels/NewChannel/NewChannelModal';
import ChatChannel from '@/chat/ChatChannel';
import ChatThread from '@/chat/ChatThread/ChatThread';
import AboutDialog from '@/components/About/AboutDialog';
import AboutView from '@/components/About/AboutView';
import ActivityModal, { ActivityChecker } from '@/components/ActivityModal';
import Dialog from '@/components/Dialog';
import DisconnectNotice from '@/components/DisconnectNotice';
import EmojiPicker from '@/components/EmojiPicker';
import ErrorAlert from '@/components/ErrorAlert';
import Leap from '@/components/Leap/Leap';
import { LeapProvider } from '@/components/Leap/useLeap';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import SettingsDialog from '@/components/Settings/SettingsDialog';
import SettingsView from '@/components/Settings/SettingsView';
import AppNav from '@/components/Sidebar/AppNav';
import DiaryChannel from '@/diary/DiaryChannel';
import DiaryNote from '@/diary/DiaryNote';
import DMHome from '@/dms/DMHome';
import Dms from '@/dms/Dms';
import Message from '@/dms/Message';
import MobileMessagesSidebar from '@/dms/MobileMessagesSidebar';
import MultiDMEditModal from '@/dms/MultiDMEditModal';
import NewDM from '@/dms/NewDm';
import GroupChannelManager from '@/groups/ChannelsList/GroupChannelManager';
import GroupAdmin from '@/groups/GroupAdmin/GroupAdmin';
import GroupDelete from '@/groups/GroupAdmin/GroupDelete';
import GroupInfo from '@/groups/GroupAdmin/GroupInfo';
import GroupInfoEditor from '@/groups/GroupAdmin/GroupInfoEditor';
import GroupInvitesPrivacy from '@/groups/GroupAdmin/GroupInvitesPrivacy';
import GroupMembers from '@/groups/GroupAdmin/GroupMembers';
import GroupRoles from '@/groups/GroupAdmin/GroupRoles';
import GroupChannel from '@/groups/GroupChannel';
import GroupInviteDialog from '@/groups/GroupInviteDialog';
import GroupLeaveDialog from '@/groups/GroupLeaveDialog';
import Groups from '@/groups/Groups';
import GroupPreviewModal from '@/groups/Join/GroupPreview';
import RejectConfirmModal from '@/groups/Join/RejectConfirmModal';
import LureAutojoiner from '@/groups/LureAutojoiner';
import Members from '@/groups/Members';
import MobileGroupChannelList from '@/groups/MobileGroupChannelList';
import PrivacyNotice from '@/groups/PrivacyNotice';
import EditCurioModal from '@/heap/EditCurioModal';
import HeapChannel from '@/heap/HeapChannel';
import HeapDetail from '@/heap/HeapDetail';
import { DragAndDropProvider } from '@/logic/DragAndDropContext';
import {
  ANALYTICS_DEFAULT_PROPERTIES,
  captureAnalyticsEvent,
  captureError,
} from '@/logic/analytics';
import {
  isNativeApp,
  postActionToNativeApp,
  useNativeBridge,
} from '@/logic/native';
import useErrorHandler from '@/logic/useErrorHandler';
import useIsStandaloneMode from '@/logic/useIsStandaloneMode';
import useMedia, { useIsDark, useIsMobile } from '@/logic/useMedia';
import { preSig } from '@/logic/utils';
import GroupsNav from '@/nav/GroupsNav';
import MobileGroupsNavHome from '@/nav/MobileRoot';
import GroupNotification from '@/notifications/GroupNotification';
import Notifications from '@/notifications/Notifications';
import EditProfile from '@/profiles/EditProfile/EditProfile';
import Profile from '@/profiles/Profile';
import ProfileModal from '@/profiles/ProfileModal';
import bootstrap from '@/state/bootstrap';
import { toggleDevTools, useLocalState, useShowDevTools } from '@/state/local';
import { useScheduler } from '@/state/scheduler';
import {
  useAnalyticsId,
  useLogActivity,
  useSettingsLoaded,
  useTheme,
} from '@/state/settings';

import ChannelInfo from './channels/ChannelInfo';
import ChannelVolumeDialog from './channels/ChannelVolumeDialog';
import MobileChatSearch from './chat/ChatSearch/MobileChatSearch';
import ReportContent from './components/ReportContent';
import BlockedUsersDialog from './components/Settings/BlockedUsersDialog';
import BlockedUsersView from './components/Settings/BlockedUsersView';
import UpdateNoticeSheet from './components/UpdateNotices';
import DMThread from './dms/DMThread';
import MobileDmSearch from './dms/MobileDmSearch';
import EyrieMenu from './eyrie/EyrieMenu';
import { CreateGroupDialog } from './groups/AddGroup/CreateGroup';
import { JoinGroupDialog } from './groups/AddGroup/JoinGroup';
import GroupVolumeDialog from './groups/GroupVolumeDialog';
import NewGroupDialog from './groups/NewGroup/NewGroupDialog';
import NewGroupView from './groups/NewGroup/NewGroupView';
import { ChatInputFocusProvider } from './logic/ChatInputFocusContext';
import useAppUpdates, { AppUpdateContext } from './logic/useAppUpdates';
import ShareDMLure from './profiles/ShareDMLure';
import { useChannelsFirehose } from './state/channel/channel';

const ReactQueryDevtoolsProduction = React.lazy(() =>
  import('@tanstack/react-query-devtools/build/lib/index.prod.js').then(
    (d) => ({
      default: d.ReactQueryDevtools,
    })
  )
);

const Grid = React.lazy(() => import('./components/Grid/grid'));
const TileInfo = React.lazy(() => import('./components/Grid/tileinfo'));
const AppModal = React.lazy(() => import('./components/Grid/appmodal'));

function SuspendedModal({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <Dialog defaultOpen modal className="bg-transparent" close="none">
          <LoadingSpinner />
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

interface RoutesProps {
  state: { backgroundLocation?: Location } | null;
  location: Location;
  isMobile: boolean;
  isSmall: boolean;
}

function GroupsRoutes({ state, location, isMobile, isSmall }: RoutesProps) {
  const groupsTitle = 'Tlon';
  const loaded = useSettingsLoaded();

  useEffect(() => {
    if (loaded) {
      captureAnalyticsEvent('app_open');
    }

    return () => {
      if (loaded) {
        captureAnalyticsEvent('app_close');
      }
    };
  }, [loaded]);

  return (
    <>
      <ActivityChecker />
      <Routes location={state?.backgroundLocation || location}>
        <Route element={<AppNav />}>
          <Route element={<GroupsNav />}>
            <Route path="/groups" element={<GroupsNav />} />
            <Route index element={isMobile ? <MobileGroupsNavHome /> : null} />
            <Route
              path="/messages"
              element={isMobile ? <MobileMessagesSidebar /> : null}
            />
            <Route path="/dm/" element={<Dms />}>
              <Route index element={<DMHome />} />
              <Route path="new">
                <Route index element={<NewDM />} />
                <Route path=":ship" element={<Message />} />
              </Route>

              <Route path=":ship">
                <Route index element={<Message />} />
                <Route path="*" element={<Message />}>
                  {isSmall ? null : (
                    <Route
                      path="message/:idShip/:idTime"
                      element={<DMThread />}
                    />
                  )}
                </Route>
              </Route>

              <Route path="groups/:ship/:name/*" element={<Groups />}>
                <Route
                  path="channels/chat/:chShip/:chName"
                  element={<GroupChannel type="chat" />}
                >
                  <Route
                    path="*"
                    element={<ChatChannel title={` • ${groupsTitle}`} />}
                  />
                  {isSmall ? (
                    <Route path="message/:idTime" element={<ChatThread />} />
                  ) : null}
                  {isMobile && (
                    <Route
                      path="search/:query?"
                      element={<MobileChatSearch />}
                    />
                  )}
                </Route>
              </Route>
              {isSmall && (
                <Route
                  path=":ship/search/:query?"
                  element={<MobileDmSearch />}
                />
              )}
              {isSmall && (
                <Route
                  path=":ship/message/:idShip/:idTime"
                  element={<DMThread />}
                />
              )}
            </Route>
            <Route path="/groups/new-mobile" element={<NewGroupView />} />
            <Route path="/leap" element={<Leap openDefault />} />
            <Route path="/groups/:ship/:name" element={<Groups />}>
              <Route
                index
                element={isMobile ? <MobileGroupChannelList /> : null}
              />
              <Route
                path="activity"
                element={
                  <Notifications
                    child={GroupNotification}
                    title={`• ${groupsTitle}`}
                  />
                }
              />
              <Route
                path="channels"
                element={<GroupChannelManager title={` • ${groupsTitle}`} />}
              />
              <Route path="members" element={<Members />} />
              <Route path="/groups/:ship/:name/edit" element={<GroupAdmin />}>
                {!isMobile && (
                  <>
                    <Route
                      path="info"
                      element={<GroupInfoEditor title={`• ${groupsTitle}`} />}
                    />
                    <Route
                      path="invites-privacy"
                      element={
                        <GroupInvitesPrivacy title={`• ${groupsTitle}`} />
                      }
                    />
                    <Route
                      path="members"
                      element={<GroupMembers title={`• ${groupsTitle}`} />}
                    />

                    <Route
                      path="roles"
                      element={<GroupRoles title={`• ${groupsTitle}`} />}
                    />
                    <Route path="delete" element={<GroupDelete />} />
                  </>
                )}
              </Route>
              {isMobile && (
                <>
                  <Route
                    path="/groups/:ship/:name/edit/info"
                    element={<GroupInfoEditor title={`• ${groupsTitle}`} />}
                  />
                  <Route
                    path="/groups/:ship/:name/edit/invites-privacy"
                    element={<GroupInvitesPrivacy title={`• ${groupsTitle}`} />}
                  />
                  <Route
                    path="/groups/:ship/:name/edit/members"
                    element={<GroupMembers title={`• ${groupsTitle}`} />}
                  />
                  <Route
                    path="/groups/:ship/:name/edit/roles"
                    element={<GroupRoles title={`• ${groupsTitle}`} />}
                  />
                  <Route
                    path="/groups/:ship/:name/edit/delete"
                    element={<GroupDelete />}
                  />
                </>
              )}
              <Route
                path="channels/chat/:chShip/:chName"
                element={<GroupChannel type="chat" />}
              >
                <Route
                  index
                  element={<ChatChannel title={` • ${groupsTitle}`} />}
                />
                <Route
                  path="*"
                  element={<ChatChannel title={` • ${groupsTitle}`} />}
                >
                  {isSmall ? null : (
                    <Route
                      path="message/:idTime/:idReplyTime?"
                      element={<ChatThread />}
                    />
                  )}
                </Route>
                {isSmall ? (
                  <Route
                    path="message/:idTime/:idReplyTime?"
                    element={<ChatThread />}
                  />
                ) : null}
                {isMobile && (
                  <Route path="search/:query?" element={<MobileChatSearch />} />
                )}
              </Route>
              <Route
                path="channels/heap/:chShip/:chName"
                element={<GroupChannel type="heap" />}
              >
                <Route
                  index
                  element={<HeapChannel title={` • ${groupsTitle}`} />}
                />
                <Route
                  path="curio/:idTime/:idReplyTime?"
                  element={<HeapDetail title={` • ${groupsTitle}`} />}
                />
              </Route>
              <Route
                path="channels/diary/:chShip/:chName"
                element={<GroupChannel type="diary" />}
              >
                <Route
                  index
                  element={<DiaryChannel title={` • ${groupsTitle}`} />}
                />
                <Route
                  path="note/:noteId/:idReplyTime?"
                  element={<DiaryNote title={` • ${groupsTitle}`} />}
                />
                <Route path="edit">
                  <Route index element={SuspendedDiaryAddNote} />
                  <Route path=":id" element={SuspendedDiaryAddNote} />
                </Route>
              </Route>
            </Route>
          </Route>
          <Route
            path="/notifications"
            element={
              <Notifications
                child={GroupNotification}
                title={`Activity • ${groupsTitle}`}
              />
            }
          />
          {!isMobile ? (
            <Route
              path="/profile"
              element={<Profile title={`Profile • ${groupsTitle}`} />}
            >
              <Route
                path="edit"
                element={
                  <EditProfile title={`Edit Profile • ${groupsTitle}`} />
                }
              />
              <Route
                path="share"
                element={
                  <ShareDMLure title={`Share with Friends • ${groupsTitle}`} />
                }
              />
              <Route
                path="settings"
                element={<SettingsView title={`Settings • ${groupsTitle}`} />}
              />
              <Route path="settings/blocked" element={<BlockedUsersView />} />
              <Route
                path="about"
                element={<AboutView title={`About • ${groupsTitle}`} />}
              />
            </Route>
          ) : (
            <>
              <Route
                path="/profile"
                element={<Profile title={`Profile • ${groupsTitle}`} />}
              />
              <Route
                path="/profile/edit"
                element={
                  <EditProfile title={`Edit Profile • ${groupsTitle}`} />
                }
              />
              <Route
                path="/profile/share"
                element={
                  <ShareDMLure title={`Share with Friends • ${groupsTitle}`} />
                }
              />
              <Route
                path="/profile/settings"
                element={<SettingsView title={`Settings • ${groupsTitle}`} />}
              />
              <Route
                path="/profile/settings/blocked"
                element={<BlockedUsersView />}
              />
              <Route
                path="/profile/about"
                element={<AboutView title={`About • ${groupsTitle}`} />}
              />
            </>
          )}
        </Route>
      </Routes>
      {state?.backgroundLocation ? (
        <Routes>
          <Route path="/about" element={<AboutDialog />} />
          <Route path="/privacy" element={<PrivacyNotice />} />
          <Route path="/settings" element={<SettingsDialog />} />
          <Route path="/blocked" element={<BlockedUsersDialog />} />
          <Route path="/activity-collection" element={<ActivityModal />} />
          <Route path="/add-group/create" element={<CreateGroupDialog />} />
          <Route path="/add-group/join" element={<JoinGroupDialog />} />
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
          <Route path="/groups/new" element={<NewGroupDialog />} />
          <Route path="/groups/:ship/:name">
            <Route path="invite" element={<GroupInviteDialog />} />
          </Route>
          <Route path="/groups/:ship/:name/info" element={<GroupInfo />} />
          <Route
            path="/groups/:ship/:name/volume"
            element={<GroupVolumeDialog title={`• ${groupsTitle}`} />}
          />
          <Route
            path="/groups/:ship/:name/channels/:chType/:chShip/:chName/info"
            element={<ChannelInfo />}
          />
          <Route
            path="/groups/:ship/:name/channels/:chType/:chShip/:chName/volume"
            element={<ChannelVolumeDialog title={`• ${groupsTitle}`} />}
          />
          <Route
            path="/groups/:ship/:name/leave"
            element={<GroupLeaveDialog />}
          />
          <Route path="/gangs/:ship/:name" element={<GroupPreviewModal />} />
          <Route
            path="/gangs/:ship/:name/reject"
            element={<RejectConfirmModal />}
          />
          <Route
            path="/groups/:ship/:name/channels/heap/:chShip/:chName/curio/:idTime/edit"
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
          <Route path="dm/:id/edit-info" element={<MultiDMEditModal />} />
          <Route path="/report-content" element={<ReportContent />} />
          {isMobile ? (
            <>
              <Route
                path="/groups/:ship/:name/channels/chat/:chShip/:chName/picker/:writTime"
                element={<EmojiPicker />}
              />
              <Route
                path="/groups/:ship/:name/channels/chat/:chShip/:chName/message/:idTime/picker/:writTime"
                element={<EmojiPicker />}
              />
              <Route
                path="/groups/:ship/:name/channels/chat/:chShip/:chName/message/:idTime/:idReplyTime/picker/:writTime"
                element={<EmojiPicker />}
              />
              <Route
                path="/dm/:ship/picker/:writShip/:writTime"
                element={<EmojiPicker />}
              />
              <Route
                path="/dm/:ship/message/:idShip/:idTime/picker/:writShip/:writTime"
                element={<EmojiPicker />}
              />
            </>
          ) : null}
          {isMobile && (
            <Route path="/update-needed" element={<UpdateNoticeSheet />} />
          )}
        </Routes>
      ) : null}
    </>
  );
}

function authRedirect() {
  document.location = `${document.location.protocol}//${document.location.host}`;
}

function checkIfLoggedIn() {
  if (isNativeApp()) {
    return;
  }

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

  if (query.has('landscape-note')) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    navigate(decodeURIComponent(query.get('landscape-note')!));
  } else if (query.has('grid-link')) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    navigate(decodeURIComponent(query.get('landscape-link')!));
  }
}

function Scheduler() {
  useScheduler();
  return null;
}

function App() {
  useNativeBridge();
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isSmall = useMedia('(max-width: 1023px)');

  useChannelsFirehose();
  useEffect(() => {
    if (isNativeApp()) {
      postActionToNativeApp('appLoaded');
    }
  }, []);

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
      <DisconnectNotice />
      <LeapProvider>
        <ChatInputFocusProvider>
          <DragAndDropProvider>
            <GroupsRoutes
              state={state}
              location={location}
              isMobile={isMobile}
              isSmall={isSmall}
            />
          </DragAndDropProvider>
        </ChatInputFocusProvider>
        <Leap />
      </LeapProvider>
    </div>
  );
}

function RoutedApp() {
  const mode = import.meta.env.MODE;
  const [userThemeColor, setUserThemeColor] = useState('#ffffff');
  const showDevTools = useShowDevTools();
  const isStandAlone = useIsStandaloneMode();
  const logActivity = useLogActivity();
  const posthog = usePostHog();
  const analyticsId = useAnalyticsId();
  const { needsUpdate, triggerUpdate } = useAppUpdates();
  const body = document.querySelector('body');
  const colorSchemeFromNative =
    window.nativeOptions?.colorScheme ?? window.colorscheme;

  const appUpdateContextValue = useMemo(
    () => ({ needsUpdate, triggerUpdate }),
    [needsUpdate, triggerUpdate]
  );

  const basename = () => {
    if (mode === 'mock' || mode === 'staging') {
      return '/';
    }

    return '/apps/groups';
  };

  const theme = useTheme();
  const isDarkMode = useIsDark();

  useEffect(() => {
    window.toggleDevTools = () => toggleDevTools();
  }, []);

  useEffect(() => {
    if (
      (isDarkMode && theme === 'auto') ||
      theme === 'dark' ||
      colorSchemeFromNative === 'dark'
    ) {
      document.body.classList.add('dark');
      useLocalState.setState({ currentTheme: 'dark' });
      setUserThemeColor('#000000');
    } else {
      document.body.classList.remove('dark');
      useLocalState.setState({ currentTheme: 'light' });
      setUserThemeColor('#ffffff');
    }
  }, [isDarkMode, theme, colorSchemeFromNative]);

  useEffect(() => {
    if (isStandAlone) {
      // this is necessary for the desktop PWA to not have extra padding at the bottom.
      body?.style.setProperty('padding-bottom', '0px');
    }
  }, [isStandAlone, body]);

  useEffect(() => {
    if (posthog && analyticsId !== '' && logActivity) {
      posthog.identify(analyticsId, ANALYTICS_DEFAULT_PROPERTIES);
    }
  }, [posthog, analyticsId, logActivity]);

  useEffect(() => {
    if (posthog) {
      if (showDevTools) {
        posthog.debug();
      } else {
        posthog.debug(false);
      }
    }
  }, [posthog, showDevTools]);

  return (
    <ErrorBoundary
      FallbackComponent={ErrorAlert}
      onError={(e) => captureError('app error boundary', e)}
      onReset={() => window.location.reload()}
    >
      <Router basename={basename()}>
        <Helmet>
          <title>Tlon</title>
          <meta name="theme-color" content={userThemeColor} />
        </Helmet>
        <AppUpdateContext.Provider value={appUpdateContextValue}>
          <TooltipProvider delayDuration={0} skipDelayDuration={400}>
            <App />
            <Scheduler />
          </TooltipProvider>
        </AppUpdateContext.Provider>
        <LureAutojoiner />
        {showDevTools && (
          <>
            <React.Suspense fallback={null}>
              <ReactQueryDevtoolsProduction />
            </React.Suspense>
            <div className="fixed bottom-4 right-4">
              <EyrieMenu />
            </div>
          </>
        )}
      </Router>
    </ErrorBoundary>
  );
}

export default RoutedApp;
