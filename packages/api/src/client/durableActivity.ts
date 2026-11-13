import type * as db from '../types/models';
import { BASE_UNREADS_SINGLETON_KEY } from '../types/models';
import type * as ub from '../urbit';
import { sourceToString } from '../urbit';
import { type DurableClient } from './durable';

export type ActivityScope =
  | { kind: 'base' }
  | { kind: 'group'; groupId: string }
  | { kind: 'room'; roomId: string }
  | { kind: 'thread'; roomId: string; parentId: string };
export interface ActivitySummary {
  revision: number;
  notifyCount: number;
  newest: number;
  sources: {
    roomId: string;
    parentId?: string;
    count: number;
    notifyCount: number;
    updatedAt: number;
  }[];
}
export interface ActivityPage {
  events: {
    id: number;
    timestamp: number;
    roomId: string;
    messageId: string;
    messageSeq: number;
    parentId?: string;
    parentAuthorId?: string;
    authorId: string;
    type: 'post' | 'reply' | 'react';
    content: unknown[];
    isMention: boolean;
    isRead: boolean;
  }[];
  nextCursor: number | null;
  summary: ActivitySummary;
  volumes: { scope: ActivityScope; volume: ub.VolumeMap }[];
  revision: number;
  userRevision: number;
  directoryRevision: number;
}

export class DurableActivity {
  constructor(private readonly client: DurableClient) {}

  async page(bucket: db.ActivityBucket, before?: number) {
    const page = await this.client.request<ActivityPage>(
      `/activity?bucket=${bucket}${before === undefined ? '' : `&before=${before}`}`
    );
    return {
      ...page,
      events: this.events(page, bucket),
      relevantUnreads: this.unreads(page.summary),
    };
  }

  async initial() {
    const pages = await Promise.all(
      (['all', 'mentions', 'replies'] as const).map((bucket) =>
        this.page(bucket)
      )
    );
    const latest = [...pages].sort(
      (a, b) => b.revision - a.revision || b.userRevision - a.userRevision
    )[0];
    return {
      events: pages.flatMap((page) => page.events),
      relevantUnreads: latest.relevantUnreads,
      volumes: this.volumes(latest.volumes),
      version: `${latest.revision}/${latest.userRevision}/${latest.directoryRevision}`,
    };
  }

  read(scope: ActivityScope, deep = true) {
    return this.client.request('/activity/read', { scope, deep });
  }

  adjust(source: ub.Source, volume: ub.VolumeMap | null) {
    return this.client.request('/activity/volume', {
      scope: this.scope(source),
      volume,
    });
  }

  unreads(summary: ActivitySummary): db.ActivityInit {
    const now = Date.now();
    const channelUnreads: db.ChannelUnread[] = this.client.bootstrap.rooms.map(
      (room) => {
        const sources = summary.sources.filter(
          (source) => source.roomId === room.id
        );
        const root = sources.find((source) => !source.parentId);
        return {
          channelId: room.channelId,
          type: room.groupId ? 'channel' : 'dm',
          count: sources.reduce((n, s) => n + s.count, 0),
          countWithoutThreads: root?.count ?? 0,
          notify: sources.some((source) => source.notifyCount > 0),
          updatedAt: now,
        };
      }
    );
    const threadActivity: db.ThreadUnreadState[] = summary.sources.flatMap(
      (source) => {
        const room = this.client.bootstrap.rooms.find(
          (room) => room.id === source.roomId
        );
        if (!room || !source.parentId) return [];
        const threadId = this.client.rememberId(
          room.channelId,
          source.parentId
        );
        return [
          {
            channelId: room.channelId,
            threadId,
            count: source.count,
            notify: source.notifyCount > 0,
            updatedAt: source.updatedAt,
          },
        ];
      }
    );
    const groupUnreads = this.client.bootstrap.groups.map((group) => {
      const rooms = new Set(
        this.client.bootstrap.rooms
          .filter((room) => room.groupId === group.id)
          .map((room) => room.id)
      );
      const sources = summary.sources.filter((source) =>
        rooms.has(source.roomId)
      );
      const notifyCount = sources.reduce((n, s) => n + s.notifyCount, 0);
      return {
        groupId: group.id,
        count: sources.reduce((n, s) => n + s.count, 0),
        notifyCount,
        notify: notifyCount > 0,
        updatedAt: now,
      };
    });
    return {
      channelUnreads,
      threadActivity,
      groupUnreads,
      baseUnread: {
        id: BASE_UNREADS_SINGLETON_KEY,
        count: channelUnreads.reduce((n, s) => n + s.count, 0),
        notifyCount: summary.notifyCount,
        notify: summary.notifyCount > 0,
        updatedAt: now,
      },
    };
  }

