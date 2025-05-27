import { beforeEach, describe, expect, test, vi } from 'vitest';

import * as db from '../db';
import * as store from '../store';
import { PinToggleParams, togglePin } from './pinning';

// Mock the store functions
vi.mock('../store', () => ({
  unpinItem: vi.fn(),
  pinChannel: vi.fn(),
  pinGroup: vi.fn(),
}));

// Mock the database query functions
vi.mock('../db', () => ({
  getChannelWithRelations: vi.fn(),
  getGroup: vi.fn(),
}));

describe('togglePin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('unpins a pinned DM channel', async () => {
    const pin: db.Pin = { type: 'dm', itemId: '~zod', index: 0 };
    const channel: db.Channel = {
      id: '~zod',
      type: 'dm',
      contactId: '~zod',
      pin,
    } as db.Channel;

    const channelWithPin = { ...channel, pin };
    vi.mocked(db.getChannelWithRelations).mockResolvedValue(channelWithPin);

    const params: PinToggleParams = {
      chat: { type: 'channel', id: '~zod' },
      channel,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).toHaveBeenCalledWith({ id: '~zod' });
    expect(store.unpinItem).toHaveBeenCalledWith(pin);
    expect(store.pinChannel).not.toHaveBeenCalled();
  });

  test('pins an unpinned DM channel', async () => {
    const channel: db.Channel = {
      id: '~zod',
      type: 'dm',
      contactId: '~zod',
      pin: undefined,
    } as db.Channel;

    const channelWithoutPin = { ...channel, pin: null };
    vi.mocked(db.getChannelWithRelations).mockResolvedValue(channelWithoutPin);

    const params: PinToggleParams = {
      chat: { type: 'channel', id: '~zod' },
      channel,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).toHaveBeenCalledWith({ id: '~zod' });
    expect(store.pinChannel).toHaveBeenCalledWith(channel);
    expect(store.unpinItem).not.toHaveBeenCalled();
  });

  test('unpins a pinned group DM', async () => {
    const pin: db.Pin = {
      type: 'groupDm',
      itemId: '0v4.00000.test',
      index: 0,
    };
    const channel: db.Channel = {
      id: '0v4.00000.test',
      type: 'groupDm',
      pin,
    } as db.Channel;

    const channelWithPin = { ...channel, pin };
    vi.mocked(db.getChannelWithRelations).mockResolvedValue(channelWithPin);

    const params: PinToggleParams = {
      chat: { type: 'channel', id: '0v4.00000.test' },
      channel,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).toHaveBeenCalledWith({
      id: '0v4.00000.test',
    });
    expect(store.unpinItem).toHaveBeenCalledWith(pin);
  });

  test('pins an unpinned group DM', async () => {
    const channel: db.Channel = {
      id: '0v4.00000.test',
      type: 'groupDm',
      pin: undefined,
    } as db.Channel;

    const channelWithoutPin = { ...channel, pin: null };
    vi.mocked(db.getChannelWithRelations).mockResolvedValue(channelWithoutPin);

    const params: PinToggleParams = {
      chat: { type: 'channel', id: '0v4.00000.test' },
      channel,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).toHaveBeenCalledWith({
      id: '0v4.00000.test',
    });
    expect(store.pinChannel).toHaveBeenCalledWith(channel);
  });

  test('unpins a pinned regular channel', async () => {
    const pin: db.Pin = {
      type: 'channel',
      itemId: 'chat/~zod/test',
      index: 0,
    };
    const channel: db.Channel = {
      id: 'chat/~zod/test',
      type: 'chat',
      groupId: '~zod/test-group',
      pin,
    } as db.Channel;

    const channelWithPin = { ...channel, pin };
    vi.mocked(db.getChannelWithRelations).mockResolvedValue(channelWithPin);

    const params: PinToggleParams = {
      chat: { type: 'channel', id: 'chat/~zod/test' },
      channel,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).toHaveBeenCalledWith({
      id: 'chat/~zod/test',
    });
    expect(store.unpinItem).toHaveBeenCalledWith(pin);
  });

  test('unpins a pinned group', async () => {
    const pin: db.Pin = {
      type: 'group',
      itemId: '~zod/test-group',
      index: 0,
    };
    const group: db.Group = {
      id: '~zod/test-group',
      channels: [{ id: 'channel1' }],
      pin,
    } as db.Group;

    const groupWithPin = { ...group, pin } as any;
    vi.mocked(db.getGroup).mockResolvedValue(groupWithPin);

    const params: PinToggleParams = {
      chat: { type: 'group', id: '~zod/test-group' },
      group,
    };

    await togglePin(params);
    expect(db.getGroup).toHaveBeenCalledWith({ id: '~zod/test-group' });
    expect(store.unpinItem).toHaveBeenCalledWith(pin);
    expect(store.pinGroup).not.toHaveBeenCalled();
  });

  test('pins an unpinned group', async () => {
    const group: db.Group = {
      id: '~zod/test-group',
      channels: [{ id: 'channel1' }],
      pin: undefined,
    } as db.Group;

    const groupWithoutPin = { ...group, pin: null } as any;
    vi.mocked(db.getGroup).mockResolvedValue(groupWithoutPin);

    const params: PinToggleParams = {
      chat: { type: 'group', id: '~zod/test-group' },
      group,
    };

    await togglePin(params);
    expect(db.getGroup).toHaveBeenCalledWith({ id: '~zod/test-group' });
    expect(store.pinGroup).toHaveBeenCalledWith(group);
    expect(store.unpinItem).not.toHaveBeenCalled();
  });

  test('pins a group without channels', async () => {
    const group = {
      id: '~zod/test-group',
      channels: [],
      pin: undefined,
    } as unknown as db.Group;

    const groupWithoutPin = { ...group, pin: null } as any;
    vi.mocked(db.getGroup).mockResolvedValue(groupWithoutPin);

    const params: PinToggleParams = {
      chat: { type: 'group', id: '~zod/test-group' },
      group,
    };

    await togglePin(params);
    expect(db.getGroup).toHaveBeenCalledWith({ id: '~zod/test-group' });
    expect(store.pinGroup).toHaveBeenCalledWith(group);
    expect(store.unpinItem).not.toHaveBeenCalled();
    expect(store.pinChannel).not.toHaveBeenCalled();
  });

  test('does nothing when chat is null', async () => {
    const params: PinToggleParams = {
      chat: null,
      channel: {} as db.Channel,
      group: {} as db.Group,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).not.toHaveBeenCalled();
    expect(db.getGroup).not.toHaveBeenCalled();
    expect(store.unpinItem).not.toHaveBeenCalled();
    expect(store.pinChannel).not.toHaveBeenCalled();
    expect(store.pinGroup).not.toHaveBeenCalled();
  });

  test('does nothing when channel is null for channel chat', async () => {
    const params: PinToggleParams = {
      chat: { type: 'channel', id: 'test' },
      channel: null,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).not.toHaveBeenCalled();
    expect(store.unpinItem).not.toHaveBeenCalled();
    expect(store.pinChannel).not.toHaveBeenCalled();
    expect(store.pinGroup).not.toHaveBeenCalled();
  });

  test('does nothing when group is null for group chat', async () => {
    const params: PinToggleParams = {
      chat: { type: 'group', id: 'test' },
      group: null,
    };

    await togglePin(params);
    expect(db.getGroup).not.toHaveBeenCalled();
    expect(store.unpinItem).not.toHaveBeenCalled();
    expect(store.pinChannel).not.toHaveBeenCalled();
    expect(store.pinGroup).not.toHaveBeenCalled();
  });

  test('handles channel not found', async () => {
    const channel: db.Channel = {
      id: '~zod',
      type: 'dm',
      contactId: '~zod',
    } as db.Channel;

    vi.mocked(db.getChannelWithRelations).mockResolvedValue(null);

    const params: PinToggleParams = {
      chat: { type: 'channel', id: '~zod' },
      channel,
    };

    await togglePin(params);
    expect(db.getChannelWithRelations).toHaveBeenCalledWith({ id: '~zod' });
    expect(store.unpinItem).not.toHaveBeenCalled();
    expect(store.pinChannel).not.toHaveBeenCalled();
  });

  test('handles group not found', async () => {
    const group: db.Group = {
      id: '~zod/test-group',
      channels: [{ id: 'channel1' }],
    } as db.Group;

    vi.mocked(db.getGroup).mockResolvedValue(null);

    const params: PinToggleParams = {
      chat: { type: 'group', id: '~zod/test-group' },
      group,
    };

    await togglePin(params);
    expect(db.getGroup).toHaveBeenCalledWith({ id: '~zod/test-group' });
    expect(store.unpinItem).not.toHaveBeenCalled();
    expect(store.pinGroup).not.toHaveBeenCalled();
  });
});
