import { describe, expect, it, jest } from '@jest/globals';

import {
  getMissingNotificationTargetRecovery,
  getNotificationRouteCategory,
} from '../hooks/useNotificationListener';
import { parseNotificationPayload } from '../lib/notificationPayload';

jest.mock('@react-navigation/native', () => ({
  useNavigation: jest.fn(),
}));

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
  screenNameFromChannelId: jest.fn(),
}));

jest.mock('@tloncorp/app/ui', () => ({
  useIsWindowNarrow: jest.fn(),
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
    trackError: jest.fn(),
    trackEvent: jest.fn(),
  })),
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