  volumes(entries: ActivityPage['volumes']): ub.VolumeSettings {
    return Object.fromEntries(
      entries.flatMap(({ scope, volume }) => {
        const source = this.source(scope);
        return source ? [[sourceToString(source), volume]] : [];
      })
    );
  }

  private events(
    page: ActivityPage,
    bucketId: db.ActivityBucket
  ): db.ActivityEvent[] {
    return page.events.flatMap((event) => {
      const room = this.client.bootstrap.rooms.find(
        (room) => room.id === event.roomId
      );
      if (!room) return [];
      const postId = this.client.rememberId(room.channelId, event.messageId);
      const parentId = event.parentId
        ? this.client.rememberId(room.channelId, event.parentId)
        : null;
      return [
        {
          id: String(event.id),
          bucketId,
          sourceId: `${room.id}${parentId ? `/thread/${parentId}` : ''}${event.isMention ? `/mention/${event.id}` : ''}`,
          type: event.type,
          timestamp: event.timestamp,
          postId,
          parentId,
          parentAuthorId: event.parentAuthorId,
          authorId: event.authorId,
          channelId: room.channelId,
          groupId: room.groupId,
          isMention: event.isMention,
          isRead: event.isRead,
          shouldNotify: true,
          content: event.content,
        },
      ];
    });
  }

  private scope(source: ub.Source): ActivityScope {
    if ('base' in source) return { kind: 'base' };
    if ('group' in source) return { kind: 'group', groupId: source.group };
    if ('channel' in source)
      return { kind: 'room', roomId: this.client.room(source.channel.nest).id };
    if ('dm' in source)
      return {
        kind: 'room',
        roomId: this.client.room(this.whom(source.dm)).id,
      };
    if ('thread' in source)
      return {
        kind: 'thread',
        roomId: this.client.room(source.thread.channel).id,
        parentId: this.client.messageId(
          source.thread.channel,
          source.thread.key.time.replaceAll('.', '')
        ),
      };
    if ('dm-thread' in source) {
      const value = source['dm-thread'],
        channel = this.whom(value.whom);
      return {
        kind: 'thread',
        roomId: this.client.room(channel).id,
        parentId: this.client.messageId(
          channel,
          value.key.id.split('/').pop()!.replaceAll('.', '')
        ),
      };
    }
    throw new Error('Unsupported activity source');
  }

  private source(scope: ActivityScope): ub.Source | undefined {
    if (scope.kind === 'base') return { base: null };
    if (scope.kind === 'group') return { group: scope.groupId };
    const room = this.client.bootstrap.rooms.find(
      (room) => room.id === scope.roomId
    );
    if (!room) return;
    if (scope.kind === 'thread') {
      const id = this.client.rememberId(room.channelId, scope.parentId);
      return room.groupId
        ? {
            thread: {
              channel: room.channelId,
              group: room.groupId,
              key: { id, time: id },
            },
          }
        : {
            'dm-thread': {
              whom:
                room.kind === 'dm' && !room.channelId.startsWith('~')
                  ? { club: room.channelId }
                  : { ship: room.channelId },
              key: { id, time: id },
            },
          };
    }
    return room.groupId
      ? { channel: { nest: room.channelId, group: room.groupId } }
      : {
          dm:
            room.kind === 'dm' && !room.channelId.startsWith('~')
              ? { club: room.channelId }
              : { ship: room.channelId },
        };
  }

  private whom(value: ub.Whom) {
    return 'ship' in value ? value.ship : value.club;
  }
}
