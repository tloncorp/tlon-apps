import * as api from '@tloncorp/api';
import {
  ChannelContentConfiguration,
  StructuredChannelDescriptionPayload,
} from '@tloncorp/api';
import { TimeoutError } from '@tloncorp/api';
import { GroupChannelV7, getChannelKindFromType } from '@tloncorp/api/urbit';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import { getRandomId } from '../logic';

const logger = createDevLogger('ChannelActions', false);

export async function createChannel({
  groupId,
  title,
  // Alias to `rawDescription`, since we might need to synthesize a new
  // `description` API value by merging with `contentConfiguration` below.
  description: rawDescription,
  channelType: rawChannelType,
  contentConfiguration,
  customSlug,
  readers = [],
  writers = [],
}: {
  groupId: string;
  title: string;
  description?: string;
  channelType: Omit<db.ChannelType, 'dm' | 'groupDm'> | 'custom';
  contentConfiguration?: ChannelContentConfiguration;
  customSlug?: string;
  readers?: string[];
  writers?: string[];
}) {
  const currentUserId = api.getCurrentUserId();
  const channelType = rawChannelType === 'custom' ? 'chat' : rawChannelType;

  if (channelType === 'notes') {
    return createNotesChannel({
      groupId,
      title,
      description: rawDescription,
      readers,
    });
  }

  const channelSlug = customSlug || getRandomId();
  const channelId = `${getChannelKindFromType(channelType)}/${currentUserId}/${channelSlug}`;

  logger.trackEvent(
    AnalyticsEvent.ActionCreateChannel,
    logic.getModelAnalytics({
      channel: { id: channelId, type: channelType as db.ChannelType },
      group: { id: groupId },
    })
  );

  // optimistic update
  const newChannel: db.Channel = {
    id: channelId,
    title,
    description: rawDescription,
    type: channelType as db.ChannelType,
    groupId,
    addedToGroupAt: Date.now(),
    currentUserIsMember: true,
    currentUserIsHost: true,
    contentConfiguration:
      contentConfiguration ??
      channelContentConfigurationForChannelType(channelType),
    lastPostSequenceNum: 0,
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
    await api.createChannel({
      id: channelId,
      kind: getChannelKindFromType(channelType),
      group: groupId,
      name: channelSlug,
      title,
      description: encodedDescription ?? '',
      meta: null,
      readers,
      writers,
    });
    return newChannel;
  } catch (e) {
    // rollback optimistic update
    await db.deleteChannels([channelId]);
    throw new Error(`Failed to create channel ${channelId}`);
  }

  return newChannel;
}

interface NotesNotebookEntry {
  host: string;
  flagName: string;
  notebook: { id: number; title: string };
}

async function createNotesChannel({
  groupId,
  title,
  description,
  readers,
}: {
  groupId: string;
  title: string;
  description?: string;
  readers: string[];
}): Promise<db.Channel> {
  const currentUserId = api.getCurrentUserId();

  // Snapshot the set of locally-hosted notebook flags so we can identify the
  // freshly-created one after the poke. The %notes agent assigns the flag,
  // so we can't precompute it.
  const before = await scryNotesNotebooks();
  const beforeOurs = new Set(
    before.filter((n) => n.host === currentUserId).map((n) => n.flagName)
  );

  await api.poke({
    app: 'notes',
    mark: 'notes-action',
    json: { type: 'create-notebook', title },
  });

  const newEntry = await pollForNewNotebook({
    currentUserId,
    title,
    excluded: beforeOurs,
  });

  if (!newEntry) {
    throw new Error('Failed to create notes notebook');
  }

  const channelId = `notes/${newEntry.host}/${newEntry.flagName}`;
  const flag = `${newEntry.host}/${newEntry.flagName}`;

  logger.trackEvent(
    AnalyticsEvent.ActionCreateChannel,
    logic.getModelAnalytics({
      channel: { id: channelId, type: 'notes' },
      group: { id: groupId },
    })
  );

  // Default new notebooks to public so any group member can join. We don't
  // yet propagate group membership to the notebook's per-member ACL, so
  // private would lock everyone but the owner out.
  try {
    await api.poke({
      app: 'notes',
      mark: 'notes-action',
      json: {
        type: 'notebook',
        flag,
        action: { type: 'visibility', visibility: 'public' },
      },
    });
  } catch (e) {
    logger.error('Failed to set notebook visibility to public', e);
  }

  // Pick a section to add this channel to. Tlon-created groups conventionally
  // have a 'default' section, but we'll prefer whatever the first section is
  // if the group looks different.
  const group = await db.getGroup({ id: groupId });
  const sectionId =
    group?.navSections?.[0]?.sectionId ??
    group?.navSections?.[0]?.id ??
    'default';

  const newChannel: db.Channel = {
    id: channelId,
    title,
    description,
    type: 'notes',
    groupId,
    addedToGroupAt: Date.now(),
    currentUserIsMember: true,
    currentUserIsHost: true,
    contentConfiguration: channelContentConfigurationForChannelType('notes'),
    lastPostSequenceNum: 0,
  };

  await db.insertChannels([newChannel]);

  try {
    await api.addChannelListingToGroup({
      channelId,
      groupId,
      sectionId,
      meta: {
        title,
        description: description ?? '',
        image: '',
        cover: '',
      },
      readers,
      join: true,
    });
  } catch (e) {
    await db.deleteChannels([channelId]);
    logger.error('addChannelListingToGroup failed for notes channel', e);
    throw new Error(`Failed to add notes channel to group: ${channelId}`);
  }

  return newChannel;
}

