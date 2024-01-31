// Copyright 2022, Tlon Corporation
import cookies from 'browser-cookies';
import React, { Suspense, useEffect, useMemo, useState } from 'react';
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
import { usePostHog } from 'posthog-js/react';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import Groups from '@/groups/Groups';
import { IS_MOCK } from '@/api';
import Dms from '@/dms/Dms';
import NewDM from '@/dms/NewDm';
import ChatThread from '@/chat/ChatThread/ChatThread';
import useMedia, { useIsDark, useIsMobile } from '@/logic/useMedia';
import useErrorHandler from '@/logic/useErrorHandler';
import {
  useAnalyticsId,
  useCalm,
  useLogActivity,
  useSettingsLoaded,
  useTheme,
} from '@/state/settings';
import { toggleDevTools, useLocalState, useShowDevTools } from '@/state/local';
import ErrorAlert from '@/components/ErrorAlert';
import DMHome from '@/dms/DMHome';
import GroupsNav from '@/nav/GroupsNav';
import GroupInviteDialog from '@/groups/GroupInviteDialog';
import GroupLeaveDialog from '@/groups/GroupLeaveDialog';
import Message from '@/dms/Message';
import GroupAdmin from '@/groups/GroupAdmin/GroupAdmin';
import GroupDelete from '@/groups/GroupAdmin/GroupDelete';
import GroupChannelManager from '@/groups/ChannelsList/GroupChannelManager';
import GroupInfo from '@/groups/GroupAdmin/GroupInfo';
import ProfileModal from '@/profiles/ProfileModal';
import MultiDMEditModal from '@/dms/MultiDMEditModal';
import NewChannelModal from '@/channels/NewChannel/NewChannelModal';
import FindGroups from '@/groups/FindGroups';
import GroupPreviewModal from '@/groups/Join/GroupPreview';
import RejectConfirmModal from '@/groups/Join/RejectConfirmModal';
import EditProfile from '@/profiles/EditProfile/EditProfile';
import HeapDetail from '@/heap/HeapDetail';
import groupsFavicon from '@/assets/groups.svg';
import talkFavicon from '@/assets/talk.svg';
import GroupInvitesPrivacy from '@/groups/GroupAdmin/GroupInvitesPrivacy';
import Notifications from '@/notifications/Notifications';
import ChatChannel from '@/chat/ChatChannel';
import HeapChannel from '@/heap/HeapChannel';
import DiaryChannel from '@/diary/DiaryChannel';
import DiaryNote from '@/diary/DiaryNote';
import DMNotification from '@/notifications/DMNotification';
import GroupNotification from '@/notifications/GroupNotification';
import EditCurioModal from '@/heap/EditCurioModal';
import Members from '@/groups/Members';
import GroupMembers from '@/groups/GroupAdmin/GroupMembers';
import GroupRoles from '@/groups/GroupAdmin/GroupRoles';
import GroupInfoEditor from '@/groups/GroupAdmin/GroupInfoEditor';
import LoadingSpinner from '@/components/LoadingSpinner/LoadingSpinner';
import DisconnectNotice from '@/components/DisconnectNotice';
import TalkNav from '@/nav/TalkNav';
import TalkHead from '@/dms/TalkHead';
import MobileMessagesSidebar from '@/dms/MobileMessagesSidebar';
import MobileSidebar from '@/components/Sidebar/MobileSidebar';
import MobileGroupsNavHome from '@/nav/MobileRoot';
import Leap from '@/components/Leap/Leap';
import { isTalk, preSig } from '@/logic/utils';
import bootstrap from '@/state/bootstrap';
import AboutDialog from '@/components/About/AboutDialog';
import MobileGroupChannelList from '@/groups/MobileGroupChannelList';
import LandscapeWayfinding, {
  LandscapeWayfindingModal,
} from '@/components/LandscapeWayfinding';
import { useScheduler } from '@/state/scheduler';
import { LeapProvider } from '@/components/Leap/useLeap';
import VitaMessage from '@/components/VitaMessage';
import Dialog from '@/components/Dialog';
import useIsStandaloneMode from '@/logic/useIsStandaloneMode';
import EmojiPicker from '@/components/EmojiPicker';
import SettingsDialog from '@/components/Settings/SettingsDialog';
import {
  ANALYTICS_DEFAULT_PROPERTIES,
  captureAnalyticsEvent,
  captureError,
} from '@/logic/analytics';
import GroupChannel from '@/groups/GroupChannel';
import PrivacyNotice from '@/groups/PrivacyNotice';
import ActivityModal, { ActivityChecker } from '@/components/ActivityModal';
import Profile from '@/profiles/Profile';
import SettingsView from '@/components/Settings/SettingsView';
import AboutView from '@/components/About/AboutView';
import { DragAndDropProvider } from '@/logic/DragAndDropContext';
import LureAutojoiner from '@/groups/LureAutojoiner';
import { isNativeApp, postActionToNativeApp } from '@/logic/native';
import NewGroupDialog from './groups/NewGroup/NewGroupDialog';
import NewGroupView from './groups/NewGroup/NewGroupView';
import EyrieMenu from './eyrie/EyrieMenu';
import GroupVolumeDialog from './groups/GroupVolumeDialog';
import ChannelVolumeDialog from './channels/ChannelVolumeDialog';
import DMThread from './dms/DMThread';
import MobileChatSearch from './chat/ChatSearch/MobileChatSearch';
import MobileDmSearch from './dms/MobileDmSearch';
import BlockedUsersView from './components/Settings/BlockedUsersView';
import BlockedUsersDialog from './components/Settings/BlockedUsersDialog';
import { ChatInputFocusProvider } from './logic/ChatInputFocusContext';
import UpdateNoticeSheet from './components/UpdateNotices';
import useAppUpdates, { AppUpdateContext } from './logic/useAppUpdates';
import { CreateGroupDialog } from './groups/AddGroup/CreateGroup';
import { JoinGroupDialog } from './groups/AddGroup/JoinGroup';
import ReportContent from './components/ReportContent';

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
            {isSmall && (
              <Route
                path=":ship/message/:idShip/:idTime"
                element={<DMThread />}
              />
            )}
            {isMobile && (
              <Route path=":ship/search/:query?" element={<MobileDmSearch />} />
            )}
          </Route>

          <Route path="/groups/:ship/:name/*" element={<Groups />}>
            <Route
              path="channels/chat/:chShip/:chName"
              element={<GroupChannel type="chat" />}
            >
              <Route
                path="*"
                element={<ChatChannel title={` • ${appHead('').title}`} />}
              />
              {isSmall ? (
                <Route path="message/:idTime" element={<ChatThread />} />
              ) : null}
              {isMobile && (
                <Route path="search/:query?" element={<MobileChatSearch />} />
              )}
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
          <Route path="/settings" element={<SettingsDialog />} />
          <Route path="/wayfinding" element={<LandscapeWayfindingModal />} />
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
          <Route path="/report-content" element={<ReportContent />} />
          <Route path="/profile/:ship" element={<ProfileModal />} />
          <Route path="/gangs/:ship/:name" element={<GroupPreviewModal />} />
          <Route
            path="/gangs/:ship/:name/reject"
            element={<RejectConfirmModal />}
          />
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
                path="/dm/:ship/picker/:writShip/:writTime"
                element={<EmojiPicker />}
              />
              <Route
                path="/dm/:ship/message/:idShip/:idTime/picker/:writShip/:writTime"
                element={<EmojiPicker />}
              />
            </>
          ) : null}
        </Routes>
      ) : null}
    </>
  );
}

