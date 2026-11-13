import type { ActivitySummary } from './durableActivity';
import { toClientMeta } from './clientMeta';
import {
  CollectionRendererId,
  DraftInputId,
  PostContentRendererId,
  StructuredChannelDescriptionPayload,
} from './channelContentConfig';
import { hash } from 'fast-sha256';
import { DurableConnection, type DurableEvents } from './durableEvents';
import type { Channel, Contact, Group, PostMetadata } from '../types/models';

export interface DurableMessage {
  id: string;
  seq: number;
  channelSeq?: number;
  authorId: string;
  sentAt: number;
  replyCount?: number;
  replyTime?: number | null;
  replyContactIds?: string[];
  parentId?: string;
  deleted?: boolean;
  editedAt?: number;
  reactions?: Record<string, string>;
  content: unknown[];
  blob?: string;
  metadata?: PostMetadata;
  attachmentIds?: string[];
  text: string;
}
export interface DurableTask {
  id: string;
  owner: string;
  prompt: string;
  dueAt: number;
  everyMs: number | null;
  enabled: boolean;
  definition?: import('../urbit').StewardAutomationTask;
  cron?: { expr: string; tz?: string };
  removed?: boolean;
  runs: number;
  agentOwner?: string;
  kind?: 'prompt' | 'reminder';
  parentId?: string;
}
export interface DurableRoom {
  id: string;
  channelId: string;
  title: string;
  members: string[];
  groupId: string | null;
  kind: 'bot' | 'dm' | 'channel';
  agentOwners?: string[];
  description?: string;
  readers?: string[];
  writers?: string[];
  left?: string[];
  section?: string;
  autoJoin?: boolean;
  host?: string;
  image?: string;
  cover?: string;
}
export interface DurableGroup {
  id: string;
  groupId?: string;
  unavailable?: boolean;
  hosted?: boolean;
  lobby?: boolean;
  title: string;
  description?: string;
  owner: string;
  members: string[];
  invited: string[];
  privacy: 'public' | 'private' | 'secret';
  roles?: { id: string; title: string; description?: string }[];
  memberRoles?: Record<string, string[]>;
  banned?: string[];
  requests?: string[];
  sections?: {
    id: string;
    title: string;
    description?: string;
    channels: string[];
  }[];
  image?: string;
  cover?: string;
  blob?: string | null;
  /** The workspace's agents, which its host states. */
  agents?: DurableWorkspaceAgent[];
}
export interface DurableWorkspaceAgent {
  id: string;
  contactId: string;
  nickname: string;
  enabled: boolean;
  followUps: boolean;
  createdBy: string;
  created: number;
}
/** An agent's settings, which only members read. */
export interface DurableAgentSettings {
  id: string;
  contactId: string;
  nickname: string;
  enabled: boolean;
  followUps: boolean;
  prompt: string;
  /** The contact ID of who last changed the instructions. */
  promptUpdatedBy: string;
  promptUpdatedAt: number;
}
export interface DurableProfile {
  contactId: string;
  revision: number;
  nickname: string;
  bio: string;
  avatar: string;
  cover: string;
  status: string;
}
type ProfileFields = Pick<
  DurableProfile,
  'nickname' | 'bio' | 'avatar' | 'cover' | 'status'
>;

export interface DurableBootstrap {
  user: { id: string; contactId: string; name: string };
  people: {
    id: string;
    contactId: string;
    name: string;
    profile?: DurableProfile;
  }[];
  bot: { contactId: string; name: string; profile?: DurableProfile } | null;
  agents?: {
    /** An assistant's account, or a workspace agent's group key. */
    owner?: string;
    enabled?: boolean;
    contactId: string;
    name: string;
    profile?: DurableProfile;
  }[];
  groups: DurableGroup[];
  revision: number;
  rooms: DurableRoom[];
}

export interface DurableRoomSummary {
  roomId: string;
  computing?: boolean;
  computingAgents?: string[];
  computingProgress?: Record<
    string,
    { commentary?: string; toolNames: string[] }
  >;
  cursor: number;
  newestSequenceNum: number;
  rootSequenceNum: number;
  lastMessage?: DurableMessage;
  unread: {
    count: number;
    countWithoutThreads: number;
    firstUnreadId: string | null;
  };
}
export interface DurableInbox {
  state: DurableUserState;
  rooms: DurableRoomSummary[];
  activity: ActivitySummary;
}
export interface DurableWindow {
  messages: DurableMessage[];
  cursor: number;
  newestSequenceNum: number;
  older: number | null;
  newer: number | null;
}

export class DurableClient {
  bootstrap!: DurableBootstrap;
  private readonly server?: string;
  // `server` is the origin of the account's own server, for a self-hosted
  // account served somewhere other than this page. Without it, requests stay
  // relative to the page.
  constructor(
    private readonly token: string,
    server?: string
  ) {
    this.server = server ? new URL(server).origin : undefined;
  }

