import * as api from '../api';
import {
  ChannelContentConfiguration,
  StructuredChannelDescriptionPayload,
} from '../api/channelContentConfig';
import * as db from '../db';
import { createDevLogger } from '../debug';
import * as logic from '../logic';
import { GroupChannel, getChannelKindFromType } from '../urbit';

const logger = createDevLogger('ChannelActions', false);

export async function createChannel({
  groupId,
  channelId,
  name,
  title,
  // Alias to `rawDescription`, since we might need to synthesize a new
  // `description` API value by merging with `contentConfiguration` below.
  description: rawDescription,
  channelType,
  contentConfiguration,
}: {
  groupId: string;
  channelId: string;
  name: string;
  title: string;
  description?: string;
  channelType: Omit<db.ChannelType, 'dm' | 'groupDm'>;
  contentConfiguration?: ChannelContentConfiguration;
}) {
  // optimistic update
  const newChannel: db.Channel = {
    id: channelId,
    title,
    description: rawDescription,
    contentConfiguration,
    type: channelType as db.ChannelType,
    groupId,
    addedToGroupAt: Date.now(),
    currentUserIsMember: true,
  };
  await db.insertChannels([newChannel]);

  // If we have a `contentConfiguration`, we need to merge these fields to make
  // a `StructuredChannelDescriptionPayload`, and use that as the `description`
  // on the API.
  const encodedDescription =
    contentConfiguration == null
      ? rawDescription
      : StructuredChannelDescriptionPayload.encode({
          description: rawDescription,
          channelContentConfiguration: contentConfiguration,
        });

  try {
    await api.addChannelToGroup({ groupId, channelId, sectionId: 'default' });
    await api.createChannel({
      // @ts-expect-error this is fine
      kind: getChannelKindFromType(channelType),
      group: groupId,
      name,
      title,
      description: encodedDescription ?? '',
      readers: [],
      writers: [],
    });
  } catch (e) {
    console.error('Failed to create channel', e);
    // rollback optimistic update
    await db.deleteChannel(channelId);
  }
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

export async function markChannelVisited(channel: db.Channel) {
  const now = Date.now();
  logger.log(
    `marking channel as visited (${channel.lastViewedAt} -> ${now})`,
    channel.id
  );
  await db.updateChannel({ id: channel.id, lastViewedAt: now });
}

export type MarkChannelReadParams = Pick<db.Channel, 'id' | 'groupId' | 'type'>;

export async function markChannelRead(params: MarkChannelReadParams) {
  logger.log(`marking channel as read`, params.id);
  // optimistic update
  const existingUnread = await db.getChannelUnread({ channelId: params.id });
  if (existingUnread) {
    await db.clearChannelUnread(params.id);
  }

  const existingCount = existingUnread?.count ?? 0;
  if (params.groupId && existingCount > 0) {
    // optimitically update group unread count
    await db.updateGroupUnreadCount({
      groupId: params.groupId,
      decrement: existingCount,
    });
  }

  try {
    await api.readChannel(params);
  } catch (e) {
    console.error('Failed to read channel', params, e);
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
