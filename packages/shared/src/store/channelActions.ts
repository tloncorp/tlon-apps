import * as api from '@tloncorp/api';
import {
  ChannelContentConfiguration,
  StructuredChannelDescriptionPayload,
} from '@tloncorp/api';
import { TimeoutError } from '@tloncorp/api';
import { GroupChannelV7, getChannelKindFromType } from '@tloncorp/api/urbit';
import { isEqual } from 'lodash';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as logic from '../logic';
import { getRandomId } from '../logic';
import { notesPermissionsCompatActive } from '../logic/notesPermissionsCompat';
import { trackProductEvent } from '../productAnalytics';
import { syncNotesNotebook } from './notesActions';

const logger = createDevLogger('ChannelActions', false);
const NOTES_CHANNEL_LISTING_ATTEMPTS = 5;
const NOTES_CHANNEL_LISTING_DELAY_MS = 250;

class NotesChannelListingUnverifiedError extends Error {}

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

async function createNotesChannel({
  groupId,
  title,
  readers = [],
}: {
  groupId: string;
  title: string;
  readers?: string[];
}): Promise<db.Channel> {
  // Create the notebook via the %notes HTTP API, which returns the
  // server-assigned flag synchronously in the response body — no polling, no
  // forced-public visibility hack. Binding it to this group makes the notebook
  // a group channel: read permission defers to the group's can-read, and
  // %groups auto-joins/leaves members via the channel-host convention.
  //
  // `readers` (the group role-ids the channel is restricted to) is forwarded
  // so the %notes host registers the group channel with the correct reader
  // roles — empty means group-wide readable. Dropping it would create every
  // notes channel open, defeating the group's can-read gate.
  const [groupHost, groupName] = groupId.split('/');
  let createdNotebookFlag: api.NotesFlag | null = null;
  let insertedChannelId: string | null = null;
  try {
    const summary = await api.notes.createGroupNotebook({
      title,
      group: { host: groupHost, flagName: groupName },
      readers,
    });

    createdNotebookFlag = { host: summary.host, name: summary.flagName };
    const channelId = `notes/${summary.host}/${summary.flagName}`;
    logger.trackEvent(
      AnalyticsEvent.ActionCreateChannel,
      logic.getModelAnalytics({
        channel: { id: channelId, type: 'notes' },
        group: { id: groupId },
      })
    );

    const newChannel = await waitForNotesChannelListing(groupId, channelId);
    await db.insertChannels([newChannel]);
    insertedChannelId = newChannel.id;
    await db.insertChannelPerms([
      {
        channelId: newChannel.id,
        readers:
          newChannel.readerRoles?.map(
            (role: { roleId: string }) => role.roleId
          ) ?? [],
        writers:
          newChannel.writerRoles?.map(
            (role: { roleId: string }) => role.roleId
          ) ?? [],
      },
    ]);

    syncNotesNotebook(createdNotebookFlag).catch((e) => {
      logger.error('Failed to sync notes notebook after channel create', e);
    });

    return newChannel;
  } catch (e) {
    if (insertedChannelId) {
      try {
        await db.deleteChannels([insertedChannelId]);
      } catch (rollbackError) {
        logger.error(
          'Failed to roll back local notes channel create',
          rollbackError
        );
      }
    }
    if (
      createdNotebookFlag &&
      !(e instanceof NotesChannelListingUnverifiedError)
    ) {
      try {
        await api.deleteNotesNotebookStrict(createdNotebookFlag);
      } catch (rollbackError) {
        logger.error(
          'Failed to roll back notes notebook create',
          rollbackError
        );
      }
    }
    logger.error('Failed to add notes channel', e);
    throw new Error(`Failed to add notes channel to group`);
  }
}

async function waitForNotesChannelListing(groupId: string, channelId: string) {
  let lastGroupReadSucceeded = false;

  for (
    let attempt = 1;
    attempt <= NOTES_CHANNEL_LISTING_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const group = await api.getGroup(groupId);
      const listedChannel = group.channels?.find(
        (channel) => channel.id === channelId
      );
      if (listedChannel) {
        return listedChannel;
      }
      lastGroupReadSucceeded = true;
    } catch {
      lastGroupReadSucceeded = false;
    }

    if (attempt < NOTES_CHANNEL_LISTING_ATTEMPTS) {
      await wait(NOTES_CHANNEL_LISTING_DELAY_MS);
    }
  }

  if (lastGroupReadSucceeded) {
    throw new Error(`Notes channel listing did not appear: ${channelId}`);
  }
  throw new NotesChannelListingUnverifiedError(
    `Could not verify notes channel listing: ${channelId}`
  );
}

