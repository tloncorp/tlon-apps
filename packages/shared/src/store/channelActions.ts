import * as api from '../api';
import { ChannelContentConfiguration } from '../api/channelContentConfig';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { getRandomId } from '../logic';
import {
  ChannelMetadata,
  GroupChannel,
  getChannelKindFromType,
} from '../urbit';

const logger = createDevLogger('ChannelActions', false);

export async function createChannel({
  groupId,
  title,
  description,
  channelType,
}: {
  groupId: string;
  title: string;
  description?: string;
  channelType: Omit<db.ChannelType, 'dm' | 'groupDm'>;
  contentConfiguration?: ChannelContentConfiguration;
}) {
  const currentUserId = api.getCurrentUserId();
  const channelSlug = getRandomId();
  const channelId = `${getChannelKindFromType(channelType)}/${currentUserId}/${channelSlug}`;
  // optimistic update
  const newChannel: db.Channel = {
    id: channelId,
    title,
    description,
    type: channelType as db.ChannelType,
    groupId,
    addedToGroupAt: Date.now(),
    currentUserIsMember: true,
  };
  await db.insertChannels([newChannel]);

  const cfg = ChannelContentConfiguration.toApiMeta(
    channelContentConfigurationForChannelType(channelType)
  );

  try {
    await api.createChannel({
      id: channelId,
      kind: getChannelKindFromType(channelType),
      group: groupId,
      name: channelSlug,
      title,
      description: description ?? '',
      readers: [],
      writers: [],
      meta: cfg == null ? null : JSON.stringify(cfg),
    });
    return newChannel;
  } catch (e) {
    console.error('Failed to create channel', e);
    // rollback optimistic update
    await db.deleteChannel(channelId);
  }

  return newChannel;
}

/**
 * Creates a `ChannelContentConfiguration` matching our built-in legacy
 * channel types. With this configuration in place, we can treat these channels
 * as we would any other custom channel, and avoid switching on `channel.type`
 * in client code.
 */
function channelContentConfigurationForChannelType(
  channelType: Omit<db.Channel['type'], 'dm' | 'groupDm'>
): ChannelContentConfiguration {
  switch (channelType) {
    case 'chat':
      return {
        draftInput: api.DraftInputId.chat,
        defaultPostContentRenderer: api.PostContentRendererId.chat,
        defaultPostCollectionRenderer: api.CollectionRendererId.chat,
      };
    case 'notebook':
      return {
        draftInput: api.DraftInputId.notebook,
        defaultPostContentRenderer: api.PostContentRendererId.notebook,
        defaultPostCollectionRenderer: api.CollectionRendererId.notebook,
      };
    case 'gallery':
      return {
        draftInput: api.DraftInputId.gallery,
        defaultPostContentRenderer: api.PostContentRendererId.gallery,
        defaultPostCollectionRenderer: api.CollectionRendererId.gallery,
      };
  }

  throw new Error('Unknown channel type');
}

export async function deleteChannel({
  channelId,
  groupId,
}: {
  channelId: string;
  groupId: string;
}) {
  // optimistic update
  await db.deleteChannel(channelId);

  try {
    await api.deleteChannel({ channelId, groupId });
  } catch (e) {
    console.error('Failed to delete channel', e);
    // rollback optimistic update
    const channel = await db.getChannel({ id: channelId });
    if (channel) {
      await db.insertChannels([channel]);
    }
  }
}

export async function updateChannel({
  groupId,
  sectionId,
  readers,
  writers,
  join,
  channel,
}: {
  groupId: string;
  sectionId: string;
  readers: string[];
  writers: string[];
  join: boolean;
  channel: db.Channel;
}) {
  const updatedChannel: db.Channel = {
    ...channel,
    readerRoles: readers.map((roleId) => ({
      channelId: channel.id,
      roleId,
    })),
    writerRoles: writers.map((roleId) => ({
      channelId: channel.id,
      roleId,
    })),
  };

  await db.updateChannel(updatedChannel);

  const groupChannel: GroupChannel = {
    added: channel.addedToGroupAt ?? 0,
    readers,
    writers,
    zone: sectionId,
    join,
    meta: {
      title: channel.title ?? '',
      description: channel.description ?? '',
      image: channel.coverImage ?? '',
      cover: channel.coverImage ?? '',
    },
  };

  try {
    await api.updateChannel({
      groupId,
      channelId: channel.id,
      channel: groupChannel,
    });

    const meta: ChannelMetadata | null =
      channel.contentConfiguration == null
        ? null
        : ChannelContentConfiguration.toApiMeta(channel.contentConfiguration);
    await api.updateChannelMeta(
      channel.id,
      meta == null ? null : JSON.stringify(meta)
    );
  } catch (e) {
    console.error('Failed to update channel', e);
    await db.updateChannel(channel);
  }
}

export async function pinChat(chat: db.Chat) {
  return chat.type === 'group'
    ? pinGroup(chat.group)
    : pinChannel(chat.channel);
}

export async function pinGroup(group: db.Group) {
  return savePin({ type: 'group', itemId: group.id });
}

export async function pinChannel(channel: db.Channel) {
  const type =
    channel.type === 'dm' || channel.type === 'groupDm'
      ? channel.type
      : 'channel';
  return savePin({ type, itemId: channel.id });
}

async function savePin(pin: { type: db.PinType; itemId: string }) {
  db.insertPinnedItem(pin);
  try {
    await api.pinItem(pin.itemId);
  } catch (e) {
    console.error('Failed to pin item', e);
    // rollback optimistic update
    db.deletePinnedItem(pin);
  }
}

