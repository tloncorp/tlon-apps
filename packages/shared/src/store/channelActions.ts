import * as api from '../api';
import * as db from '../db';
import * as logic from '../logic';
import { GroupChannel } from '../urbit';

export async function updateChannel({
  groupId,
  sectionId,
  readers,
  join,
  channel,
}: {
  groupId: string;
  sectionId: string;
  readers: string[];
  join: boolean;
  channel: db.Channel;
}) {
  // optimistic update
  await db.updateChannel(channel);

  const groupChannel: GroupChannel = {
    added: channel.addedToGroupAt ?? 0,
    readers,
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
    // rollback optimistic update
    await db.updateChannel(channel);
  }
}

export async function pinItem(channel: db.Channel) {
  // optimistic update
  const partialPin = logic.getPinPartial(channel);
  db.insertPinnedItem(partialPin);

  try {
    await api.pinItem(partialPin.itemId);
  } catch (e) {
    console.error('Failed to pin item', e);
    // rollback optimistic update
    db.deletePinnedItem(partialPin);
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

export async function markChannelRead(channel: db.Channel) {
  // optimistic update
  const existingUnread = await db.getChannelUnread({ channelId: channel.id });
  if (existingUnread) {
    await db.clearChannelUnread(channel.id);
  }

  const existingCount = existingUnread?.count ?? 0;
  if (channel.groupId && existingCount > 0) {
    // optimitically update group unread count
    await db.updateGroupUnreadCount({
      groupId: channel.groupId,
      decrement: existingCount,
    });
  }

  try {
    await api.readChannel(channel);
  } catch (e) {
    console.error('Failed to read channel', e);
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
  const currentUserId = api.getCurrentUserId();
  // if it's a group dm
  if (participants.length > 1) {
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
  const dmPartner = participants[0];
  const dms = await db.getAllSingleDms();
  const existingDm = dms.find((dm) => dm.id === dmPartner);
  if (existingDm) {
    return existingDm;
  }

  // if it doesn't exist, we create a new one but don't need to juggle
  // any pending state
  const newDm = db.buildPendingSingleDmChannel(dmPartner);
  await db.insertChannels([newDm]);
  return newDm;
}
