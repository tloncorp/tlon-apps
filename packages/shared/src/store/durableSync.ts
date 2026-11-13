import { MESSAGE_SEARCH_QUERY_KEY } from './useMessageSearch';
import { durableComputingPresence } from '@tloncorp/api/client/durablePresence';
import { clearPresenceState, handlePresenceEvent } from './presence';
import { DurableActivity } from '@tloncorp/api/client/durableActivity';
import { extractClientVolumes } from '@tloncorp/api/client/activity';
import { resetActivityFetchers } from './useActivityFetchers';
import {
  configureClient,
  parseBucketsChannelId,
  setDeskSupportsBuckets,
} from '@tloncorp/api';
import {
  type DurableClient,
  type DurableBootstrap,
  type DurableInbox,
  type DurableMessage,
  getDurableClient,
  durablePostId,
} from '@tloncorp/api/client/durable';
import { durableMessageToPost } from '@tloncorp/api/client/postsApi';
import {
  durableHiddenPostIds,
  setDurableHidden,
} from '@tloncorp/api/client/durableMessages';
import * as db from '../db';
import { type QueryCtx, batchEffects, withTransactionCtx } from '../db/query';
import { durableBucketSync } from './durableBucketSync';
import { DurableRoomSync } from './durableRoomSync';
import { setSession, updateSession, updateInitializedClient } from './session';
import { handleAddPost } from './sync/sync';

type RoomPage = {
  messages: DurableMessage[];
  cursor: number;
  more: boolean;
  reset?: boolean;
};
let activeSession: DurableSession | undefined;

export async function startDurableSync(onError: (error: Error | null) => void) {
  const session = new DurableSession(getDurableClient()!, onError);
  await session.start();
  activeSession = session;
  return () => {
    if (activeSession === session) activeSession = undefined;
    session.stop();
  };
}

export function acquireDurableConversation(channelId: string): () => void {
  return activeSession?.acquire(channelId) ?? (() => {});
}

class DurableSession {
  private readonly active = new Map<
    string,
    { refs: number; sync: { start(): Promise<void>; stop(): void } }
  >();
  private readonly cached: string[] = [];
  private knownRooms = new Map<string, string>();
  private groupIds: string[] = [];
  private inbox?: DurableInbox;
  private stopped = false;
  private readonly directory: DurableRoomSync<{
    cursor: number;
    more: boolean;
    bootstrap: DurableBootstrap;
  }>;
  private readonly summaries: DurableRoomSync<{
    cursor: number;
    more: boolean;
    inbox: DurableInbox;
    activity: Awaited<ReturnType<DurableActivity['initial']>>;
  }>;

  constructor(
    private readonly client: DurableClient,
    private readonly onError: (error: Error | null) => void
  ) {
    this.directory = new DurableRoomSync({
      connect: () => client.events('directory'),
      read: async () => {
        const bootstrap = await client.initialize();
        return { cursor: bootstrap.revision, more: false, bootstrap };
      },
      apply: (page) => this.reconcile(page.bootstrap),
      status: (channelStatus) => updateSession({ channelStatus }),
      error: onError,
    });
    this.summaries = new DurableRoomSync({
      connect: () => client.events('*'),
      read: async () => ({
        cursor: 0,
        more: false,
        inbox: await client.inbox(),
        activity: await new DurableActivity(client).initial(),
      }),
      apply: async (page) => {
        await this.applyInbox(page.inbox);
        await this.applyActivity(page.activity);
      },
      status: () => {},
      error: onError,
    });
  }

  async start() {
    await configureClient({
      shipName: this.client.bootstrap.user.contactId,
      shipUrl: '',
    });
    updateInitializedClient(true);
    setDeskSupportsBuckets(true);
    setSession({
      startTime: Date.now(),
      channelStatus: 'active',
      phase: 'high',
      deskCompat: { status: 'ok' },
    });
    await db.insertSettings({
      activitySeenTimestamp: 0,
      theme: 'auto',
      enableTelemetry: false,
      disableRemoteContent: true,
      completedWayfindingSplash: true,
      completedWayfindingTutorial: true,
    });
    this.knownRooms = new Map(
      this.client.bootstrap.rooms.map((room) => [room.id, room.channelId])
    );
    this.groupIds = this.client.bootstrap.groups.map((group) => group.id);
    try {
      await Promise.all([this.directory.start(), this.summaries.start()]);
    } catch (error) {
      this.stop();
      throw error;
    }
    await db.userHasCompletedFirstSync.setValue(true);
    updateSession({ phase: 'ready', isSyncing: false });
  }

