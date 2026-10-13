import { describe, expect, it } from 'vitest';

import { getNotificationCopy, isReactActivityType } from './notificationCopy';

describe('isReactActivityType', () => {
  it.each(['react', 'dm-react'])('recognizes %s', (activityType) => {
    expect(isReactActivityType(activityType)).toBe(true);
  });

  it.each(['post', 'dm-post', 'reply', 'flag-post', 'note-create'])(
    'does not recognize %s',
    (activityType) => {
      expect(isReactActivityType(activityType)).toBe(false);
    }
  );
});

describe('getNotificationCopy', () => {
  it('falls back to the contact name when a DM title is empty', () => {
    expect(
      getNotificationCopy({
        activityType: 'post',
        channelTitle: '',
        contactName: 'Alice',
        contentText: 'Hello',
        reactValue: '',
      })
    ).toEqual({
      title: 'Alice',
      body: 'Hello',
    });
  });

  it.each([
    ['flag-post', 'post'],
    ['flag-reply', 'reply'],
  ])('uses flag-specific copy for %s activity', (activityType, kind) => {
    const copy = getNotificationCopy({
      activityType,
      channelTitle: 'General',
      contactName: 'Alice',
      contentText: '',
      groupTitle: 'Tlon',
      reactValue: '',
    });

    expect(copy).toEqual({
      title: `Flagged ${kind} in Tlon`,
      body: `A ${kind} by Alice was flagged in your group`,
    });
    expect(copy.body).not.toContain('Alice flagged');
    expect(copy.body).not.toBe('New message');
  });

  it('uses invite copy for dm-invite activity instead of the message fallback', () => {
    expect(
      getNotificationCopy({
        activityType: 'dm-invite',
        channelTitle: '',
        contactName: 'Alice',
        contentText: '',
        reactValue: '',
      })
    ).toEqual({
      title: 'Alice',
      body: 'Invited you to chat',
    });
  });

  it('names the reactor and the emoji for a channel reaction', () => {
    expect(
      getNotificationCopy({
        activityType: 'react',
        channelTitle: 'General',
        contactName: 'Alice',
        contentText: '',
        groupTitle: 'Tlon',
        reactValue: '🎉',
      })
    ).toEqual({
      title: 'General in Tlon',
      body: 'Alice reacted 🎉 to your post',
    });
  });

  it('names the reactor and the emoji for a DM reaction', () => {
    expect(
      getNotificationCopy({
        activityType: 'dm-react',
        channelTitle: '',
        contactName: 'Alice',
        contentText: '',
        reactValue: '🎉',
      })
    ).toEqual({
      title: 'Alice',
      body: 'Alice reacted 🎉 to your message',
    });
  });

  // A custom react can serialize to an empty display value; the copy should
  // still say who reacted rather than degrading to the message fallback.
  it.each(['react', 'dm-react'])(
    'still attributes a %s with no renderable emoji',
    (activityType) => {
      const copy = getNotificationCopy({
        activityType,
        channelTitle: 'General',
        contactName: 'Alice',
        contentText: '',
        reactValue: '',
      });

      expect(copy.body).toBe(
        `Alice reacted to your ${activityType === 'dm-react' ? 'message' : 'post'}`
      );
      expect(copy.body).not.toBe('New message');
    }
  );

  // Reactions carry their emoji in `content`, so the group-title rewrite that
  // turns a body into "<sender>: <text>" must not claim the emoji was a message.
  it.each(['react', 'dm-react'])(
    'keeps %s copy when a group title is present',
    (activityType) => {
      expect(
        getNotificationCopy({
          activityType,
          channelTitle: 'General',
          contactName: 'Alice',
          contentText: '',
          groupTitle: 'Tlon',
          reactValue: '🎉',
        }).body
      ).toContain('Alice reacted 🎉');
    }
  );
});