export async function unpinItem(pin: db.Pin) {
  // optimistic update
  db.deletePinnedItem(pin);

  try {
    await api.unpinItem(pin.itemId);
  } catch (e) {
    console.error('Failed to unpin item', e);
    // rollback optimistic update
    db.insertPinnedItem(pin);
  }
}

export async function markChannelVisited(channelId: string) {
  await db.updateChannel({ id: channelId, lastViewedAt: Date.now() });
}

export async function markChannelRead({
  id,
  groupId,
}: {
  id: string;
  groupId?: string;
}) {
  logger.log(`marking channel as read`, id);
  // optimistic update
  const existingUnread = await db.getChannelUnread({ channelId: id });
  if (existingUnread) {
    await db.clearChannelUnread(id);
  }

  const existingCount = existingUnread?.count ?? 0;
  if (groupId && existingCount > 0) {
    // optimitically update group unread count
    await db.updateGroupUnreadCount({
      groupId,
      decrement: existingCount,
    });
  }

  const existingChannel = await db.getChannel({ id });

  if (!existingChannel) {
    throw new Error('Channel not found');
  }

  if (existingChannel.isPendingChannel) {
    return;
  }

  try {
    await api.readChannel(existingChannel);
  } catch (e) {
    console.error('Failed to read channel', {id, groupId}, e);
    // rollback optimistic update
    if (existingUnread) {
      await db.insertChannelUnreads([existingUnread]);
    }
  }
}

export async function markThreadRead({
  parentPost,
  post,
  channel,
}: {
  post: db.Post;
  parentPost: db.Post;
  channel: db.Channel;
}) {
  // optimistic update
  const existingUnread = await db.getThreadActivity({
    channelId: channel.id,
    postId: parentPost.id,
  });
  if (existingUnread) {
    await db.clearThreadUnread({
      channelId: channel.id,
      threadId: parentPost.id,
    });

    const existingCount = existingUnread.count ?? 0;
    if (existingCount > 0) {
      // optimistic updately update channel & group counts
      await db.updateChannelUnreadCount({
        channelId: channel.id,
        decrement: existingCount,
      });
      if (channel.groupId) {
        await db.updateGroupUnreadCount({
          groupId: channel.groupId,
          decrement: existingCount,
        });
      }
    }
  }

  try {
    await api.readThread({ parentPost, post, channel });
  } catch (e) {
    console.error('Failed to read thread', e);
    // rollback optimistic update
    if (existingUnread) {
      await db.insertThreadUnreads([existingUnread]);
    }
  }
}

export async function upsertDmChannel({
  participants,
}: {
  participants: string[];
}): Promise<db.Channel> {
  logger.log(`upserting dm channel`, participants);
  const currentUserId = api.getCurrentUserId();
  // if it's a group dm
  if (participants.length > 1) {
    logger.log(`its a multi dm`);
    // see if any existing group dm has the exact same participant set
    const multiDms = await db.getAllMultiDms();
    const fullParticipantSet = [...participants, currentUserId];
    const existingId = multiDms.reduce((foundId: null | db.Channel, currDm) => {
      if (foundId !== null) return foundId;
      if (currDm.members.length === fullParticipantSet.length) {
        if (
          currDm.members.every((member) =>
            fullParticipantSet.includes(member.contactId)
          )
        ) {
          return currDm;
        }
      }
      return null;
    }, null);

    // if we found a match, return it
    if (existingId) {
      return existingId;
    }

    // if we didn't, we need to create a new pending group dm channel
    // on the client that will only persist on the backend after sending
    // the first message
    const newMultiDm = db.buildPendingMultiDmChannel(
      participants,
      currentUserId
    );
    await db.insertChannels([newMultiDm]);
    return newMultiDm;
  }

  // check for existing single dm
  logger.log(`its a single dm`);
  const dmPartner = participants[0];
  const dms = await db.getAllSingleDms();
  const existingDm = dms.find((dm) => dm.id === dmPartner);
  if (existingDm) {
    logger.log(`found it, returning existing dm`, existingDm);
    return existingDm;
  }

  // if it doesn't exist, we create a new one but don't need to juggle
  // any pending state
  logger.log(`creating pending dm, no existing one found`);
  const newDm = db.buildPendingSingleDmChannel(dmPartner);
  await db.insertChannels([newDm]);
  logger.log(`returning new pending dm`, newDm);
  return newDm;
}

export async function leaveGroupChannel(channelId: string) {
  const channel = await db.getChannel({ id: channelId });
  if (!channel) {
    throw new Error('Channel not found');
  }

  // optimistic update
  await db.updateChannel({ id: channelId, currentUserIsMember: false });

  try {
    await api.leaveChannel(channelId);
  } catch (e) {
    console.error('Failed to leave channel', e);
    // rollback optimistic update
    await db.updateChannel({ id: channelId, currentUserIsMember: true });
  }
}

export async function joinGroupChannel({
  channelId,
  groupId,
}: {
  channelId: string;
  groupId: string;
}) {
  // optimistic update
  await db.updateChannel({
    id: channelId,
    currentUserIsMember: true,
  });

  try {
    await api.joinChannel(channelId, groupId);
  } catch (e) {
    // rollback on failure
    logger.error('Failed to join group channel');
    await db.updateChannel({
      id: channelId,
      currentUserIsMember: false,
    });
  }
}
