import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { useBranch } from '@tloncorp/app/contexts/branch';
import {
  useNavigateRoot,
  useRootNavigatorMount,
} from '@tloncorp/app/navigation/navigateRoot';
import {
  createTypedReset,
  getMainGroupRoute,
  useTypedReset,
} from '@tloncorp/app/navigation/utils';
import {
  isNativeSplitLayoutMounted,
  useIsWindowNarrow,
} from '@tloncorp/app/ui';
import * as db from '@tloncorp/shared/db';
import * as store from '@tloncorp/shared/store';
import * as notifications from 'expo-notifications';

import { useDeepLinkListener } from '../hooks/useDeepLinkListener';
import useNotificationListener, {
  getMissingNotificationTargetRecovery,
  getNotificationRouteCategory,
  groupInvitePreviewRouteStack,
} from '../hooks/useNotificationListener';
import { parseNotificationPayload } from '../lib/notificationPayload';
import {
  notificationChannelIdFromRoute,
  shouldSuppressActiveChannel,
} from '../lib/notificationPresentation';

jest.mock('@react-navigation/native', () => {
  const navigation = {};
  return { useNavigation: () => navigation };
});

jest.mock('@tloncorp/app/contexts/branch', () => {
  const branch = {
    lure: { id: 'lure-1', invitedGroupId: '~zod/g', inviteOpenedTracked: true },
    clearLure: jest.fn(),
  };
  const signupParams = {};
  return { useBranch: () => branch, useSignupParams: () => signupParams };
});

jest.mock('@tloncorp/app/contexts/ship', () => ({
  useShip: () => ({ ship: '~zod' }),
}));

jest.mock('@tloncorp/app/hooks/useAgentGroupOnboardingLock', () => {
  const gate = {
    locked: false,
    isLoading: false,
    runWhenUnlocked: async (fn: () => unknown) => ({
      ran: true,
      result: await fn(),
    }),
  };
  return { useAgentGroupOnboardingNavGate: () => gate };
});

jest.mock('@tloncorp/app/lib/notifications', () => ({
  connectNotifications: jest.fn(),
  presentContactMatchNotification: jest.fn(),
  presentContactsMatchedNotification: jest.fn(),
}));

jest.mock('@tloncorp/app/lib/pushNotifTapTelemetry', () => ({
  startPushNotifTapMeasurement: jest.fn(),
}));

jest.mock('@tloncorp/app/navigation/utils', () => ({
  createTypedReset: jest.fn(),
  getMainGroupRoute: jest.fn(),
  getTopLevelTabRoute: jest.fn((screen: string, params?: object) => ({
    name: 'MainTabs',
    params: { screen, ...(params === undefined ? {} : { params }) },
  })),
  screenNameFromChannelId: jest.fn(),
  useTypedReset: (() => {
    const reset = jest.fn();
    return () => reset;
  })(),
}));

jest.mock('@tloncorp/app/navigation/navigateRoot', () => {
  const navigateRoot = jest.fn(() => true);
  const rootNavigator = {
    isMounted: jest.fn(() => true),
    whenMounted: jest.fn(),
  };
  return {
    useNavigateRoot: () => navigateRoot,
    useRootNavigatorMount: () => rootNavigator,
  };
});

jest.mock('@tloncorp/app/ui', () => ({
  isNativeSplitLayoutMounted: jest.fn(() => false),
  useIsWindowNarrow: jest.fn(() => true),
}));

jest.mock('@tloncorp/shared', () => ({
  AnalyticsEvent: {
    ActionTappedPushNotif: 'ActionTappedPushNotif',
    ErrorNotificationService: 'ErrorNotificationService',
    ErrorPushNotifNavigate: 'ErrorPushNotifNavigate',
  },
  SyncPriority: {
    High: 10,
  },
  createDevLogger: jest.fn(() => ({
    error: jest.fn(),
    log: jest.fn(),
    trackError: jest.fn(),
    trackEvent: jest.fn(),
  })),
  trackEvent: jest.fn(),
  ensureDmInviteChannel: jest.fn(),
  setContactsMatchedHandler: jest.fn(),
  syncDms: jest.fn(),
  syncGroups: jest.fn(),
}));

jest.mock('@tloncorp/shared/db', () => ({
  getChannelWithRelations: jest.fn(),
  getPost: jest.fn(),
  getSystemContactsBatchByContactId: jest.fn(),
  isTlonEmployee: {
    useValue: jest.fn(),
  },
}));