function wait(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
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
    const flag = api.parseNotesChannelId(channelId);
    if (flag) {
      const notebookFlag = api.formatNotesFlag(flag);
      await db.deleteNotesNotebook(notebookFlag);
      try {
        await api.deleteNotesNotebookStrict(flag);
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
  const managesWriters = !notesPermissionsCompatActive(channel.type);
  const currentChannel = await db.getChannel({
    id: channel.id,
    includeWriters: true,
  });
  const currentChannelWriterIds = currentChannel?.writerRoles?.map(
    (role) => role.roleId
  );
  logger.log('currentChannelWriterIds', currentChannelWriterIds);
  const writersToAdd = managesWriters
    ? writers.filter((roleId) => !currentChannelWriterIds?.includes(roleId))
    : [];
  const writersToRemove = managesWriters
    ? currentChannelWriterIds?.filter((roleId) => !writers.includes(roleId)) ??
      []
    : [];

  const updatedChannel: db.Channel = {
    ...channel,
    readerRoles: readers.map((roleId) => ({
      channelId: channel.id,
      roleId,
    })),
    writerRoles: (managesWriters ? writers : []).map((roleId) => ({
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
    trackProductEvent(AnalyticsEvent.PostPinned, {
      channelType: channel.type,
    });
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
    trackProductEvent(AnalyticsEvent.PostUnpinned, {
      channelType: channel.type,
    });
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

// Slot-preserving reorder, matching the backend %set-order semantics and the
// frontend mergeVisibleOrderIntoFull: reorder only the ids `desired` names
// (∩ currently pinned, de-duped) into the slots they currently occupy, leaving
// any omitted pinned id fixed in place.
function normalizeOrder(desired: string[], current: db.Pin[]): string[] {
  const order = [...current]
    .sort((a, b) => a.index - b.index)
    .map((p) => p.itemId);
  const pinnedSet = new Set(order);
  const wanted = [...new Set(desired)].filter((id) => pinnedSet.has(id));
  const wantedSet = new Set(wanted);
  let w = 0;
  return order.map((id) => (wantedSet.has(id) ? wanted[w++] : id));
}

// Persist a reorder of the pinned items. Optimistically writes the new order,
// pokes the backend, and re-asserts on success so a stale in-flight sync can't
// leave the UI reverted. Never throws — returns true on success, false on
// failure (after a best-effort backend reconcile) so drag handlers can roll
// back their optimistic UI.
//
// The optimistic local write and the backend poke take *different* orders:
//   - `optimisticOrder` is the full merged pin order (incl. hidden pins in a
//     filtered view) and is what we write locally.
//   - `backendOrder` is only the ids the user actually reordered in the visible
//     subset. We send just those to `%set-order` so the backend leaves hidden
//     pins in their current server-side slots. Sending the full order would name
//     hidden pins too, and could move a hidden pin a peer reordered on another
//     device back to this client's stale slot.
// For full-list surfaces the visible set *is* the full set, so both are equal.
export async function reorderPinnedItems({
  optimisticOrder,
  backendOrder,
}: {
  optimisticOrder: string[];
  backendOrder: string[];
}): Promise<boolean> {
  const before = await db.getPinnedItems();
  const previousOrder = [...before]
    .sort((a, b) => a.index - b.index)
    .map((p) => p.itemId);
  const normalized = normalizeOrder(optimisticOrder, before);

  if (isEqual(previousOrder, normalized)) {
    return true; // no-op drop
  }

  await db.setPinnedItemsOrder(normalized); // optimistic (full local order)

  // Backend payload: only the reordered visible ids, deduped and intersected
  // with the current pinned set — never expanded back to the full order.
  const pinnedSet = new Set(before.map((p) => p.itemId));
  const backendPayload = [...new Set(backendOrder)].filter((id) =>
    pinnedSet.has(id)
  );

  try {
    await api.setPinnedItemOrder(backendPayload);
    // Re-assert after success: a sync whose scry predated the poke may have
    // written a newer order locally mid-flight. Re-normalize against the current
    // local set and write again so our reorder isn't reverted.
    //
    // Invariant: anything that defers to the backend's authority — the poke AND
    // this reassert — operates on the visible-only `backendPayload`, NOT the full
    // `optimisticOrder`. Re-asserting the full order would re-name hidden pins and
    // could drag a hidden pin a mid-poke sync just moved back to this client's
    // stale slot. Only the optimistic write above is the full merged order.
    const after = await db.getPinnedItems();
    await db.setPinnedItemsOrder(normalizeOrder(backendPayload, after));
    trackProductEvent(AnalyticsEvent.PinnedChatsReordered);
    return true;
  } catch (e) {
    console.error('Failed to reorder pinned items', e);
    // Best-effort reconcile to the authoritative backend order. The scry usually
    // fails for the same reason the poke did, so guard it and always return false.
    try {
      const items = await api.getPinnedItems();
      if (items.length === 0) {
        // Authoritative snapshot is empty — clear local pins. `insertPinnedItems([])`
        // is a no-op, so use the explicit clear (targeted to this reconcile path,
        // not a global insertPinnedItems behavior change).
        await db.clearPinnedItems();
      } else {
        await db.insertPinnedItems(items);
      }
    } catch (reconcileErr) {
      console.error(
        'Failed to reconcile pins after reorder failure',
        reconcileErr
      );
      // Local-only fallback: undo our optimistic write, but only if nothing else
      // changed local pins meanwhile (don't clobber a concurrent sync).
      const current = await db.getPinnedItems();
      const currentOrder = [...current]
        .sort((a, b) => a.index - b.index)
        .map((p) => p.itemId);
      if (isEqual(currentOrder, normalized)) {
        await db.setPinnedItemsOrder(previousOrder);
      }
    }
    return false;
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
  const existingGroupUnread = groupId
    ? await db.getGroupUnread({ groupId })
    : null;

  let existingThreadUnreads: db.ThreadUnreadState[] = [];
  if (includeThreads) {
    existingThreadUnreads = await db.getThreadUnreadsByChannel({
      channelId: id,
      excludeRead: true,
    });
    await db.clearChannelThreadUnreads({ channelId: id });
  }
  if (existingUnread) {
    await db.clearChannelUnread(id);
  }

  const remainingNotifyingChannelUnreads =
    groupId && existingUnread?.notify === true
      ? await db.getNotifyingChannelUnreadsByGroup({ groupId })
      : [];
  const existingCount = existingUnread?.count ?? 0;
  const channelUnreadWasNotificationOnly =
    existingUnread?.notify === true &&
    (existingUnread.count ?? 0) === 0 &&
    (existingUnread.countWithoutThreads ?? 0) === 0;
  const groupUnreadLooksLikeSameNotification =
    existingGroupUnread?.notify === true &&
    (existingGroupUnread.count ?? 0) === 0 &&
    existingGroupUnread.updatedAt === existingUnread?.updatedAt;
  const shouldUpdateGroupNotification =
    existingUnread?.notify === true &&
    existingGroupUnread?.notify === true &&
    (existingCount > 0 ||
      (existingGroupUnread.notifyCount ?? 0) > 1 ||
      (channelUnreadWasNotificationOnly &&
        groupUnreadLooksLikeSameNotification));
  const nextGroupUnread = existingGroupUnread
    ? { ...existingGroupUnread }
    : null;
  if (nextGroupUnread && existingCount > 0) {
    nextGroupUnread.count = Math.max(
      (nextGroupUnread.count ?? 0) - existingCount,
      0
    );
  }
  if (nextGroupUnread && shouldUpdateGroupNotification) {
    const remainingNotifyCount = remainingNotifyingChannelUnreads.length;
    nextGroupUnread.notifyCount = Math.max(
      (nextGroupUnread.notifyCount ?? 0) - 1,
      remainingNotifyCount,
      0
    );
    if (
      nextGroupUnread.notifyCount === remainingNotifyCount &&
      remainingNotifyCount > 0
    ) {
      // Keep the "same notification" guard valid if the newest channel
      // notification was the one just cleared.
      nextGroupUnread.updatedAt = Math.max(
        ...remainingNotifyingChannelUnreads.map((unread) => unread.updatedAt)
      );
    }
    nextGroupUnread.notify = nextGroupUnread.notifyCount > 0;
  }
  let didUpdateGroupUnread = false;
  if (
    groupId &&
    nextGroupUnread &&
    (existingCount > 0 || shouldUpdateGroupNotification)
  ) {
    if (
      (nextGroupUnread.count ?? 0) === 0 &&
      (nextGroupUnread.notifyCount ?? 0) === 0
    ) {
      await db.clearGroupUnread(groupId);
    } else {
      await db.insertGroupUnreads([nextGroupUnread]);
    }
    didUpdateGroupUnread = true;
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
    if (didUpdateGroupUnread && existingGroupUnread) {
      await db.insertGroupUnreads([existingGroupUnread]);
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
    if (api.parseNotesChannelId(channelId)) {
      await api.leaveNotesChannel(channelId);
    } else {
      await api.leaveChannel(channelId);
    }
  } catch (e) {
    console.error('Failed to leave channel', e);
    // Only rollback on actual errors (not TimeoutError)
    // If the leave did succeed, %groups will confirm via an active-channel delta
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
    if (api.parseNotesChannelId(channelId)) {
      await api.joinNotesChannel(channelId);
    } else {
      await api.joinChannel(channelId, groupId);
    }
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