  acquire(channelId: string): () => void {
    const allowed = this.client.bootstrap.rooms.find(
      (room) => room.channelId === channelId
    );
    if (!allowed || allowed.left?.includes(this.client.user)) return () => {};
    let entry = this.active.get(channelId);
    if (!entry && parseBucketsChannelId(channelId)) {
      const sync = durableBucketSync(this.client, channelId, this.onError);
      entry = { refs: 0, sync };
      this.active.set(channelId, entry);
      void sync.start().catch(this.onError);
    }
    if (!entry) {
      const room = this.client.room(channelId);
      const sync = new DurableRoomSync<RoomPage>({
        connect: () => this.client.events(room.id),
        read: async (after) => {
          if (after) return this.client.changes(channelId, after);
          const page = await this.client.window(channelId, { count: 50 });
          return {
            messages: page.messages.reverse(),
            cursor: page.cursor,
            more: false,
          };
        },
        apply: (page) => this.applyMessages(channelId, page),
        status: () => {},
        error: this.onError,
      });
      entry = { refs: 0, sync };
      this.active.set(channelId, entry);
      void sync.start().catch(this.onError);
    }
    entry.refs++;
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--entry!.refs > 0) return;
      entry!.sync.stop();
      this.active.delete(channelId);
      const index = this.cached.indexOf(channelId);
      if (index >= 0) this.cached.splice(index, 1);
      this.cached.push(channelId);
      void this.prune().catch(this.onError);
    };
  }

  stop() {
    this.stopped = true;
    clearPresenceState();
    this.directory.stop();
    this.summaries.stop();
    for (const entry of this.active.values()) entry.sync.stop();
    this.active.clear();
  }

  private async applyMessages(channelId: string, page: RoomPage) {
    const threads = await this.client.threadUnreads(channelId);
    await batchEffects('durableMessages', (ctx) =>
      withTransactionCtx(ctx, async (tx) => {
        if (this.stopped || !this.active.has(channelId)) return;
        if (page.reset) {
          await db.pruneDurableRoom({ channelId }, tx);
          void db.queryClient.resetQueries({
            queryKey: ['channelPosts', channelId],
          });
        }
        const oldThreads = await db.getThreadUnreadsByChannel(
          { channelId },
          tx
        );
        await db.insertThreadUnreads(
          [
            ...oldThreads.map((thread) => ({
              ...thread,
              count: 0,
              notify: false,
              firstUnreadPostId: null,
            })),
            ...threads,
          ],
          tx
        );
        for (const message of page.messages) {
          const post = durableMessageToPost(channelId, message);
          await handleAddPost(post, undefined, tx);
          await db.replacePostReactions(
            { postId: post.id, reactions: post.reactions ?? [] },
            tx
          );
        }
        const summary = this.inbox?.rooms.find(
          (summary) => this.client.room(channelId).id === summary.roomId
        );
        const newest = Math.max(
          summary?.newestSequenceNum ?? 0,
          ...page.messages.map((message) => message.channelSeq ?? 0)
        );
        await db.setLatestChannelSequenceNum(
          { channelId, sequenceNum: newest },
          tx
        );
        await db.updateChannel({ id: channelId, syncedAt: Date.now() }, tx);
      })
    );
  }

  private async reconcile(bootstrap: DurableBootstrap) {
    const allowed = new Set(bootstrap.rooms.map((room) => room.id));
    const unjoined = bootstrap.rooms
      .filter((room) => room.left?.includes(this.client.user))
      .map((room) => room.channelId);
    const removed = [...this.knownRooms]
      .filter(([id]) => !allowed.has(id))
      .map(([, channel]) => channel);
    for (const channel of [...removed, ...unjoined]) {
      this.active.get(channel)?.sync.stop();
      this.active.delete(channel);
    }
    await batchEffects('durableDirectory', (ctx) =>
      withTransactionCtx(ctx, async (tx) => {
        if (removed.length) await db.deleteChannels(removed, tx);
        for (const channelId of unjoined)
          await db.pruneDurableRoom({ channelId }, tx);
        for (const id of this.groupIds)
          if (!bootstrap.groups.some((group) => group.id === id))
            await db.deleteGroup(id, tx);
        await db.insertContacts(this.client.contacts(), tx);
        const groups = this.client.groups();
        for (const group of groups) {
          const old = await db.getGroup({ id: group.id }, tx);
          for (const role of old?.roles ?? [])
            if (!group.roles?.some((saved) => saved.id === role.id))
              await db.deleteGroupRole(
                { groupId: group.id, roleId: role.id },
                tx
              );
          for (const section of old?.navSections ?? [])
            if (!group.navSections?.some((saved) => saved.id === section.id))
              await db.deleteNavSection(section.id, tx);
          await db.deleteGroupMemberBans(
            {
              groupId: group.id,
              contactIds: (old?.bannedMembers ?? []).map(
                (member) => member.contactId
              ),
            },
            tx
          );
          await db.deleteGroupJoinRequests(
            {
              groupId: group.id,
              contactIds: (old?.joinRequests ?? []).map(
                (member) => member.contactId
              ),
            },
            tx
          );
          const members = (old?.members ?? []).filter(
            (member) =>
              !group.members?.some(
                (saved) => saved.contactId === member.contactId
              )
          );
          if (members.length)
            await db.removeChatMembers(
              {
                chatId: group.id,
                contactIds: members.map((member) => member.contactId),
              },
              tx
            );
        }
        await db.insertGroups({ groups }, tx);
        for (const group of groups)
          await db.insertGroupMembersPage(
            { groupId: group.id, members: group.members ?? [] },
            tx
          );
        for (const channel of this.client.channels()) {
          if (await db.getChannel({ id: channel.id }, tx)) {
            const {
              id,
              title,
              description,
              type,
              contentConfiguration,
              groupId,
              contactId,
              currentUserIsMember,
              currentUserIsHost,
              writerRoles,
              readerRoles,
            } = channel;
            await db.updateChannel(
              {
                id,
                title,
                description,
                type,
                contentConfiguration,
                groupId,
                contactId,
                currentUserIsMember,
                currentUserIsHost,
                writerRoles,
                readerRoles,
                isPendingChannel: false,
                isDmInvite: false,
              },
              tx
            );
            if (channel.members?.length)
              await db.insertMembers({ members: channel.members }, tx);
          } else await db.insertChannels([channel], tx);
        }
        this.groupIds = groups.map((group) => group.id);
        this.knownRooms = new Map(
          bootstrap.rooms.map((room) => [room.id, room.channelId])
        );
      })
    );
    void db.queryClient.resetQueries({ queryKey: [MESSAGE_SEARCH_QUERY_KEY] });
    void db.queryClient.resetQueries({
      predicate: (query) =>
        query.queryKey[0] === 'channel' && query.queryKey[2] === 'search',
    });
    await this.applyInbox(await this.client.inbox());
  }

  private activityVersion = '';

  private async applyActivity(
    activity: Awaited<ReturnType<DurableActivity['initial']>>
  ) {
    if (this.stopped || this.activityVersion === activity.version) return;
    await batchEffects('durableActivity', (ctx) =>
      withTransactionCtx(ctx, async (tx) => {
        await db.clearActivityEvents(tx);
        await db.insertActivityEvents(activity.events, tx);
        await db.setVolumes(
          {
            volumes: extractClientVolumes(activity.volumes),
            deleteOthers: true,
          },
          tx
        );
      })
    );
    this.activityVersion = activity.version;
    resetActivityFetchers();
    void db.queryClient.invalidateQueries({
      queryKey: [MESSAGE_SEARCH_QUERY_KEY],
    });
  }

  private async applyInbox(inbox: DurableInbox) {
    const presence = durableComputingPresence(
      this.client.bootstrap,
      inbox.rooms
    );
    const threadPages = await Promise.all(
      [...this.active.keys()].map(async (channelId) => ({
        channelId,
        rows: await this.client.threadUnreads(channelId),
      }))
    );
    await batchEffects('durableInbox', (ctx) =>
      withTransactionCtx(ctx, async (tx) => {
        if (
          this.stopped ||
          inbox.state.revision < (this.inbox?.state.revision ?? -1) ||
          inbox.activity.revision < (this.inbox?.activity.revision ?? -1)
        )
          return;
        inbox = {
          ...inbox,
          rooms: inbox.rooms.map((summary) => {
            const previous = this.inbox?.rooms.find(
              (room) => room.roomId === summary.roomId
            );
            return previous && previous.cursor > summary.cursor
              ? previous
              : summary;
          }),
        };
        this.inbox = inbox;
        handlePresenceEvent({ type: 'init', states: presence });
        for (const { channelId, rows } of threadPages) {
          if (!this.active.has(channelId)) continue;
          const previous = await db.getThreadUnreadsByChannel(
            { channelId },
            tx
          );
          for (const old of previous)
            if (
              old.threadId &&
              !rows.some((row) => row.threadId === old.threadId)
            )
              await db.clearThreadUnread(
                { channelId, threadId: old.threadId },
                tx
              );
          await db.insertThreadUnreads(rows, tx);
        }
        await db.insertSettings(inbox.state.settings, tx);
        await this.applyPrivacy(inbox.state, tx);
        const pins = inbox.state.pins.filter(
          (id) =>
            this.groupIds.includes(id) ||
            this.client.bootstrap.rooms.some(
              (room) =>
                room.channelId === id && !room.left?.includes(this.client.user)
            )
        );
        for (const pin of await db.getPins(tx))
          if (!pins.includes(pin.itemId))
            await db.deletePinnedItem({ itemId: pin.itemId }, tx);
        await db.insertPinnedItems(
          pins.map((itemId, index) => ({
            itemId,
            index,
            type: this.groupIds.includes(itemId)
              ? ('group' as const)
              : ['chat/', 'heap/', 'buckets/'].some((kind) =>
                    itemId.startsWith(kind)
                  )
                ? ('channel' as const)
                : ('dm' as const),
          })),
          tx
        );
        const activity = new DurableActivity(this.client).unreads(
          inbox.activity
        );
        const unreads: db.ChannelUnread[] = [];
        for (const summary of inbox.rooms) {
          const room = this.client.bootstrap.rooms.find(
            (room) => room.id === summary.roomId
          );
          if (
            !room ||
            room.left?.includes(this.client.user) ||
            !(await db.getChannel({ id: room.channelId }, tx))
          )
            continue;
          if (summary.lastMessage) {
            const post = durableMessageToPost(
              room.channelId,
              summary.lastMessage
            );
            const existing = await db.getPost({ postId: post.id }, tx);
            if (!existing || existing.sequenceNum == null)
              await db.insertChannelPosts(
                { posts: [{ ...post, sequenceNum: null }] },
                tx
              );
          }
          await db.updateChannel(
            {
              id: room.channelId,
              lastPostId: summary.lastMessage
                ? durablePostId(room.channelId, summary.lastMessage.id)
                : null,
              lastPostAt: summary.lastMessage?.sentAt ?? null,
            },
            tx
          );
          await db.setLatestChannelSequenceNum(
            {
              channelId: room.channelId,
              sequenceNum: summary.newestSequenceNum,
            },
            tx
          );
          unreads.push({
            ...activity.channelUnreads.find(
              (unread) => unread.channelId === room.channelId
            )!,
            type: room.groupId ? 'channel' : 'dm',
            updatedAt: Date.now(),
            firstUnreadPostId: summary.unread.firstUnreadId
              ? durablePostId(room.channelId, summary.unread.firstUnreadId)
              : null,
          });
        }
        if (unreads.length) await db.insertChannelUnreads(unreads, tx);
        await db.insertGroupUnreads(activity.groupUnreads, tx);
        if (activity.baseUnread)
          await db.insertBaseUnread(activity.baseUnread, tx);
        for (const room of this.client.bootstrap.rooms)
          await db.clearChannelThreadUnreads({ channelId: room.channelId }, tx);
        await db.insertThreadUnreads(activity.threadActivity, tx);
      })
    );
  }

  // Hidden posts and blocks live in the account's state on its server.
  private async applyPrivacy(state: DurableInbox['state'], tx: QueryCtx) {
    setDurableHidden(state);
    const hidden = durableHiddenPostIds(this.client, state);
    for (const post of await db.getHiddenPosts(tx))
      if (!hidden.includes(post.id))
        await db.updatePost({ id: post.id, hidden: false }, tx);
    await db.resetHiddenPosts(hidden, tx);
    const blocked = state.blocked ?? [];
    for (const contact of await db.getBlockedUsers(tx))
      if (!blocked.includes(contact.id))
        await db.updateContact({ id: contact.id, isBlocked: false }, tx);
    await db.insertBlockedContacts({ blockedIds: blocked }, tx);
  }

  private async prune() {
    while (this.cached.length > 3) {
      const channelId = this.cached.shift()!;
      if (this.active.has(channelId)) continue;
      const room = this.client.bootstrap.rooms.find(
        (room) => room.channelId === channelId
      );
      const preview = this.inbox?.rooms.find(
        (summary) => summary.roomId === room?.id
      )?.lastMessage;
      await db.pruneDurableRoom({
        channelId,
        preview: preview
          ? { ...durableMessageToPost(channelId, preview), sequenceNum: null }
          : undefined,
      });
      db.queryClient.removeQueries({ queryKey: ['channelPosts', channelId] });
    }
  }
}