// The real session module, so the hooks read a live desk verdict.
jest.mock('@tloncorp/shared/store', () => ({
  ...jest.requireActual<object>(
    '../../../../packages/shared/src/store/session'
  ),
  redeemInviteIfNeeded: jest.fn(() => Promise.resolve()),
}));

jest.mock('@tloncorp/shared/logic', () => ({
  getModelAnalytics: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  clearLastNotificationResponseAsync: jest.fn(),
  useLastNotificationResponse: jest.fn(),
}));

const groupDmId = '0v4.00000.qd4p2.it253.qs53q.s53qs';
const parentId =
  '~sampel-palnet/170.141.184.506.854.078.840.401.191.304.839.083.065';
const parentKey = { id: parentId, time: '0' };
const childKey = {
  id: '~sampel-palnet/170.141.184.506.854.078.980.633.339.753.179.094.450',
  time: '0',
};

function payloadFor(event: Record<string, unknown>) {
  return {
    activityEventJsonString: JSON.stringify({ event }),
  };
}

function expectBaseMeta(result: unknown) {
  expect(result).toMatchObject({ meta: { errorsFromExtension: undefined } });
}

describe('parseNotificationPayload', () => {
  it('parses single-DM invite activity', () => {
    const result = parseNotificationPayload(
      payloadFor({ 'dm-invite': { ship: '~sampel-palnet' } })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      type: 'dmInvite',
      channelId: '~sampel-palnet',
      whomType: 'ship',
    });
  });

  it('parses group-DM invite activity', () => {
    const result = parseNotificationPayload(
      payloadFor({ 'dm-invite': { club: groupDmId } })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      type: 'dmInvite',
      channelId: groupDmId,
      whomType: 'club',
    });
  });

  it('parses DM post activity', () => {
    const result = parseNotificationPayload(
      payloadFor({
        'dm-post': {
          key: childKey,
          whom: { ship: '~sampel-palnet' },
          content: [],
          mention: false,
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: '~sampel-palnet',
      postInfo: null,
    });
  });

  it('parses DM reply activity', () => {
    const result = parseNotificationPayload(
      payloadFor({
        'dm-reply': {
          parent: parentKey,
          key: childKey,
          whom: { ship: '~sampel-palnet' },
          content: [],
          mention: false,
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: '~sampel-palnet',
      postInfo: {
        id: parentId.split('/')[1],
        authorId: '~sampel-palnet',
        isDm: false,
      },
    });
  });

  it('preserves the club id for group-DM post and reply activity', () => {
    const post = parseNotificationPayload(
      payloadFor({
        'dm-post': {
          key: childKey,
          whom: { club: groupDmId },
          content: [],
          mention: false,
        },
      })
    );
    const reply = parseNotificationPayload(
      payloadFor({
        'dm-reply': {
          parent: parentKey,
          key: childKey,
          whom: { club: groupDmId },
          content: [],
          mention: false,
        },
      })
    );

    expect(post).toMatchObject({ channelId: groupDmId });
    expect(reply).toMatchObject({ channelId: groupDmId });
  });

  it('parses channel post activity', () => {
    const result = parseNotificationPayload(
      payloadFor({
        post: {
          key: childKey,
          group: '~sampel-palnet/test',
          channel: 'chat/~sampel-palnet/test',
          content: [],
          mention: false,
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: 'chat/~sampel-palnet/test',
      postInfo: null,
    });
  });

  it('parses channel reply activity', () => {
    const result = parseNotificationPayload(
      payloadFor({
        reply: {
          parent: parentKey,
          key: childKey,
          group: '~sampel-palnet/test',
          channel: 'chat/~sampel-palnet/test',
          content: [],
          mention: false,
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: 'chat/~sampel-palnet/test',
      postInfo: {
        id: parentId.split('/')[1],
        authorId: '~sampel-palnet',
        isDm: false,
      },
    });
  });

  it('parses group ask activity', () => {
    const result = parseNotificationPayload(
      payloadFor({
        'group-ask': {
          ship: '~sampel-palnet',
          group: '~sampel-palnet/test',
        },
      })
    );

    expectBaseMeta(result);
    expect(result).toMatchObject({
      type: 'groupJoinRequest',
      groupId: '~sampel-palnet/test',
    });
  });

  it('parses group-invite activity into a routable groupInvite payload', () => {
    const result = parseNotificationPayload(
      payloadFor({
        'group-invite': {
          ship: '~sampel-palnet',
          group: '~sampel-palnet/test',
        },
      })
    );

    expectBaseMeta(result);
    expect(result).toMatchObject({
      type: 'groupInvite',
      groupId: '~sampel-palnet/test',
    });
  });

  it('returns null for a group-invite event missing its group id', () => {
    expect(parseNotificationPayload(payloadFor({ 'group-invite': {} }))).toBe(
      null
    );
  });

  it('parses channel post react activity to the channel', () => {
    const result = parseNotificationPayload(
      payloadFor({
        react: {
          key: childKey,
          parent: null,
          group: '~sampel-palnet/test',
          channel: 'chat/~sampel-palnet/test',
          author: '~sampel-palnet',
          react: '❤️',
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: 'chat/~sampel-palnet/test',
      postInfo: null,
    });
  });

  it('parses channel reply react activity to the parent thread', () => {
    const result = parseNotificationPayload(
      payloadFor({
        react: {
          key: childKey,
          parent: parentKey,
          group: '~sampel-palnet/test',
          channel: 'chat/~sampel-palnet/test',
          author: '~sampel-palnet',
          react: '❤️',
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: 'chat/~sampel-palnet/test',
      postInfo: {
        id: parentId.split('/')[1],
        authorId: '~sampel-palnet',
        isDm: false,
      },
    });
  });

  it('parses DM react activity to the DM channel', () => {
    const result = parseNotificationPayload(
      payloadFor({
        'dm-react': {
          key: childKey,
          parent: null,
          whom: { ship: '~sampel-palnet' },
          author: '~sampel-palnet',
          react: '❤️',
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: '~sampel-palnet',
      postInfo: null,
    });
  });

  it('parses DM thread react activity to the parent thread', () => {
    const result = parseNotificationPayload(
      payloadFor({
        'dm-react': {
          key: childKey,
          parent: parentKey,
          whom: { club: groupDmId },
          author: '~sampel-palnet',
          react: '❤️',
        },
      })
    );

    expect(result).toEqual({
      meta: { errorsFromExtension: undefined },
      channelId: groupDmId,
      postInfo: {
        id: parentId.split('/')[1],
        authorId: '~sampel-palnet',
        isDm: false,
      },
    });
  });

  it('ignores malformed activity JSON without throwing', () => {
    expect(() =>
      parseNotificationPayload({ activityEventJsonString: '{' })
    ).not.toThrow();
    expect(parseNotificationPayload({ activityEventJsonString: '{' })).toBe(
      null
    );
  });

  it('ignores unknown activity events without throwing', () => {
    expect(() =>
      parseNotificationPayload(payloadFor({ 'future-event': {} }))
    ).not.toThrow();
    expect(parseNotificationPayload(payloadFor({ 'future-event': {} }))).toBe(
      null
    );
  });
});

describe('notification routing decisions', () => {
  it('builds the group-invite preview route stack with the invite marker', () => {
    expect(groupInvitePreviewRouteStack('~sampel-palnet/test')).toEqual([
      {
        name: 'MainTabs',
        params: {
          screen: 'ChatList',
          params: {
            previewGroupId: '~sampel-palnet/test',
            previewGroupFromInviteNotification: true,
          },
        },
      },
    ]);
  });

  it('classifies a group invite as a non-channel notification needing no recovery', () => {
    const notification = {
      meta: {},
      type: 'groupInvite' as const,
      groupId: '~sampel-palnet/test',
    };

    expect(getNotificationRouteCategory(notification)).toBe(
      'nonChannelNotification'
    );
    expect(getMissingNotificationTargetRecovery(notification)).toBe('none');
  });

  it('does not retry targeted recovery for a single-DM invite already checked during preparation', () => {
    const notification = {
      meta: {},
      type: 'dmInvite' as const,
      channelId: '~sampel-palnet',
      whomType: 'ship' as const,
    };

    expect(getNotificationRouteCategory(notification)).toBe('dmInvite');
    expect(getMissingNotificationTargetRecovery(notification, true)).toBe(
      'none'
    );
  });

  it('does not retry DM sync for a group-DM invite already synced during preparation', () => {
    const notification = {
      meta: {},
      type: 'dmInvite' as const,
      channelId: groupDmId,
      whomType: 'club' as const,
    };

    expect(getNotificationRouteCategory(notification)).toBe('groupDm');
    expect(getMissingNotificationTargetRecovery(notification, true)).toBe(
      'none'
    );
  });

  it('uses targeted invite recovery for missing single-DM posts and replies', () => {
    expect(
      getMissingNotificationTargetRecovery({
        meta: {},
        channelId: '~sampel-palnet',
        postInfo: null,
      })
    ).toBe('singleDmInvite');
  });

  it('uses DM sync for group-DM targets and group sync for group/channel targets', () => {
    expect(
      getMissingNotificationTargetRecovery({
        meta: {},
        channelId: groupDmId,
        postInfo: null,
      })
    ).toBe('dms');

    expect(
      getMissingNotificationTargetRecovery({
        meta: {},
        channelId: 'chat/~sampel-palnet/test',
        postInfo: null,
      })
    ).toBe('groups');
  });
});

describe('foreground notification presentation', () => {
  it('derives the viewed channel only from chat routes', () => {
    for (const name of ['Channel', 'DM', 'GroupDM', 'ChannelRoot', 'Post']) {
      expect(
        notificationChannelIdFromRoute({
          name,
          params: { channelId: 'chat/~sampel-palnet/test' },
        })
      ).toBe('chat/~sampel-palnet/test');
    }

    expect(
      notificationChannelIdFromRoute({
        name: 'ChatDetails',
        params: { channelId: 'chat/~sampel-palnet/test' },
      })
    ).toBeNull();
  });

  it('suppresses only an exact active-channel match while active', () => {
    expect(
      shouldSuppressActiveChannel({
        appIsActive: true,
        notificationChannelId: '~sampel-palnet',
        viewedChannelId: '~sampel-palnet',
      })
    ).toBe(true);
    expect(
      shouldSuppressActiveChannel({
        appIsActive: true,
        notificationChannelId: '~sampel-palnet-bot',
        viewedChannelId: '~sampel-palnet',
      })
    ).toBe(false);
    expect(
      shouldSuppressActiveChannel({
        appIsActive: false,
        notificationChannelId: '~sampel-palnet',
        viewedChannelId: '~sampel-palnet',
      })
    ).toBe(false);
  });
});

describe('launch targets while the desk verdict is not ok (TLON-6531)', () => {
  const gated = {
    status: 'incompatible',
    current: '12.1.0',
    minimum: '12.2.0',
    subscribed: false,
  } as const;
  const typedReset = jest.fn();
  let nativeResponse: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    store.updateSession(null);
    nativeResponse = {
      notification: {
        request: {
          trigger: null,
          content: {
            data: payloadFor({
              post: {
                key: childKey,
                group: '~sampel-palnet/test',
                channel: 'chat/~sampel-palnet/test',
                content: [],
                mention: false,
              },
            }),
          },
        },
      },
    };
    jest
      .mocked(notifications.useLastNotificationResponse)
      .mockImplementation(() => nativeResponse as never);
    jest
      .mocked(notifications.clearLastNotificationResponseAsync)
      .mockImplementation(() => {
        nativeResponse = null;
        return Promise.resolve();
      });
    jest.mocked(createTypedReset).mockReturnValue(typedReset as never);
    jest.mocked(db.getChannelWithRelations).mockResolvedValue({
      id: 'chat/~sampel-palnet/test',
      groupId: null,
    } as never);
  });

  it('holds a tapped notification until ok, then consumes it once', async () => {
    store.updateSession({ deskCompat: gated });
    renderHook(() => useNotificationListener());
    await act(async () => {});
    expect(
      notifications.clearLastNotificationResponseAsync
    ).not.toHaveBeenCalled();
    expect(typedReset).not.toHaveBeenCalled();
    expect(db.getChannelWithRelations).not.toHaveBeenCalled();

    await act(async () =>
      store.updateSession({ deskCompat: { status: 'ok' } })
    );
    await waitFor(() => expect(typedReset).toHaveBeenCalledTimes(1));
    expect(
      notifications.clearLastNotificationResponseAsync
    ).toHaveBeenCalledTimes(1);
    expect(db.getChannelWithRelations).toHaveBeenCalledTimes(1);
  });

  it('holds a deep link until ok, then handles it once', async () => {
    const reset = useTypedReset();
    const { clearLure } = useBranch();
    store.updateSession({ deskCompat: gated });
    renderHook(() => useDeepLinkListener());
    await act(async () => {});
    expect(reset).not.toHaveBeenCalled();
    expect(clearLure).not.toHaveBeenCalled();
    expect(store.redeemInviteIfNeeded).not.toHaveBeenCalled();

    await act(async () =>
      store.updateSession({ deskCompat: { status: 'ok' } })
    );
    await waitFor(() => expect(clearLure).toHaveBeenCalledTimes(1));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('holds a tapped notification while no verdict exists yet', async () => {
    renderHook(() => useNotificationListener());
    await act(async () => {});
    expect(
      notifications.clearLastNotificationResponseAsync
    ).not.toHaveBeenCalled();
    expect(typedReset).not.toHaveBeenCalled();
  });
});

describe('launch targets in the split layout', () => {
  const typedReset = jest.fn();
  let nativeResponse: unknown;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(useIsWindowNarrow).mockReturnValue(false);
    jest.mocked(isNativeSplitLayoutMounted).mockReturnValue(true);
    store.updateSession({ deskCompat: { status: 'ok' } });
    jest.mocked(createTypedReset).mockReturnValue(typedReset as never);
    jest
      .mocked(notifications.useLastNotificationResponse)
      .mockImplementation(() => nativeResponse as never);
    jest
      .mocked(notifications.clearLastNotificationResponseAsync)
      .mockImplementation(() => {
        nativeResponse = null;
        return Promise.resolve();
      });
  });

  afterEach(() => {
    jest.mocked(useIsWindowNarrow).mockReturnValue(true);
    jest.mocked(isNativeSplitLayoutMounted).mockReturnValue(false);
  });

  it('opens a tapped channel notification in the Home detail pane', async () => {
    nativeResponse = {
      notification: {
        request: {
          trigger: null,
          content: {
            data: payloadFor({
              post: {
                key: childKey,
                group: '~sampel-palnet/test',
                channel: 'chat/~sampel-palnet/test',
                content: [],
                mention: false,
              },
            }),
          },
        },
      },
    };
    jest.mocked(db.getChannelWithRelations).mockResolvedValue({
      id: 'chat/~sampel-palnet/test',
      groupId: '~sampel-palnet/test',
    } as never);
    jest.mocked(getMainGroupRoute).mockResolvedValue({
      name: 'GroupChannels',
      params: { groupId: '~sampel-palnet/test' },
      pop: true,
    } as never);

    renderHook(() => useNotificationListener());
    const navigateRoot = useNavigateRoot();
    await waitFor(() => expect(navigateRoot).toHaveBeenCalledTimes(1));
    expect(typedReset).not.toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Home',
        params: expect.objectContaining({
          screen: 'Channel',
          params: expect.objectContaining({
            channelId: 'chat/~sampel-palnet/test',
            groupId: '~sampel-palnet/test',
            screen: 'ChannelRoot',
          }),
        }),
      })
    );
    expect(getMainGroupRoute).toHaveBeenCalledWith('~sampel-palnet/test', true);
  });

  it('keeps a tap pending until a swapped-in root navigator mounts', async () => {
    nativeResponse = {
      notification: {
        request: {
          trigger: null,
          content: {
            data: payloadFor({
              post: {
                key: childKey,
                group: '~sampel-palnet/test',
                channel: 'chat/~sampel-palnet/test',
                content: [],
                mention: false,
              },
            }),
          },
        },
      },
    };
    jest.mocked(db.getChannelWithRelations).mockResolvedValue({
      id: 'chat/~sampel-palnet/test',
      groupId: '~sampel-palnet/test',
    } as never);
    jest.mocked(getMainGroupRoute).mockResolvedValue({
      name: 'GroupChannels',
      params: { groupId: '~sampel-palnet/test' },
      pop: true,
    } as never);
    const navigateRoot = jest.mocked(useNavigateRoot());
    const rootNavigator = jest.mocked(useRootNavigatorMount());
    rootNavigator.isMounted.mockReturnValueOnce(false);

    renderHook(() => useNotificationListener());
    await waitFor(() =>
      expect(rootNavigator.whenMounted).toHaveBeenCalledTimes(1)
    );
    expect(navigateRoot).not.toHaveBeenCalled();

    act(() => rootNavigator.whenMounted.mock.calls[0][0]());
    await waitFor(() => expect(navigateRoot).toHaveBeenCalledTimes(1));
    expect(rootNavigator.whenMounted).toHaveBeenCalledTimes(1);
  });

  it('opens an invited group preview in the Home sidebar from a deep link', async () => {
    renderHook(() => useDeepLinkListener());
    const navigateRoot = useNavigateRoot();
    await waitFor(() => expect(navigateRoot).toHaveBeenCalledTimes(1));
    expect(useTypedReset()).not.toHaveBeenCalled();
    expect(navigateRoot).toHaveBeenCalledWith({
      name: 'Home',
      params: { screen: 'ChatList', params: { previewGroupId: '~zod/g' } },
    });
  });
});