  get origin() {
    return this.server ?? globalThis.location?.origin ?? '';
  }

  get baseUrl() {
    return (this.server ?? '') + '/v1';
  }

  get user() {
    return this.bootstrap.user.id;
  }

  authorization() {
    return { Authorization: `Bearer ${this.token}` };
  }

  async exportBundle(groupIds: string[], groupOnly = false) {
    const path = groupOnly
      ? `/groups/${encodeURIComponent(groupIds[0])}/export`
      : `/export?groups=${encodeURIComponent(groupIds.join(','))}`;
    const response = await fetch(this.baseUrl + path, {
      headers: this.authorization(),
    });
    if (!response.ok) throw new Error(await response.text());
    const url = URL.createObjectURL(await response.blob());
    const download = document.createElement('a');
    download.href = url;
    download.download = groupOnly ? 'slab-group.tar' : 'slab-account.tar';
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private bootstrapRequest = 0;
  private bootstrapApplied = 0;

  async initialize() {
    const request = ++this.bootstrapRequest;
    const bootstrap = await this.request<DurableBootstrap>('/bootstrap');
    if (request > this.bootstrapApplied) {
      this.bootstrapApplied = request;
      this.bootstrap = bootstrap;
    }
    return this.bootstrap;
  }

  async request<T>(
    path: string,
    body?: unknown,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      signal,
      method: body === undefined ? 'GET' : 'POST',
      headers: { ...this.authorization(), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!response.ok)
      throw new Error(
        `Local backend: ${response.status} ${await response.text()}`
      );
    if (response.status === 204) return undefined as T;
    const result = (await response.json()) as T;
    await this.cacheDownloadTickets(result, signal);
    return result;
  }

  room(channelId: string) {
    const room = this.bootstrap.rooms.find(
      (room) => room.channelId === channelId
    );
    if (!room)
      throw new Error('This conversation is outside the local milestone');
    return room;
  }

  private readonly messageIds = new Map<string, string>();

  rememberId(channelId: string, raw: string) {
    const id = durablePostId(channelId, raw);
    this.messageIds.set(`${channelId}/${id}`, raw);
    return id;
  }

  async page(channelId: string, after = 0) {
    await this.ensureRoom(channelId);
    const page = await this.request<{
      messages: DurableMessage[];
      cursor: number;
      more: boolean;
    }>(`/rooms/${this.room(channelId).id}/messages?after=${after}`);
    this.remember(channelId, page.messages);
    return page;
  }

  private readonly threadCursors = new Map<string, number | null>();
  private readonly readPositions = new Map<string, number>();
  private summaries: DurableRoomSummary[] = [];

  async inbox(): Promise<DurableInbox> {
    const inbox = await this.request<DurableInbox>('/inbox');
    this.summaries = inbox.rooms;
    for (const summary of inbox.rooms) {
      const room = this.bootstrap.rooms.find(
        (room) => room.id === summary.roomId
      );
      if (!room) continue;
      if (summary.lastMessage)
        this.remember(room.channelId, [summary.lastMessage]);
      if (summary.unread.firstUnreadId)
        this.messageIds.set(
          `${room.channelId}/${durablePostId(room.channelId, summary.unread.firstUnreadId)}`,
          summary.unread.firstUnreadId
        );
    }
    return inbox;
  }

  async window(
    channelId: string,
    options: {
      mode?: 'newest' | 'older' | 'newer' | 'around';
      anchor?: number;
      count?: number;
      parentId?: string;
    } = {}
  ): Promise<DurableWindow> {
    await this.ensureRoom(channelId);
    const query = new URLSearchParams({
      mode: options.mode ?? 'newest',
      count: String(Math.min(200, options.count ?? 50)),
    });
    if (options.anchor !== undefined)
      query.set('anchor', String(options.anchor));
    if (options.parentId !== undefined)
      query.set('parentId', this.messageId(channelId, options.parentId));
    const result = await this.request<DurableWindow>(
      `/rooms/${this.room(channelId).id}/messages?${query}`
    );
    this.remember(channelId, result.messages);
    return result;
  }

  async changes(channelId: string, after: number) {
    const result = await this.request<{
      messages: DurableMessage[];
      cursor: number;
      more: boolean;
      reset?: boolean;
    }>(`/rooms/${this.room(channelId).id}/changes?after=${after}`);
    this.remember(channelId, result.messages);
    return result;
  }

  async message(channelId: string, id: string) {
    const result = await this.request<DurableMessage>(
      `/rooms/${this.room(channelId).id}/message?id=${encodeURIComponent(this.messageId(channelId, id))}`
    );
    this.remember(channelId, [result]);
    return result;
  }

  async thread(channelId: string, id: string) {
    const parent = await this.message(channelId, id);
    const page = await this.window(channelId, {
      parentId: parent.id,
      count: 100,
    });
    this.threadCursors.set(`${channelId}/${parent.id}`, page.older);
    return { parent, replies: page.messages };
  }
  hasOlderReplies(channelId: string, id: string) {
    return (
      this.threadCursors.get(`${channelId}/${this.messageId(channelId, id)}`) !=
      null
    );
  }
  async olderReplies(channelId: string, id: string) {
    const parent = this.messageId(channelId, id);
    const anchor = this.threadCursors.get(`${channelId}/${parent}`);
    if (anchor == null) return [];
    const page = await this.window(channelId, {
      parentId: parent,
      mode: 'older',
      anchor,
      count: 100,
    });
    this.threadCursors.set(`${channelId}/${parent}`, page.older);
    return page.messages;
  }

  private remember(channelId: string, messages: DurableMessage[]) {
    for (const message of messages) {
      this.messageIds.set(
        `${channelId}/${durablePostId(channelId, message.id)}`,
        message.id
      );
      const key = `${channelId}/${message.parentId ?? ''}`;
      this.readPositions.set(
        key,
        Math.max(this.readPositions.get(key) ?? 0, message.seq)
      );
    }
  }

  async history(channelId: string) {
    const messages = new Map<string, DurableMessage>();
    let cursor = 0;
    for (;;) {
      const page = await this.page(channelId, cursor);
      for (const message of page.messages) messages.set(message.id, message);
      cursor = page.cursor;
      if (!page.more) return [...messages.values()];
    }
  }

  async send(
    channelId: string,
    sentAt: number,
    content: unknown[],
    text: string,
    parentId?: string,
    blob?: string,
    metadata?: PostMetadata
  ) {
    await this.ensureRoom(channelId);
    return this.request<DurableMessage>(
      `/rooms/${this.room(channelId).id}/messages`,
      {
        parentId: parentId ? this.messageId(channelId, parentId) : undefined,
        id: `message-${sentAt}`,
        sentAt,
        content,
        blob,
        metadata,
        text,
        client: clientContext(),
      }
    );
  }

  async uploadAttachment(
    channelId: string,
    file: Blob,
    name: string,
    contentType: string,
    dimensions?: { width?: number; height?: number }
  ) {
    await this.ensureRoom(channelId);
    const base = `/rooms/${this.room(channelId).id}/attachments`;
    const ticket = await this.request<{
      id: string;
      url: string;
      headers: Record<string, string>;
    }>(base, { name, size: file.size, contentType, ...dimensions });
    const upload = new URL(ticket.url, this.origin);
    if (upload.origin !== this.origin)
      throw new Error('Invalid upload address');
    const response = await fetch(upload.href, {
      method: 'PUT',
      headers: { ...ticket.headers, ...this.authorization() },
      body: file,
    });
    if (!response.ok)
      throw new Error(`Upload failed (${response.status}). Try again.`);
    const completed = await this.request<{ url: string }>(
      `${base}/${ticket.id}/complete`,
      {}
    );
    return completed.url;
  }

  private readonly downloads = new Map<string, string>();

  private attachmentPath(value: string): string | undefined {
    try {
      const url = new URL(value, this.origin);
      return /^\/v1\/rooms\/[^/]+\/attachments\/[a-f0-9-]{36}\/content$/.test(
        url.pathname
      ) && url.origin === this.origin
        ? url.pathname
        : undefined;
    } catch {
      return undefined;
    }
  }

  private async cacheDownloadTickets(value: unknown, signal?: AbortSignal) {
    const paths = new Set<string>();
    const walk = (item: unknown) => {
      if (Array.isArray(item)) {
        item.forEach(walk);
      } else if (item && typeof item === 'object') {
        for (const [key, value] of Object.entries(item)) {
          if (typeof value === 'string') {
            if (key === 'blob') {
              try {
                walk(JSON.parse(value));
              } catch {
                continue;
              }
            } else if (
              [
                'src',
                'fileUri',
                'posterUri',
                'image',
                'cover',
                'url',
                'previewImageUrl',
              ].includes(key)
            ) {
              const path = this.attachmentPath(value);
              if (path && !this.downloads.has(path)) paths.add(path);
            }
          } else {
            walk(value);
          }
        }
      }
    };
    walk(value);
    if (!paths.size) return;
    const entries = [...paths];
    for (let start = 0; start < entries.length; start += 256) {
      try {
        const response = await fetch(this.baseUrl + '/attachments/ticket', {
          method: 'POST',
          headers: {
            ...this.authorization(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ paths: entries.slice(start, start + 256) }),
          signal,
        });
        if (response.ok) {
          const tickets = (await response.json()) as Record<string, string>;
          Object.entries(tickets).forEach(([path, url]) =>
            this.downloads.set(path, url)
          );
        } else if (response.status === 404) {
          for (const path of entries.slice(start, start + 256)) {
            const file = await fetch(this.origin + path, {
              headers: this.authorization(),
              signal,
            });
            if (
              file.ok &&
              file.redirected &&
              new URL(file.url).origin === this.origin
            ) {
              this.downloads.set(path, file.url);
            }
          }
        }
      } catch {
        if (signal?.aborted) return;
      }
    }
  }

  attachmentUrl(value: string): string {
    const path = this.attachmentPath(value);
    if (!path || value.includes('?ticket=')) return value;
    const download = this.downloads.get(path);
    return download ? new URL(download, this.origin).href : value;
  }

  attachmentContent(value: unknown): unknown {
    if (Array.isArray(value))
      return value.map((item) => this.attachmentContent(item));
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          ['src', 'fileUri', 'posterUri', 'previewImageUrl'].includes(key) &&
          typeof item === 'string'
            ? this.attachmentUrl(item)
            : this.attachmentContent(item),
        ])
      );
    return value;
  }

  messageId(channelId: string, id: string) {
    return (
      this.messageIds.get(`${channelId}/${id}`) ??
      (id.startsWith(channelId + '/') ? id.slice(channelId.length + 1) : id)
    );
  }
  mutate(channelId: string, id: string, action: unknown) {
    return this.request<DurableMessage>(
      `/rooms/${this.room(channelId).id}/mutate`,
      { id: this.messageId(channelId, id), action }
    );
  }
  state() {
    return this.request<DurableUserState>('/state');
  }
  updateState(action: unknown) {
    return this.request<DurableUserState>('/state', action);
  }
  async markRead(channelId: string, parentId?: string) {
    const summary = this.summaries.find(
      (summary) => summary.roomId === this.room(channelId).id
    );
    const threadId = parentId ? this.messageId(channelId, parentId) : undefined;
    const seq = Math.max(
      this.readPositions.get(`${channelId}/${threadId ?? ''}`) ?? 0,
      threadId ? 0 : (summary?.rootSequenceNum ?? 0)
    );
    return this.updateState({
      type: 'read',
      room: this.room(channelId).id,
      threadId,
      seq,
    });
  }
  async threadUnreads(channelId: string) {
    const rows = await this.request<
      {
        parentId: string;
        count: number;
        notify: boolean;
        firstId: string | null;
        firstAt: number | null;
      }[]
    >(`/rooms/${this.room(channelId).id}/thread-unreads`);
    return rows.map((row) => {
      this.messageIds.set(
        `${channelId}/${durablePostId(channelId, row.parentId)}`,
        row.parentId
      );
      return {
        channelId,
        threadId: durablePostId(channelId, row.parentId),
        count: row.count,
        notify: row.notify,
        updatedAt: Date.now(),
        firstUnreadPostId: row.firstId
          ? durablePostId(channelId, row.firstId)
          : null,
        firstUnreadPostReceivedAt: row.firstAt,
      };
    });
  }
  pin(id: string, pinned: boolean) {
    return this.updateState({ type: 'pin', id, pinned });
  }
  private readonly connection = new DurableConnection(
    () => {
      const url = new URL('/v1/events', this.origin);
      url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return url.href;
    },
    () => this.token
  );

  events(roomId: string) {
    return this.connection.listen(roomId);
  }

  private subscriptions = new Map<number, DurableEvents[]>();
  private subscriptionId = -1;
  subscribe(refresh: () => void, onError?: (error: unknown) => void) {
    const id = this.subscriptionId--;
    const streams = this.bootstrap.rooms.map((room) => {
      const stream = this.events(room.id);
      stream.onmessage = refresh;
      stream.onerror = () =>
        onError?.(new Error('Task subscription disconnected'));
      return stream;
    });
    this.subscriptions.set(id, streams);
    return id;
  }
  unsubscribe(id: number) {
    this.subscriptions.get(id)?.forEach((stream) => stream.close());
    this.subscriptions.delete(id);
  }

  async automations() {
    if (!this.bootstrap.bot) return {};
    const bot = this.bootstrap.bot;
    const entries = (
      await Promise.all(
        this.bootstrap.rooms.map(async (room) =>
          (await this.tasks(room.id))
            .filter((task) => task.owner === this.user && !task.removed)
            .map((task) => ({
              agent:
                (this.bootstrap.agents ?? []).find(
                  (agent) => agent.owner === (task.agentOwner ?? task.owner)
                )?.contactId ?? bot.contactId,
              id: `${room.id}:${task.id}`,
              definition: {
                ...task.definition,
                name: task.definition?.name ?? task.prompt,
                enabled: task.enabled,
                payload: { kind: 'agentTurn', message: task.prompt },
                schedule: task.cron
                  ? { kind: 'cron', ...task.cron }
                  : task.everyMs
                    ? { kind: 'every', everyMs: task.everyMs }
                    : { kind: 'at', at: task.dueAt },
                delivery: {
                  mode: 'announce',
                  channel: 'tlon',
                  to: room.groupId
                    ? room.channelId
                    : this.bootstrap.user.contactId,
                },
              } satisfies import('../urbit').StewardAutomationTask,
            }))
        )
      )
    ).flat();
    const byAgent: import('../urbit').StewardAutomationShipTasks = {
      [bot.contactId]: {},
    };
    for (const entry of entries)
      (byAgent[entry.agent] ??= {})[entry.id] = entry.definition;
    return byAgent;
  }
  async editAutomation(
    action: import('../urbit').StewardAutomationEdit,
    requestId?: string
  ) {
    const edit =
      'create' in action
        ? action.create
        : 'update' in action
          ? action.update
          : undefined;
    const key =
      'create' in action
        ? undefined
        : 'update' in action
          ? action.update.id
          : 'delete' in action
            ? action.delete.id
            : action.test.id;
    const roomId =
      key?.split(':')[0] ??
      this.room(
        !edit?.delivery?.to ||
          edit.delivery.to === this.bootstrap.user.contactId
          ? (this.bootstrap.bot?.contactId ?? '')
          : edit.delivery.to
      ).id;
    const stableId = requestId
      ? 'request-' +
        Array.from(
          new Uint8Array(
            await crypto.subtle.digest(
              'SHA-256',
              new TextEncoder().encode(requestId)
            )
          )
        )
          .map((byte) => byte.toString(16).padStart(2, '0'))
          .join('')
          .slice(0, 32)
      : crypto.randomUUID();
    const id = key?.slice(roomId.length + 1) ?? stableId;
    const previous = key
      ? (await this.tasks(roomId)).find((task) => task.id === id)
      : undefined;
    if (key && !previous) throw new Error('Task not found');
    const definition = { ...previous?.definition, ...edit };
    const schedule = definition.schedule as
      | import('../urbit').StewardAutomationSchedule
      | undefined;
    const payload = definition.payload as
      | import('../urbit').StewardAutomationPayload
      | undefined;
    if ('test' in action)
      throw new Error('Test runs are not available on the local backend yet');
    await this.schedule(roomId, {
      id,
      prompt: payload?.message ?? previous?.prompt ?? '',
      dueAt:
        schedule?.kind === 'at'
          ? (schedule.at ?? Date.now())
          : Math.max(previous?.dueAt ?? Date.now(), Date.now()),
      everyMs: schedule?.kind === 'every' ? (schedule.everyMs ?? 60000) : null,
      cron:
        schedule?.kind === 'cron'
          ? { expr: schedule.expr ?? '', tz: schedule.tz }
          : undefined,
      enabled:
        'delete' in action ? false : ((definition.enabled as boolean) ?? true),
      removed: 'delete' in action,
      definition,
    });
    return { requestId: crypto.randomUUID(), id: `${roomId}:${id}` };
  }
  tasks(roomId: string) {
    return this.request<DurableTask[]>(`/rooms/${roomId}/tasks`);
  }
  schedule(roomId: string, task: Omit<DurableTask, 'owner' | 'runs'>) {
    return this.request<DurableTask>(`/rooms/${roomId}/tasks`, task);
  }

  contacts(): Contact[] {
    const agents =
      this.bootstrap.agents ?? (this.bootstrap.bot ? [this.bootstrap.bot] : []);
    const agent = (contactId: string) =>
      agents.some((item) => item.contactId === contactId);
    return [...this.bootstrap.people, ...agents].map((person) => ({
      id: person.contactId,
      peerNickname: person.profile?.nickname ?? person.name,
      peerAvatarImage: person.profile?.avatar
        ? this.avatarUrl(person.profile.avatar)
        : null,
      bio: person.profile?.bio ?? null,
      status: person.profile?.status ?? null,
      coverImage: person.profile?.cover ?? null,
      // As in Tlon, your own entry isn't one of your contacts.
      isContact: person.contactId !== this.bootstrap.user.contactId,
      // Agents carry the bot identity claim (docs/bot-info.md), which marks
      // a contact as a bot everywhere: its badge, and pickers that leave bots
      // out.
      botInfo: agent(person.contactId) ? SLAB_AGENT_CLAIM : null,
      color: agent(person.contactId) ? '#d97742' : '#5b739c',
    }));
  }

  // A profile stores its server's avatar as a path, `/v1/avatars/<id>/<hash>`,
  // which this account's server serves for every peer.
  private avatarUrl(avatar: string) {
    return avatar.startsWith('/') && !avatar.startsWith('//')
      ? this.origin + avatar
      : avatar;
  }

  async updateProfile(patch: Partial<ProfileFields>) {
    let profile = await this.request<DurableProfile>(
      `/profiles/${encodeURIComponent(this.bootstrap.user.contactId)}`
    );
    // A picked avatar waits in the browser until now; it goes to this
    // account's avatar store, which sets and signs it.
    if (patch.avatar?.startsWith('blob:')) {
      const image = await (await fetch(patch.avatar)).blob();
      const response = await fetch(this.baseUrl + '/profile/avatar', {
        method: 'POST',
        headers: { ...this.authorization(), 'Content-Type': image.type },
        body: image,
      });
      if (!response.ok)
        throw new Error(
          `Local backend: ${response.status} ${await response.text()}`
        );
      profile = (await response.json()) as DurableProfile;
      patch = { ...patch };
      delete patch.avatar;
      if (!Object.keys(patch).length) {
        await this.initialize();
        return;
      }
    }
    // The profile editor sends back the avatar it read, which `contacts()`
    // made absolute against this server.
    const ownAvatar = this.origin + '/v1/avatars/';
    if (patch.avatar?.startsWith(ownAvatar))
      patch = { ...patch, avatar: patch.avatar.slice(this.origin.length) };
    await this.request('/commands', {
      requestId: crypto.randomUUID(),
      action: {
        type: 'profile',
        target: 'owner',
        revision: profile.revision,
        patch,
      },
    });
    await this.initialize();
  }

  async directory(action: unknown) {
    const result = await this.request<{ flag?: string; groupId?: string }>(
      '/directory',
      action
    );
    await this.initialize();
    return result;
  }

  async ensureRoom(channelId: string) {
    if (this.bootstrap.rooms.some((room) => room.channelId === channelId))
      return;
    if (!this.bootstrap.people.some((person) => person.contactId === channelId))
      throw new Error('Conversation not found');
    await this.directory({ type: 'dm', contactId: channelId });
  }

  async createGroup(group: Group, contacts: string[], placeholder?: string) {
    const created = await this.directory({
      type: 'createGroup',
      group: {
        id: group.id,
        title: group.title || placeholder || 'New group',
        description: group.description,
        privacy: group.privacy ?? 'secret',
      },
      contacts,
      channels: (group.channels ?? []).map((channel) => ({
        id: channel.id,
        title: channel.title || 'General',
        description: channel.description,
      })),
    });
    return this.group(created?.flag ?? group.id);
  }

  channels(): Channel[] {
    return this.bootstrap.rooms.map((room) => {
      const type = room.groupId
        ? room.channelId.startsWith('heap/')
          ? 'gallery'
          : room.channelId.startsWith('notes/')
            ? 'notes'
            : room.channelId.startsWith('buckets/')
              ? 'buckets'
              : 'chat'
        : 'dm';
      const description = StructuredChannelDescriptionPayload.decode(
        room.description ?? ''
      );
      return {
        id: room.channelId,
        type,
        groupId: room.groupId,
        ...toClientMeta({
          title: room.title,
          description: '',
          image: room.image ?? '',
          cover: room.cover ?? '',
        }),
        description: description.description ?? room.description,
        contentConfiguration:
          description.channelContentConfiguration ??
          (type === 'gallery' || type === 'notes'
            ? {
                draftInput: DraftInputId[type],
                defaultPostContentRenderer: PostContentRendererId[type],
                defaultPostCollectionRenderer: CollectionRendererId[type],
              }
            : type === 'buckets'
              ? {
                  draftInput: DraftInputId.buckets,
                  defaultPostContentRenderer: PostContentRendererId.buckets,
                  defaultPostCollectionRenderer: CollectionRendererId.buckets,
                }
              : undefined),
        currentUserIsMember: !room.left?.includes(this.user),
        currentUserIsHost:
          !room.groupId ||
          (room.host ??
            this.bootstrap.groups.find((group) => group.id === room.groupId)
              ?.owner) === this.user,
        contactId: room.groupId ? null : room.channelId,
        writerRoles: (room.writers?.length
          ? [...new Set(['admin', ...room.writers])]
          : []
        ).map((roleId) => ({ channelId: room.channelId, roleId })),
        readerRoles: (room.readers?.length
          ? [...new Set(['admin', ...room.readers])]
          : []
        ).map((roleId) => ({ channelId: room.channelId, roleId })),
        members: (room.groupId
          ? [
              ...room.members.map((id) => this.contactId(id)),
              ...(this.bootstrap.agents ?? [])
                .filter(
                  (agent) =>
                    agent.owner &&
                    (room.agentOwners ?? room.members).includes(agent.owner)
                )
                .map((agent) => agent.contactId),
            ]
          : [room.channelId]
        ).map((contactId) => ({
          chatId: room.channelId,
          contactId,
          membershipType: 'channel' as const,
          status: 'joined' as const,
        })),
        addedToGroupAt: 1,
      };
    });
  }

  groups(): Group[] {
    return this.bootstrap.groups.map((group) => this.group(group.id));
  }

  async previewGroup(id: string): Promise<Group> {
    return this.group(
      id,
      await this.request<DurableGroup>('/group?id=' + encodeURIComponent(id))
    );
  }

  group(id: string, record?: DurableGroup): Group {
    const group =
      record ?? this.bootstrap.groups.find((group) => group.id === id);
    if (!group) throw new Error('Group not found');
    const joined = group.members.includes(this.user);
    const agents = this.groupAgents(group);
    const channels = this.channels().filter(
      (channel) => channel.groupId === id
    );
    return {
      id,
      ...toClientMeta({
        title: group.title,
        description: group.description ?? '',
        image: group.image ?? '',
        cover: group.cover ?? '',
      }),
      blob: group.blob ?? null,
      privacy: group.privacy,
      hostUserId: this.contactId(group.owner),
      currentUserIsMember: joined,
      currentUserIsHost: group.owner === this.user,
      haveInvite: group.invited.includes(this.user),
      haveRequestedInvite: group.requests?.includes(this.user) ?? false,
      bannedMembers: (group.banned ?? []).map((user) => ({
        groupId: id,
        contactId: this.contactId(user),
      })),
      joinRequests: (group.requests ?? []).map((user) => ({
        groupId: id,
        contactId: this.contactId(user),
        requestedAt: 1,
      })),
      joinStatus: null,
      memberCount: group.members.length + agents.length,
      roles: [
        { id: 'admin', groupId: id, title: 'Admin' },
        ...(group.roles ?? []).map((role) => ({ ...role, groupId: id })),
      ],
      members: [
        ...[...group.members, ...group.invited].flatMap((user) =>
          [
            this.contactId(user),
            ...(group.members.includes(user)
              ? agents
                  .filter((agent) => agent.owner === user)
                  .map((agent) => agent.contactId)
              : []),
          ].map((contactId) => ({ contactId, user }))
        ),
        // The workspace's own agents are members of it.
        ...agents
          .filter((agent) => agent.owner === group.groupId)
          .map((agent) => ({ contactId: agent.contactId, user: '' })),
      ].map(({ contactId, user }) => ({
        chatId: id,
        contactId,
        membershipType: 'group' as const,
        status:
          !user || group.members.includes(user)
            ? ('joined' as const)
            : ('invited' as const),
        joinedAt: 1,
        roles: [
          ...new Set([
            ...(user &&
            contactId === this.contactId(user) &&
            user === group.owner
              ? ['admin']
              : []),
            ...(user && contactId === this.contactId(user)
              ? (group.memberRoles?.[user] ?? [])
              : []),
          ]),
        ].map((roleId) => ({
          groupId: id,
          contactId,
          roleId,
        })),
      })),
      channels,
      navSections: joined
        ? this.sections(id).map((section, sectionIndex) => ({
            id: `${id}/${section.id}`,
            groupId: id,
            sectionId: section.id,
            title: section.title,
            description: section.description,
            sectionIndex,
            channels: section.channels
              .filter((channelId) =>
                channels.some((channel) => channel.id === channelId)
              )
              .map((channelId, channelIndex) => ({
                channelId,
                channelIndex,
                groupNavSectionId: `${id}/${section.id}`,
              })),
          }))
        : [],
      syncedAt: Date.now(),
    };
  }

  channelChange(channelId: string, changes: Record<string, unknown>) {
    const room = this.room(channelId);
    if (!room.groupId) throw new Error('Choose a group channel');
    return this.directory({
      type: 'updateChannel',
      groupId: room.groupId,
      channelId,
      ...changes,
    });
  }

  sections(groupId: string) {
    const group = this.bootstrap.groups.find((group) => group.id === groupId);
    if (!group) throw new Error('Group not found');
    return structuredClone(
      group.sections ?? [
        {
          id: 'channels',
          title: 'Channels',
          channels: this.bootstrap.rooms
            .filter((room) => room.groupId === groupId)
            .map((room) => room.channelId),
        },
      ]
    );
  }

  async editSection(
    groupId: string,
    sectionId: string,
    meta?: { title?: string | null; description?: string | null }
  ) {
    let sections = this.sections(groupId);
    if (meta) {
      const section = sections.find((section) => section.id === sectionId);
      if (section)
        Object.assign(section, {
          title: meta.title ?? '',
          description: meta.description ?? '',
        });
      else
        sections.push({
          id: sectionId,
          title: meta.title ?? '',
          description: meta.description ?? '',
          channels: [],
        });
    } else sections = sections.filter((section) => section.id !== sectionId);
    if (!sections.length)
      sections.push({ id: 'channels', title: 'Channels', channels: [] });
    return this.directory({ type: 'navigation', groupId, sections });
  }

  /**
   * The agents that take part in a group: the workspace's own, and those of
   * the members its rooms name as agent owners. A member's assistant that
   * only answers in its own chat is in none of them.
   */
  private groupAgents(group: DurableGroup) {
    const owners = new Set(
      this.bootstrap.rooms
        .filter((room) => room.groupId === group.id)
        .flatMap((room) => room.agentOwners ?? room.members)
    );
    return (this.bootstrap.agents ?? []).filter(
      (agent) =>
        agent.owner &&
        (agent.owner === group.groupId ||
          (group.members.includes(agent.owner) && owners.has(agent.owner)))
    );
  }

  /** A workspace's agents, as its host lists them. */
  workspaceAgents(groupId: string): DurableWorkspaceAgent[] {
    return (
      this.bootstrap.groups.find((group) => group.id === groupId)?.agents ?? []
    );
  }

  agentSettings(groupId: string, agentId: string) {
    return this.request<DurableAgentSettings>(
      `/groups/${encodeURIComponent(groupId)}/agents/${encodeURIComponent(agentId)}`
    );
  }

  async createAgent(
    groupId: string,
    nickname: string,
    prompt: string,
    avatar?: string
  ) {
    return this.directory({
      type: 'agentCreate',
      groupId,
      nickname,
      prompt,
      ...(await avatarFields(avatar)),
    });
  }

  async updateAgent(
    groupId: string,
    agentId: string,
    changes: Partial<
      Pick<
        DurableAgentSettings,
        'nickname' | 'prompt' | 'enabled' | 'followUps'
      >
    > & { avatar?: string }
  ) {
    const { avatar, ...settings } = changes;
    return this.directory({
      type: 'agentUpdate',
      groupId,
      agent: agentId,
      ...settings,
      ...(await avatarFields(avatar)),
    });
  }

  removeAgent(groupId: string, agentId: string) {
    return this.directory({ type: 'agentRemove', groupId, agent: agentId });
  }

  private contactId(user: string) {
    const person = this.bootstrap.people.find((person) => person.id === user);
    if (!person) throw new Error('User not found');
    return person.contactId;
  }
}

