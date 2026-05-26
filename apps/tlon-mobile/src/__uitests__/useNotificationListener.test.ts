import { describe, expect, it } from '@jest/globals';

import { parseNotificationPayload } from '../lib/notificationPayload';
import {
  getMissingNotificationTargetRecovery,
  getNotificationRouteCategory,
} from '../hooks/notificationRouting';

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
    expect(
      getMissingNotificationTargetRecovery(notification, {
        canNavigate: false,
        attemptedSingleDmInviteRecovery: true,
      })
    ).toBe('none');
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