function HomeRoute({ isMobile = true }: { isMobile: boolean }) {
  if (isMobile) {
    return <MobileGroupsNavHome />;
  }

  return (
    <Notifications
      child={GroupNotification}
      title={`Activity • ${appHead('').title}`}
    />
  );
}

function GroupsRoutes({ state, location, isMobile, isSmall }: RoutesProps) {
  const groupsTitle = appHead('').title;
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
        <Route element={<GroupsNav />}>
          <Route element={isMobile ? <MobileSidebar /> : undefined}>
            <Route index element={<HomeRoute isMobile={isMobile} />} />
            <Route
              path="/notifications"
              element={
                <Notifications
                  child={GroupNotification}
                  title={`Activity • ${groupsTitle}`}
                />
              }
            />
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

              <Route path=":ship" element={<Message />}>
                {isSmall ? null : (
                  <Route
                    path="message/:idShip/:idTime"
                    element={<DMThread />}
                  />
                )}
              </Route>

              <Route path="groups/:ship/:name/*" element={<Groups />}>
                <Route
                  path="channels/chat/:chShip/:chName"
                  element={<GroupChannel type="chat" />}
                >
                  <Route
                    path="*"
                    element={<ChatChannel title={` • ${appHead('').title}`} />}
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
            {/* Find by Invite URL */}
            <Route
              path="/find/:ship/:name"
              element={<FindGroups title={`Discover • ${groupsTitle}`} />}
            />
            {/* Find by Nickname or @p */}
            <Route
              path="/find/:ship"
              element={<FindGroups title={`Discover • ${groupsTitle}`} />}
            />
            <Route
              path="/find"
              element={<FindGroups title={`Discover • ${groupsTitle}`} />}
            />
            <Route
              path="/profile/edit"
              element={<EditProfile title={`Edit Profile • ${groupsTitle}`} />}
            />
            <Route
              path="/profile"
              element={<Profile title={`Profile • ${groupsTitle}`} />}
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
            <Route path="/groups/new-mobile" element={<NewGroupView />} />
            <Route path="/leap" element={<Leap openDefault />} />
            <Route path="/groups/:ship/:name" element={<Groups />}>
              <Route element={isMobile ? <MobileSidebar /> : undefined}>
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
              </Route>
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
        </Route>
      </Routes>
      {state?.backgroundLocation ? (
        <Routes>
          <Route path="/about" element={<AboutDialog />} />
          <Route path="/privacy" element={<PrivacyNotice />} />
          <Route path="/settings" element={<SettingsDialog />} />
          <Route path="/blocked" element={<BlockedUsersDialog />} />
          <Route path="/wayfinding" element={<LandscapeWayfindingModal />} />
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
          <Route
            path="/groups/:ship/:name/info"
            element={<GroupInfo title={`• ${groupsTitle}`} />}
          />
          <Route
            path="/groups/:ship/:name/volume"
            element={<GroupVolumeDialog title={`• ${groupsTitle}`} />}
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
  const navigate = useNavigate();
  const handleError = useErrorHandler();
  const location = useLocation();
  const isMobile = useIsMobile();
  const isSmall = useMedia('(max-width: 1023px)');
  const { disableWayfinding } = useCalm();

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

  useEffect(() => {
    if (!isMobile) return;
    if (location.pathname === '/' || location.pathname.startsWith('/groups')) {
      useLocalState.setState({ groupsLocation: location.pathname });
    } else if (
      location.pathname.startsWith('/messages') ||
      location.pathname.startsWith('/dm')
    ) {
      useLocalState.setState({ messagesLocation: location.pathname });
    }
  }, [location, isMobile]);

  const state = location.state as { backgroundLocation?: Location } | null;

  return (
    <div className="flex h-full w-full flex-col">
      {!disableWayfinding && !isMobile && <LandscapeWayfinding />}
      <DisconnectNotice />
      <LeapProvider>
        <ChatInputFocusProvider>
          <DragAndDropProvider>
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
          </DragAndDropProvider>
        </ChatInputFocusProvider>
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
  const showDevTools = useShowDevTools();
  const isStandAlone = useIsStandaloneMode();
  const logActivity = useLogActivity();
  const posthog = usePostHog();
  const analyticsId = useAnalyticsId();
  const { needsUpdate, triggerUpdate } = useAppUpdates();
  const body = document.querySelector('body');
  const colorSchemeFromNative = window.colorscheme;

  const appUpdateContextValue = useMemo(
    () => ({ needsUpdate, triggerUpdate }),
    [needsUpdate, triggerUpdate]
  );

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
