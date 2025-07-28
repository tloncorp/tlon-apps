import type { LinkingOptions } from '@react-navigation/native';

import {
  DesktopBasePathStackParamList,
  MobileBasePathStackParamList,
} from './BasePathNavigator';

export const getMobileLinkingConfig = (
  mode: string
): LinkingOptions<MobileBasePathStackParamList> => ({
  prefixes: [],
  config: {
    screens: {
      Root: {
        path: basePathForMode(mode),
        screens: {
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
          ChatList: 'ChatList',
          ChannelSearch: { path: 'channel/:channelId/search' },
          Post: postScreenConfig(mode),
          ImageViewer: 'image-viewer/:postId',
          ChatDetails: {
            path: 'chat-details/:chatType/:chatId',
            parse: parsePathParams('chatType', 'chatId'),
          },
          GroupSettings: {
            screens: {
              EditChannel: {
                path: 'group/:groupId/channels/:channelId/edit',
                parse: parsePathParams('groupId', 'channelId'),
              },
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
            },
          },
          AppSettings: 'app-settings',
          FeatureFlags: 'feature-flags',
          ManageAccount: 'manage-account',
          BlockedUsers: 'blocked-users',
          WompWomp: 'report-bug',
          AppInfo: 'app-info',
          PushNotificationSettings: 'push-notification-settings',
          Contacts: 'contacts',
          Settings: 'settings',
        },
      },
    },
  },
});

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
                  Post: postScreenConfig(mode),
                  ImageViewer: {},
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