async function scryNotesNotebooks(): Promise<NotesNotebookEntry[]> {
  try {
    const data = await api.scry<NotesNotebookEntry[]>({
      app: 'notes',
      path: '/v0/notebooks',
    });
    return Array.isArray(data) ? data : [];
  } catch (e) {
    logger.error('scry /v0/notebooks failed', e);
    return [];
  }
}

async function pollForNewNotebook({
  currentUserId,
  title,
  excluded,
  attempts = 8,
  delayMs = 250,
}: {
  currentUserId: string;
  title: string;
  excluded: Set<string>;
  attempts?: number;
  delayMs?: number;
}): Promise<NotesNotebookEntry | null> {
  for (let i = 0; i < attempts; i++) {
    const all = await scryNotesNotebooks();
    const ours = all.filter((n) => n.host === currentUserId);
    // Prefer an exact title match among new entries, otherwise just any new
    // entry (handles the rare case where the title was sanitized/transformed
    // by the agent).
    const fresh = ours.filter((n) => !excluded.has(n.flagName));
    const match =
      fresh.find((n) => n.notebook.title === title) ?? fresh[0] ?? null;
    if (match) return match;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
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
    case 'notes':
      return {
        draftInput: api.DraftInputId.notes,
        defaultPostContentRenderer: api.PostContentRendererId.notes,
        defaultPostCollectionRenderer: api.CollectionRendererId.notes,
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
  logger.trackEvent(
    AnalyticsEvent.ActionDeleteChannel,
    logic.getModelAnalytics({
      channel: { id: channelId },
      group: { id: groupId },
    })
  );

  // optimistic update
  await db.deleteChannels([channelId]);

  try {
    await api.deleteChannel({ channelId, groupId });
  } catch (e) {
    console.error('Failed to delete channel', e);
    // rollback optimistic update
    const channel = await db.getChannel({ id: channelId });
    if (channel) {
      await db.insertChannels([channel]);
    }
    return;
  }

  // For notes channels, also delete the underlying notebook on %notes so we
  // don't leak orphans. The agent rejects the delete if we're not the host,
  // which is fine — the listing is already gone from the group either way.
  if (channelId.startsWith('notes/')) {
    const [, host, name] = channelId.split('/');
    if (host && name) {
      try {
        await api.poke({
          app: 'notes',
          mark: 'notes-action',
          json: {
            type: 'notebook',
            flag: `${host}/${name}`,
            action: { type: 'delete' },
          },
        });
      } catch (e) {
        logger.error('Failed to delete notebook in %notes', e);
      }
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
  logger.log('updating channel', channel.id, { readers, writers });
  const currentChannel = await db.getChannel({
    id: channel.id,
    includeWriters: true,
  });
  const currentChannelWriterIds = currentChannel?.writerRoles?.map(
    (role) => role.roleId
  );
  logger.log('currentChannelWriterIds', currentChannelWriterIds);
  const writersToAdd = writers.filter(
    (roleId) => !currentChannelWriterIds?.includes(roleId)
  );
  const writersToRemove =
    currentChannelWriterIds?.filter((roleId) => !writers.includes(roleId)) ??
    [];

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

  logger.log('updated channel', updatedChannel);
  logger.trackEvent(AnalyticsEvent.ActionUpdatedChannel, {
    ...logic.getModelAnalytics({
      channel: updatedChannel,
      group: { id: groupId },
    }),
    hasTitle: !!updatedChannel.title,
    hasDescription: !!updatedChannel.description,
  });

  await db.updateChannel(updatedChannel);

  // If we have a `contentConfiguration`, we need to merge these fields to make
  // a `StructuredChannelDescriptionPayload`, and use that as the `description`
  const structuredDescription = StructuredChannelDescriptionPayload.encode({
    description: channel.description ?? undefined,
    channelContentConfiguration: channel.contentConfiguration ?? undefined,
  });

  const addedTimestamp =
    currentChannel?.addedToGroupAt ?? channel.addedToGroupAt ?? Date.now();

  const groupChannel: GroupChannelV7 = {
    added: addedTimestamp,
    readers,
    section: sectionId,
    join,
    meta: {
      title: channel.title ?? '',
      description: structuredDescription ?? '',
      image: channel.coverImage ?? '',
      cover: channel.coverImage ?? '',
    },
  };

  logger.log('group channel', groupChannel);

  try {
    await api.updateChannel({
      groupId,
      channelId: channel.id,
      channel: groupChannel,
    });
    if (writersToAdd.length > 0) {
      logger.log('adding writers', writersToAdd);
      await api.addChannelWriters({
        channelId: channel.id,
        writers: writersToAdd,
      });
      logger.log('added writers');
    }

    if (writersToRemove.length > 0) {
      logger.log('removing writers', writersToRemove);
      await api.removeChannelWriters({
        channelId: channel.id,
        writers: writersToRemove,
      });
      logger.log('removed writers');
    }
    logger.log('updated channel on server');
  } catch (e) {
    console.error('Failed to update channel', e);
    await db.updateChannel(channel);
  }
}

export async function pinPostToChannel({
  channel,
  postId,
}: {
  channel: db.Channel;
  postId: string;
}) {
  if (!channel.groupId) {
    throw new Error('Cannot pin posts in DM channels');
  }

  const previousOrder = channel.order ?? [];
  const nextOrder = [postId, ...previousOrder.filter((id) => id !== postId)];

  // Optimistic local update
  await db.updateChannel({
    id: channel.id,
    order: nextOrder,
  });

  try {
    await api.setOrder(channel.id, nextOrder);
  } catch (e) {
    console.error('Failed to pin post', e);
    // Rollback optimistic update
    await db.updateChannel({
      id: channel.id,
      order: previousOrder,
    });
  }
}

export async function unpinPostFromChannel({
  channel,
}: {
  channel: db.Channel;
}) {
  if (!channel.groupId) {
    throw new Error('Cannot unpin posts in DM channels');
  }

  const previousOrder = channel.order ?? [];
  const previousPinnedPostId = logic.getPinnedPostId(channel);
  if (!previousPinnedPostId) {
    return;
  }
  const nextOrder = previousOrder.filter((id) => id !== previousPinnedPostId);

  // Optimistic local update
  await db.updateChannel({
    id: channel.id,
    order: nextOrder,
  });

  try {
    await api.setOrder(channel.id, nextOrder);
  } catch (e) {
    console.error('Failed to unpin post', e);
    // Rollback optimistic update
    await db.updateChannel({
      id: channel.id,
      order: previousOrder,
    });
  }
}

export async function pinChat(chat: db.Chat) {
  logger.trackEvent(AnalyticsEvent.ActionPinChat);
  return chat.type === 'group'
    ? pinGroup(chat.group)
    : pinChannel(chat.channel);
}

export async function pinGroup(group: db.Group) {
  logger.trackEvent(AnalyticsEvent.ActionPinChat);
  return savePin({ type: 'group', itemId: group.id });
}

export async function pinChannel(channel: db.Channel) {
  logger.trackEvent(AnalyticsEvent.ActionPinChat);
  const type =
    channel.type === 'dm' || channel.type === 'groupDm'
      ? channel.type
      : 'channel';
  return savePin({ type, itemId: channel.id });
}

async function savePin(pin: { type: db.PinType; itemId: string }) {
  logger.trackEvent(AnalyticsEvent.ActionPinChat);
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
  logger.trackEvent(AnalyticsEvent.ActionUnpinChat);
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
  const channel = await db.getChannel({ id: channelId });
  let group = null;
  if (channel && channel.groupId) {
    group = await db.getGroup({ id: channel.groupId });
  }
  if (channel) {
    logger.trackEvent(
      AnalyticsEvent.ActionVisitedChannel,
      logic.getModelAnalytics({ channel, group })
    );
  }
  await db.updateChannel({ id: channelId, lastViewedAt: Date.now() });
}

export async function markChannelRead({
  id,
  groupId,
  includeThreads,
}: {
  id: string;
  groupId?: string;
  includeThreads?: boolean;
}) {
  logger.log(`marking channel as read`, id, 'includeThreads', includeThreads);
  // optimistic update
  const existingUnread = await db.getChannelUnread({ channelId: id });
  if (existingUnread) {
    await db.clearChannelUnread(id);
  }

  let existingThreadUnreads: db.ThreadUnreadState[] = [];
  if (includeThreads) {
    existingThreadUnreads = await db.getThreadUnreadsByChannel({
      channelId: id,
      excludeRead: true,
    });
    await db.clearChannelThreadUnreads({ channelId: id });
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
    await api.readChannel({
      channelId: existingChannel.id,
      channelType: existingChannel.type,
      groupId: existingChannel.groupId,
      deep: !!includeThreads,
    });
  } catch (e) {
    logger.error('Failed to read channel', { id, groupId }, e);
    // rollback optimistic update
    if (existingUnread) {
      await db.insertChannelUnreads([existingUnread]);
    }
    if (existingThreadUnreads.length > 0) {
      await db.insertThreadUnreads(existingThreadUnreads);
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
    // Only rollback on actual errors (not TimeoutError)
    // The backend will send a leaveChannelSuccess event if it did succeed
    if (!(e instanceof TimeoutError)) {
      await db.updateChannel({ id: channelId, currentUserIsMember: true });
    }
  }
}

export async function joinGroupChannel({
  channelId,
  groupId,
}: {
  channelId: string;
  groupId: string;
}) {
  logger.trackEvent(
    AnalyticsEvent.ActionJoinChannel,
    logic.getModelAnalytics({
      channel: { id: channelId },
      group: { id: groupId },
    })
  );
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

export async function addChannelWriters({
  channelId,
  writers,
}: {
  channelId: string;
  writers: string[];
}) {
  logger.log('adding writers', writers);
  logger.trackEvent(AnalyticsEvent.ActionUpdateChannelWriters, {
    ...logic.getModelAnalytics({ channel: { id: channelId } }),
    updateType: 'add',
    writerCount: writers.length,
  });
  const channel = await db.getChannel({ id: channelId, includeWriters: true });
  if (!channel) {
    throw new Error('Channel not found');
  }
  const currentWriters = channel.writerRoles.map((role) => role.roleId);
  const newWriters = writers.filter(
    (roleId) => !currentWriters.includes(roleId)
  );
  const writerRoles = [
    ...channel.writerRoles,
    ...newWriters.map((roleId) => ({
      channelId: channel.id,
      roleId,
    })),
  ];

  logger.log('new writer roles', writerRoles);

  // optimistic update
  const updatedChannel = {
    ...channel,
    writerRoles,
  };
  await db.updateChannel(updatedChannel);
  logger.log('updated channel', updatedChannel);

  try {
    await api.addChannelWriters({ channelId, writers });
    logger.log('added writers');
  } catch (e) {
    logger.error('Failed to add channel writers', e);
    // rollback optimistic update
    await db.updateChannel(channel);
  }
}

export async function removeChannelWriters({
  channelId,
  writers,
}: {
  channelId: string;
  writers: string[];
}) {
  logger.log('removing writers', writers);
  logger.trackEvent(AnalyticsEvent.ActionUpdateChannelWriters, {
    ...logic.getModelAnalytics({ channel: { id: channelId } }),
    updateType: 'remove',
    writerCount: writers.length,
  });
  const channel = await db.getChannel({ id: channelId, includeWriters: true });
  if (!channel) {
    throw new Error('Channel not found');
  }
  const writerRoles = channel.writerRoles.filter(
    (role) => !writers.includes(role.roleId)
  );

  logger.log('new writer roles', writerRoles);

  // optimistic update
  const updatedChannel = {
    ...channel,
    writerRoles,
  };
  await db.updateChannel(updatedChannel);
  logger.log('updated channel', updatedChannel);

  try {
    await api.removeChannelWriters({ channelId, writers });
    logger.log('removed writers');
  } catch (e) {
    logger.error('Failed to remove channel writers', e);
    // rollback optimistic update
    await db.updateChannel(channel);
  }
}
