import { describe, expect, it } from 'vitest';

import { isConversationRootRoute } from './conversationRoot';

describe('isConversationRootRoute', () => {
  it('claims every direct message, however it was reached', () => {
    expect(isConversationRootRoute({ name: 'DM', params: {} })).toBe(true);
    expect(isConversationRootRoute({ name: 'GroupDM', params: {} })).toBe(true);
  });

  it('claims the single channel a one-channel group is entered through', () => {
    expect(
      isConversationRootRoute({
        name: 'Channel',
        params: { channelId: 'c', groupId: 'g', isOnlyChannel: true },
      })
    ).toBe(true);
  });

  it('leaves an ordinary group channel its back caret', () => {
    expect(
      isConversationRootRoute({
        name: 'Channel',
        params: { channelId: 'c', groupId: 'g' },
      })
    ).toBe(false);
    expect(
      isConversationRootRoute({
        name: 'Channel',
        params: { channelId: 'c', groupId: 'g', isOnlyChannel: false },
      })
    ).toBe(false);
  });

  it('is false for the screens either side of a conversation', () => {
    expect(isConversationRootRoute({ name: 'GroupChannels' })).toBe(false);
    expect(isConversationRootRoute({ name: 'MainTabs' })).toBe(false);
    expect(isConversationRootRoute({ name: 'UserProfile' })).toBe(false);
    expect(isConversationRootRoute(undefined)).toBe(false);
  });
});
