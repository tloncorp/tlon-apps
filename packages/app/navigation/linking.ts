import type { LinkingOptions, PathConfig } from '@react-navigation/native';

import {
  DesktopBasePathStackParamList,
  MobileBasePathStackParamList,
} from './BasePathNavigator';
import type { RootStackParamList } from './types';

export const getMobileLinkingConfig = (
  mode: string
): LinkingOptions<MobileBasePathStackParamList> => {
  // Contacts and the rest are root-stack screens above the sections. A cold
  // link straight to one would otherwise build a stack with nothing beneath
  // it, so back does nothing and the drawer marks no section.
  const mainPathConfig: PathConfig<RootStackParamList> = {
    initialRouteName: 'MainTabs',
    screens: {
      MainTabs: {
        screens: {
          BotChat: 'bot',
          ChatList: 'ChatList',
          Activity: 'activity',
          Settings: 'settings',
        },
      },
      Contacts: 'contacts',
      DM: {
        path: 'dm/:channelId/:selectedPostId?',
        parse: parsePathParams('channelId', 'selectedPostId'),
      },
      GroupDM: {
        path: 'group-dm/:channelId/:selectedPostId?',
        parse: parsePathParams('contactId', 'selectedPostId'),
      },
      Channel: {
        path: 'group/:groupId/channel/:channelId/:selectedPostId?',
        parse: parsePathParams('channelId', 'groupId', 'selectedPostId'),
      },
      NotesDetail: {
        path: 'group/:groupId/channel/:channelId/note/:noteId',
        parse: {
          ...parsePathParams('channelId', 'groupId'),
          noteId: Number,
        },
      },
      NotesFolder: {
        path: 'group/:groupId/channel/:channelId/folder/:folderId',
        parse: {
          ...parsePathParams('channelId', 'groupId'),
          folderId: Number,
        },
      },
      ChannelSearch: { path: 'channel/:channelId/search' },
      NotesSearch: {
        path: 'channel/:channelId/search-notes',
        parse: parsePathParams('channelId'),
      },
      ContextLensRuns: { path: 'lens/runs' },
      ContextLensRun: {
        path: 'lens/run/:botShip/:lensId',
        parse: parsePathParams('botShip', 'lensId'),
      },
      Post: postScreenConfig(mode),
      MediaViewer: 'media-viewer/:mediaType',
      ChatDetails: {
        path: 'chat-details/:chatType/:chatId',
        parse: parsePathParams('chatType', 'chatId'),
      },
      GroupSettings: {
        screens: {
          GroupMeta: {
            path: 'group/:groupId/meta',
            parse: parsePathParams('groupId'),
          },
          GroupMembers: {
            path: 'group/:groupId/members',
            parse: parsePathParams('groupId'),
          },
          ManageChannels: {
            path: 'group/:groupId/manage-channels',
            parse: parsePathParams('groupId'),
          },
          Privacy: {
            path: 'group/:groupId/privacy',
            parse: parsePathParams('groupId'),
          },
          GroupRoles: {
            path: 'group/:groupId/roles',
            parse: parsePathParams('groupId'),
          },
          EditChannelMeta: {
            path: 'group/:groupId/channel/:channelId/edit-meta',
            parse: parsePathParams('groupId', 'channelId'),
          },
          EditChannelPrivacy: {
            path: 'group/:groupId/channel/:channelId/edit-privacy',
            parse: parsePathParams('groupId', 'channelId'),
          },
        },
      },
      AppSettings: 'app-settings',
      FeatureFlags: 'feature-flags',
      ManageAccount: 'manage-account',
      BlockedUsers: 'blocked-users',
      WompWomp: 'report-bug',
      AppInfo: 'app-info',
      PushNotificationSettings: 'push-notification-settings',
    },
  };

  return {
    prefixes: [],
    config: {
      screens: {
        Root: {
          path: basePathForMode(mode),
          // `PathConfigMap` stops resolving a param list through two levels
          // of `NavigatorScreenParams`, so this slot types as `any`. The
          // annotation on `mainPathConfig` above is what actually checks the
          // stack's screens.
          screens: { Main: mainPathConfig },
        },
      },
    },
  };
};

export const getDesktopLinkingConfig = (
  mode: string
): LinkingOptions<DesktopBasePathStackParamList> => ({
  prefixes: [],
  config: {
    screens: {
      Root: {
        path: basePathForMode(mode),
        initialRouteName: 'Home',
        screens: {
          Activity: 'activity',
          Contacts: 'contacts',
          Home: {
            path: '',
            screens: {
              ChatList: '',
              GroupChannels: 'group/:groupId',
              DM: {
                path: 'dm/:channelId',
                parse: parsePathParams('channelId'),
                screens: {
                  ChannelRoot: '',
                },
              },
              GroupDM: {
                path: 'group-dm/:channelId/',
                parse: parsePathParams('channelId'),
                screens: {
                  ChannelRoot: '',
                },
              },
              ChatDetails: {
                path: 'chat-details/:chatType/:chatId',
                parse: parsePathParams('chatType', 'chatId'),
              },
              Channel: {
                initialRouteName: 'ChannelRoot',
                path: 'group/:groupId/channel/:channelId',
                parse: parsePathParams('channelId', 'groupId'),
                screens: {
                  ChannelRoot: {
                    path: '',
                  },
                  UserProfile: {
                    path: 'profile/:userId',
                    parse: parsePathParams('userId'),
                    exact: true,
                  },
                  EditProfile: {
                    path: 'profile/:userId/edit',
                    parse: parsePathParams('userId'),
                    exact: true,
                  },
                  ChannelMembers: {
                    path: 'group/:groupId/channel/:channelId/members',
                    parse: parsePathParams('channelId'),
                    exact: true,
                  },
                  ChannelMeta: {
                    path: 'group/:groupId/channel/:channelId/meta',
                    parse: parsePathParams('channelId'),
                    exact: true,
                  },
                  GroupSettings: {},
                  ChannelSearch: {},
                  NotesDetail: {
                    path: 'note/:noteId',
                    parse: { noteId: Number },
                  },
                  NotesFolder: {
                    path: 'folder/:folderId',
                    parse: { folderId: Number },
                  },
                  Post: postScreenConfig(mode),
                  MediaViewer: {},
                },
              },
            },
          },
          Settings: {
            path: 'settings',
            screens: {
              SettingsEmpty: '',
            },
          },
        },
      },
    },
  },
});

const postScreenConfig = (mode: string) => ({
  path:
    basePathForMode(mode) +
    '/group/:groupId/channel/:channelId/post/:authorId/:postId',
  parse: parsePathParams('groupId', 'channelId', 'authorId', 'postId'),
  exact: true,
});

function parsePathParams(...keys: string[]) {
  return Object.fromEntries(
    keys.map((k) => {
      return [k, (value: string) => decodeURIComponent(value)];
    })
  );
}

function basePathForMode(mode: string) {
  return mode === 'alpha' ? '/apps/tm-alpha/' : '/apps/groups/';
}