/**
 * An avatar picked in this tab (a `blob:` URL from `uploadAvatarAsset`) as
 * the `avatar` and `avatarType` an agent's settings take, base64 encoded.
 */
export async function avatarFields(
  avatar?: string
): Promise<{ avatar?: string; avatarType?: string }> {
  if (!avatar?.startsWith('blob:')) return {};
  const image = await (await fetch(avatar)).blob();
  const bytes = new Uint8Array(await image.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { avatar: btoa(binary), avatarType: image.type };
}

/** What the server said went wrong, from an error `request` threw. */
export function durableErrorText(error: unknown): string | undefined {
  const match =
    error instanceof Error
      ? /^Local backend: \d+ ([\s\S]*)$/.exec(error.message)
      : null;
  if (!match) return undefined;
  try {
    const body = JSON.parse(match[1]) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : undefined;
  } catch {
    return match[1] || undefined;
  }
}

/** The bot identity claim of a Slab agent's contact. */
export const SLAB_AGENT_CLAIM = JSON.stringify({
  v: 1,
  harness: 'slab',
  version: '1',
});

let client: DurableClient | undefined;
export function getDurableClient() {
  return client;
}
export function configureDurableClient(value: DurableClient) {
  client = value;
}

export interface DurableUserState {
  revision: number;
  reads: Record<string, number>;
  pins: string[];
  settings: Record<string, unknown>;
  hidden?: string[];
  blocked?: string[];
}

export function durablePostId(channelId: string, messageId: string): string {
  const digest = hash(
    new TextEncoder().encode(JSON.stringify([channelId, messageId]))
  );
  return BigInt(
    '0x' +
      Array.from(digest.slice(0, 16), (byte) =>
        byte.toString(16).padStart(2, '0')
      ).join('')
  ).toString();
}

export function durableReadPosition(
  state: DurableUserState,
  room: string,
  message: DurableMessage
): number {
  return (
    state.reads[
      message.parentId ? `${room}/thread/${message.parentId}` : room
    ] ?? 0
  );
}

export function durableThreadUnreads(
  user: string,
  room: string,
  channelId: string,
  messages: DurableMessage[],
  state: DurableUserState
) {
  const parents = [
    ...new Set(
      messages.flatMap((message) =>
        message.parentId ? [message.parentId] : []
      )
    ),
  ];
  return parents.map((parent) => {
    const unread = messages.filter(
      (message) =>
        message.parentId === parent &&
        !message.deleted &&
        message.authorId !== user &&
        message.seq > durableReadPosition(state, room, message)
    );
    return {
      channelId,
      threadId: durablePostId(channelId, parent),
      updatedAt: Date.now(),
      count: unread.length,
      notify: unread.length > 0,
      firstUnreadPostId: unread[0]
        ? durablePostId(channelId, unread[0].id)
        : null,
      firstUnreadPostReceivedAt: unread[0]?.sentAt ?? null,
    };
  });
}

// The account's assistant reads times like "every morning at 7" in the
// device's timezone.
function clientContext() {
  const { timeZone, locale } = Intl.DateTimeFormat().resolvedOptions();
  return { timezone: timeZone, locale };
}
