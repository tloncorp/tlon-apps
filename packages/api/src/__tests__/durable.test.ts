import { expect, test, vi } from 'vitest';
import {
  DurableClient,
  SLAB_AGENT_CLAIM,
  avatarFields,
  durableErrorText,
  durablePostId,
  durableThreadUnreads,
  type DurableMessage,
} from '../client/durable';

function client() {
  const value = new DurableClient('brian');
  value.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [],
    bot: { contactId: '~ten', name: 'Pi' },
    revision: 0,
    groups: [
      {
        id: '~sampel-palnet/durable',
        title: 'Workspace',
        owner: 'brian',
        members: ['brian', 'galen'],
        invited: [],
        privacy: 'secret',
      },
    ],
    rooms: [
      {
        id: 'brian-bot',
        channelId: '~ten',
        title: 'Pi',
        members: ['brian'],
        groupId: null,
        kind: 'bot',
      },
    ],
  };
  return value;
}

test('owner-addressed task delivery uses the private bot room and creation retries keep their ID', async () => {
  const local = client();
  const schedule = vi.spyOn(local, 'schedule').mockResolvedValue({
    id: 'saved',
    owner: 'brian',
    prompt: 'hello',
    dueAt: 0,
    enabled: true,
    everyMs: null,
    runs: 0,
  });
  const action = {
    create: {
      name: 'Greeting',
      schedule: {
        kind: 'cron' as const,
        expr: '0 9 * * 1-5',
        tz: 'America/Chicago',
      },
      payload: { kind: 'agentTurn', message: 'hello' },
      delivery: {
        mode: 'announce' as const,
        channel: 'tlon',
        to: '~sampel-palnet',
      },
    },
  };
  const first = await local.editAutomation(action, 'same-request');
  const retry = await local.editAutomation(action, 'same-request');
  expect(first.id).toBe(retry.id);
  expect(schedule.mock.calls[0][0]).toBe('brian-bot');
  expect(schedule.mock.calls[0][1]).toMatchObject({
    prompt: 'hello',
    cron: { expr: '0 9 * * 1-5', tz: 'America/Chicago' },
  });
});

test('history coalesces revisions of one message', async () => {
  const local = client();
  const base: DurableMessage = {
    id: 'same',
    seq: 1,
    authorId: '~ten',
    sentAt: 1,
    text: 'old',
    content: [{ inline: ['old'] }],
  };
  vi.spyOn(local, 'page').mockResolvedValue({
    messages: [base, { ...base, text: 'edited', editedAt: 2 }],
    cursor: 2,
    more: false,
  });
  expect(await local.history('~ten')).toEqual([
    { ...base, text: 'edited', editedAt: 2 },
  ]);
});

test('numeric client IDs route mutations back to the original backend message', async () => {
  const local = client();
  const request = vi.spyOn(local, 'request').mockResolvedValue({
    messages: [
      {
        id: 'backend-id',
        seq: 1,
        authorId: '~ten',
        sentAt: 1,
        text: 'hello',
        content: [],
      },
    ],
    cursor: 1,
    more: false,
  });
  await local.page('~ten');
  const id = durablePostId('~ten', 'backend-id');
  expect(() => BigInt(id)).not.toThrow();
  await local.mutate('~ten', id, { type: 'reaction', emoji: '❤️' });
  expect(request).toHaveBeenLastCalledWith('/rooms/brian-bot/mutate', {
    id: 'backend-id',
    action: { type: 'reaction', emoji: '❤️' },
  });
});

test('reading a conversation leaves unread replies in their independent thread', () => {
  const reply: DurableMessage = {
    id: 'reply',
    parentId: 'root',
    seq: 2,
    authorId: '~ten',
    sentAt: 1,
    text: 'Reply',
    content: [],
  };
  const state = {
    revision: 1,
    reads: { general: 3 } as Record<string, number>,
    pins: [],
    settings: {},
  };
  expect(
    durableThreadUnreads(
      '~sampel-palnet',
      'general',
      'chat/~sampel-palnet/general',
      [reply],
      state
    )[0].count
  ).toBe(1);
  state.reads['general/thread/root'] = 2;
  expect(
    durableThreadUnreads(
      '~sampel-palnet',
      'general',
      'chat/~sampel-palnet/general',
      [reply],
      state
    )[0].count
  ).toBe(0);
});

test('private Pi membership includes the bot and direct messages identify their peer', () => {
  const local = client();
  local.bootstrap.people = [
    local.bootstrap.user,
    { id: 'galen', contactId: '~nec', name: 'Galen' },
  ];
  local.bootstrap.rooms.push({
    id: 'dm-brian-galen',
    channelId: '~nec',
    title: 'Galen',
    members: ['brian', 'galen'],
    groupId: null,
    kind: 'dm',
  });
  const channels = local.channels();
  expect(
    channels
      .find((channel) => channel.id === '~ten')
      ?.members?.map((member) => member.contactId)
  ).toEqual(['~ten']);
  expect(channels.find((channel) => channel.id === '~nec')).toMatchObject({
    contactId: '~nec',
    title: 'Galen',
  });
});

test('history windows are bounded and read acknowledgements use raw sequences without loading history', async () => {
  const local = client();
  const history = vi.spyOn(local, 'history');
  const fetcher = vi.fn(async (path: string, options?: RequestInit) => {
    if (path.includes('/messages?'))
      return Response.json({
        messages: [
          {
            id: 'root',
            seq: 12000,
            channelSeq: 10000,
            authorId: '~nec',
            sentAt: 1,
            text: 'Hello',
            content: [],
          },
        ],
        cursor: 15000,
        newestSequenceNum: 10000,
        older: 9951,
        newer: null,
      });
    return Response.json({ revision: 1, reads: {}, pins: [], settings: {} });
  });
  vi.stubGlobal('fetch', fetcher);
  try {
    await local.window('~ten', { count: 1000 });
    expect(fetcher.mock.calls[0][0]).toContain('mode=newest&count=200');
    await local.markRead('~ten');
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
      type: 'read',
      room: 'brian-bot',
      seq: 12000,
    });
    expect(history).not.toHaveBeenCalled();
  } finally {
    vi.unstubAllGlobals();
  }
});

test('thread pages retain an older cursor and stop when history is exhausted', async () => {
  const local = client();
  vi.spyOn(local, 'message').mockResolvedValue({
    id: 'root',
    seq: 1,
    authorId: '~nec',
    sentAt: 1,
    text: 'Parent',
    content: [],
    replyCount: 10000,
  });
  const window = vi
    .spyOn(local, 'window')
    .mockResolvedValueOnce({
      messages: [],
      cursor: 12000,
      newestSequenceNum: 12000,
      older: 11901,
      newer: null,
    })
    .mockResolvedValueOnce({
      messages: [],
      cursor: 12000,
      newestSequenceNum: 12000,
      older: null,
      newer: 11900,
    });
  const thread = await local.thread('~ten', 'root');
  expect(thread.parent.replyCount).toBe(10000);
  expect(local.hasOlderReplies('~ten', 'root')).toBe(true);
  await local.olderReplies('~ten', 'root');
  expect(window).toHaveBeenLastCalledWith('~ten', {
    parentId: 'root',
    mode: 'older',
    anchor: 11901,
    count: 100,
  });
  expect(local.hasOlderReplies('~ten', 'root')).toBe(false);
  await local.olderReplies('~ten', 'root');
  expect(window).toHaveBeenCalledTimes(2);
});

test('uploads with a bearer session and uses scoped download tickets', async () => {
  const local = client();
  const id = '12345678-1234-1234-1234-123456789abc';
  const path = `/v1/rooms/brian-bot/attachments/${id}/content`;
  vi.stubGlobal('location', { origin: 'http://127.0.0.1:5173' });
  const fetcher = vi.fn(async (url: string, options?: RequestInit) => {
    expect(options?.headers).toMatchObject({ Authorization: 'Bearer brian' });
    if (url.endsWith('/complete')) return Response.json({ url: path });
    if (url === '/v1/files/upload/ticket')
      return new Response('', { status: 200 });
    if (url === '/v1/attachments/ticket') {
      expect(JSON.parse(String(options?.body))).toEqual({ paths: [path] });
      return Response.json({ [path]: path + '?ticket=download' });
    }
    return Response.json({
      id,
      url: '/v1/files/upload/ticket',
      headers: { 'Content-Type': 'application/pdf' },
    });
  });
  vi.stubGlobal('fetch', fetcher);
  try {
    const file = new Blob(['pdf'], { type: 'application/pdf' });
    expect(
      await local.uploadAttachment(
        '~ten',
        file,
        'report.pdf',
        'application/pdf'
      )
    ).toBe(path);
    expect(fetcher.mock.calls[1][1]?.body).toBe(file);
    expect(local.attachmentContent({ fileUri: path })).toEqual({
      fileUri: `http://127.0.0.1:5173${path}?ticket=download`,
    });
    expect(
      local.attachmentContent({ src: 'https://example.com/photo.png' })
    ).toEqual({
      src: 'https://example.com/photo.png',
    });
  } finally {
    vi.unstubAllGlobals();
  }
});

test('failed uploads do not finalize or publish attachment metadata', async () => {
  const local = client();
  vi.stubGlobal('location', { origin: 'http://127.0.0.1:5173' });
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      Response.json({ id: 'test', url: '/v1/files/upload/ticket', headers: {} })
    )
    .mockResolvedValueOnce(new Response('', { status: 503 }));
  vi.stubGlobal('fetch', fetcher);
  try {
    await expect(
      local.uploadAttachment('~ten', new Blob(['a']), 'a', 'text/plain')
    ).rejects.toThrow('Upload failed');
    expect(fetcher).toHaveBeenCalledTimes(2);
  } finally {
    vi.unstubAllGlobals();
  }
});

test('Activity aliases let a cold DM thread be muted using its client message key', async () => {
  const { DurableActivity } = await import('../client/durableActivity');
  const local = client();
  const request = vi.spyOn(local, 'request').mockResolvedValue({
    events: [
      {
        id: 1,
        timestamp: 1000,
        roomId: 'brian-bot',
        messageId: 'reply',
        messageSeq: 2,
        parentId: 'root',
        parentAuthorId: '~sampel-palnet',
        authorId: '~ten',
        type: 'reply',
        content: [],
        isMention: true,
        isRead: false,
      },
    ],
    nextCursor: null,
    revision: 1,
    userRevision: 0,
    directoryRevision: 0,
    summary: { revision: 1, notifyCount: 1, newest: 1000, sources: [] },
    volumes: [],
  });
  const activity = new DurableActivity(local);
  const page = await activity.page('mentions');
  const parentId = durablePostId('~ten', 'root');
  expect(page.events[0]).toMatchObject({
    parentId,
    postId: durablePostId('~ten', 'reply'),
    channelId: '~ten',
    isRead: false,
  });
  const volume = { 'dm-reply': { notify: false, unreads: true } };
  await activity.adjust(
    {
      'dm-thread': {
        whom: { ship: '~ten' },
        key: { id: `~sampel-palnet/${parentId}`, time: '123' },
      },
    },
    volume
  );
  expect(request).toHaveBeenLastCalledWith('/activity/volume', {
    scope: { kind: 'thread', roomId: 'brian-bot', parentId: 'root' },
    volume,
  });
  const unreads = activity.unreads({
    revision: 2,
    newest: 1000,
    notifyCount: 1,
    sources: [
      { roomId: 'brian-bot', count: 0, notifyCount: 1, updatedAt: 1000 },
    ],
  });
  expect(unreads.channelUnreads[0]).toMatchObject({ count: 0, notify: true });
});

test('gallery channels use the existing gallery components and posts keep titles, media and reply types', async () => {
  const { CollectionRendererId, DraftInputId, PostContentRendererId } =
    await import('../client/channelContentConfig');
  const { durableMessageToPost } = await import('../client/postsApi');
  const { configureDurableClient, getDurableClient } =
    await import('../client/durable');
  const previous = getDurableClient(),
    local = client();
  local.bootstrap.people = [local.bootstrap.user];
  const channelId = 'heap/~sampel-palnet/photos';
  local.bootstrap.rooms.push({
    id: 'gallery-sampel-palnet-photos',
    channelId,
    title: 'Photos',
    groupId: local.bootstrap.groups[0].id,
    members: ['brian'],
    kind: 'channel',
  });
  configureDurableClient(local);
  vi.stubGlobal('location', { origin: 'http://127.0.0.1:5173' });
  try {
    expect(
      local.channels().find((channel) => channel.id === channelId)
    ).toMatchObject({
      type: 'gallery',
      contentConfiguration: {
        draftInput: DraftInputId.gallery,
        defaultPostContentRenderer: PostContentRendererId.gallery,
        defaultPostCollectionRenderer: CollectionRendererId.gallery,
      },
    });
    const image =
      '/v1/rooms/gallery-sampel-palnet-photos/attachments/12345678-1234-1234-1234-123456789abc/content';
    const message: DurableMessage = {
      id: 'photo',
      seq: 1,
      sentAt: 1,
      authorId: '~sampel-palnet',
      text: 'A caption',
      metadata: { title: 'A title', image },
      content: [
        { inline: ['A caption'] },
        {
          block: {
            image: { src: image, width: 100, height: 100, alt: 'Sample' },
          },
        },
      ],
    };
    const post = durableMessageToPost(channelId, message);
    expect(post).toMatchObject({
      type: 'block',
      title: 'A title',
      textContent: 'A caption',
      hasImage: true,
    });
    expect(post.image).toBe(image);
    expect(post.images?.[0]?.src).toBe(image);
    expect(
      durableMessageToPost(channelId, { ...message, parentId: 'parent' }).type
    ).toBe('reply');
  } finally {
    configureDurableClient(previous!);
    vi.unstubAllGlobals();
  }
});

test('gallery sends and edits carry post metadata through the durable transport', async () => {
  const { sendPost, editPost } = await import('../client/postsApi');
  const { configureDurableClient, getDurableClient } =
    await import('../client/durable');
  const previous = getDurableClient(),
    local = client(),
    channelId = 'heap/~sampel-palnet/photos';
  local.bootstrap.rooms.push({
    id: 'gallery-sampel-palnet-photos',
    channelId,
    title: 'Photos',
    groupId: local.bootstrap.groups[0].id,
    members: ['brian'],
    kind: 'channel',
  });
  configureDurableClient(local);
  const fetcher = vi.fn(async (_path: string, _options?: RequestInit) =>
    Response.json({ id: 'saved' })
  );
  vi.stubGlobal('fetch', fetcher);
  try {
    await sendPost({
      channelId,
      authorId: '~sampel-palnet',
      sentAt: 1,
      content: [{ inline: ['Caption'] }],
      metadata: { title: 'Photo title' },
    });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      metadata: { title: 'Photo title' },
      text: 'Caption',
    });
    await editPost({
      channelId,
      postId: 'saved',
      authorId: '~sampel-palnet',
      sentAt: 1,
      content: [{ inline: ['New caption'] }],
      metadata: { title: 'New title' },
    });
    expect(JSON.parse(String(fetcher.mock.calls[1][1]?.body))).toMatchObject({
      id: 'saved',
      action: {
        type: 'edit',
        metadata: { title: 'New title' },
        text: 'New caption',
      },
    });
  } finally {
    configureDurableClient(previous!);
    vi.unstubAllGlobals();
  }
});

test('personal agents retain distinct contacts and are mentionable alongside their owners', () => {
  const local = client();
  local.bootstrap.people = [
    { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    { id: 'galen', contactId: '~nec', name: 'Galen' },
  ];
  local.bootstrap.agents = [
    { owner: 'brian', contactId: '~dur', name: 'Brian’s Pi' },
    { owner: 'galen', contactId: '~pen', name: 'Galen’s Pi' },
  ];
  local.bootstrap.rooms.push({
    id: 'general',
    channelId: 'chat/~sampel-palnet/general',
    title: 'General',
    members: ['brian', 'galen'],
    agentOwners: ['brian', 'galen'],
    groupId: '~sampel-palnet/durable',
    kind: 'channel',
  });
  expect(local.contacts().map((contact) => contact.id)).toContain('~dur');
  expect(local.contacts().map((contact) => contact.id)).toContain('~pen');
  expect(local.groups()[0].members?.map((member) => member.contactId)).toEqual([
    '~sampel-palnet',
    '~dur',
    '~nec',
    '~pen',
  ]);
  expect(
    local
      .channels()
      .find((channel) => channel.id === 'chat/~sampel-palnet/general')
      ?.members?.map((member) => member.contactId)
  ).toEqual(['~sampel-palnet', '~nec', '~dur', '~pen']);
});

test("an assistant that only answers in its own chat is not a member of its owner's groups", () => {
  const local = client();
  local.bootstrap.people = [
    { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    { id: 'galen', contactId: '~nec', name: 'Galen' },
  ];
  local.bootstrap.agents = [
    { owner: 'brian', contactId: '~dur', name: 'Assistant' },
  ];
  local.bootstrap.rooms.push({
    id: 'general',
    channelId: 'chat/~sampel-palnet/general',
    title: 'General',
    members: ['brian', 'galen'],
    agentOwners: [],
    groupId: '~sampel-palnet/durable',
    kind: 'channel',
  });
  const group = local.groups()[0];
  expect(group.members?.map((member) => member.contactId)).toEqual([
    '~sampel-palnet',
    '~nec',
  ]);
  expect(group.memberCount).toBe(2);
});

test('durable contacts expose persisted owner and agent profile fields without changing identity', () => {
  const local = client();
  const profile = {
    contactId: '~dur',
    revision: 3,
    nickname: 'Helper',
    avatar: 'http://localhost/avatar.png',
    cover: 'http://localhost/cover.png',
    bio: 'A helper',
    status: 'Available',
  };
  local.bootstrap.agents = [
    { owner: 'brian', contactId: '~dur', name: 'Old label', profile },
  ];
  expect(local.contacts()[0]).toMatchObject({
    id: '~dur',
    peerNickname: 'Helper',
    peerAvatarImage: profile.avatar,
    coverImage: profile.cover,
    bio: 'A helper',
    status: 'Available',
  });
  delete local.bootstrap.agents;
  expect(local.contacts()[0]).toMatchObject({
    id: '~ten',
    peerNickname: 'Pi',
    peerAvatarImage: null,
  });
});

test('server avatar paths resolve against the account server and save back as paths', async () => {
  const local = new DurableClient('brian', 'https://node.example:8443');
  local.bootstrap = {
    user: { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    people: [
      {
        id: 'brian',
        contactId: '~sampel-palnet',
        name: 'Brian',
        profile: {
          contactId: '~sampel-palnet',
          revision: 1,
          nickname: 'Brian',
          avatar: '/v1/avatars/brian/abc123',
          cover: '',
          bio: '',
          status: '',
        },
      },
      {
        id: 'galen',
        contactId: '~nec',
        name: 'Galen',
        profile: {
          contactId: '~nec',
          revision: 1,
          nickname: 'Galen',
          avatar: 'https://cdn.example/galen.png',
          cover: '',
          bio: '',
          status: '',
        },
      },
    ],
    bot: null,
    revision: 0,
    groups: [],
    rooms: [],
  };
  expect(local.contacts().map((contact) => contact.peerAvatarImage)).toEqual([
    'https://node.example:8443/v1/avatars/brian/abc123',
    'https://cdn.example/galen.png',
  ]);
  const request = vi
    .spyOn(local, 'request')
    .mockResolvedValueOnce({ revision: 1 })
    .mockResolvedValueOnce({});
  vi.spyOn(local, 'initialize').mockResolvedValue(local.bootstrap);
  await local.updateProfile({
    bio: 'Hi',
    avatar: local.contacts()[0].peerAvatarImage!,
  });
  expect(request.mock.calls[1][1]).toMatchObject({
    action: { patch: { bio: 'Hi', avatar: '/v1/avatars/brian/abc123' } },
  });
});

test('profile editing reads the current owner revision and commits through the shared command API', async () => {
  const local = client();
  const request = vi
    .spyOn(local, 'request')
    .mockResolvedValueOnce({ revision: 7 })
    .mockResolvedValueOnce({ operation_id: 'saved' });
  const initialize = vi
    .spyOn(local, 'initialize')
    .mockResolvedValue(local.bootstrap);
  await local.updateProfile({ bio: 'Updated bio' });
  expect(request.mock.calls[0]).toEqual(['/profiles/~sampel-palnet']);
  expect(request.mock.calls[1]).toEqual([
    '/commands',
    {
      requestId: expect.any(String),
      action: {
        type: 'profile',
        target: 'owner',
        revision: 7,
        patch: { bio: 'Updated bio' },
      },
    },
  ]);
  expect(initialize).toHaveBeenCalledOnce();
});

test('a conflicting profile edit propagates and does not overwrite with a forced revision', async () => {
  const local = client();
  const request = vi
    .spyOn(local, 'request')
    .mockResolvedValueOnce({ revision: 7 })
    .mockRejectedValueOnce(new Error('409 Profile changed'));
  const initialize = vi.spyOn(local, 'initialize');
  await expect(local.updateProfile({ nickname: 'New' })).rejects.toThrow('409');
  expect(request).toHaveBeenCalledTimes(2);
  expect(initialize).not.toHaveBeenCalled();
});

test('messages carry the device timezone and locale for the assistant', async () => {
  const local = client();
  const request = vi.spyOn(local, 'request').mockResolvedValue({});
  await local.send('~ten', 1, [], 'hi');
  const { timeZone, locale } = Intl.DateTimeFormat().resolvedOptions();
  expect(request.mock.calls[0][1]).toMatchObject({
    client: { timezone: timeZone, locale },
  });
});

test('a workspace’s own agents are members of it and of its channels', () => {
  const local = client();
  local.bootstrap.people = [
    { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    { id: 'galen', contactId: '~nec', name: 'Galen' },
  ];
  local.bootstrap.groups[0].groupId = 'key';
  local.bootstrap.agents = [
    { owner: 'key', contactId: '~scout', name: 'Scout' },
    { owner: 'other', contactId: '~stranger', name: 'Elsewhere' },
  ];
  local.bootstrap.rooms.push({
    id: 'key-general',
    channelId: 'chat/~sampel-palnet/general',
    title: 'General',
    members: ['brian', 'galen'],
    agentOwners: ['key'],
    groupId: '~sampel-palnet/durable',
    kind: 'channel',
  });
  const group = local.groups()[0];
  expect(group.memberCount).toBe(3);
  expect(group.members?.map((member) => member.contactId)).toEqual([
    '~sampel-palnet',
    '~nec',
    '~scout',
  ]);
  expect(
    group.members?.find((member) => member.contactId === '~scout')?.status
  ).toBe('joined');
  expect(
    local
      .channels()
      .find((channel) => channel.id === 'chat/~sampel-palnet/general')
      ?.members?.map((member) => member.contactId)
  ).toEqual(['~sampel-palnet', '~nec', '~scout']);
});

test('agent settings go to the group’s host as directory actions', async () => {
  const local = client();
  const directory = vi.spyOn(local, 'directory').mockResolvedValue({});
  const request = vi.spyOn(local, 'request').mockResolvedValue({});
  await local.createAgent('~sampel-palnet/durable', 'Scout', 'Be brief.');
  await local.updateAgent('~sampel-palnet/durable', '~scout', {
    enabled: false,
  });
  await local.removeAgent('~sampel-palnet/durable', '~scout');
  await local.agentSettings('~sampel-palnet/durable', '~scout');
  expect(directory.mock.calls.map(([action]) => action)).toEqual([
    {
      type: 'agentCreate',
      groupId: '~sampel-palnet/durable',
      nickname: 'Scout',
      prompt: 'Be brief.',
    },
    {
      type: 'agentUpdate',
      groupId: '~sampel-palnet/durable',
      agent: '~scout',
      enabled: false,
    },
    { type: 'agentRemove', groupId: '~sampel-palnet/durable', agent: '~scout' },
  ]);
  expect(request).toHaveBeenCalledWith(
    '/groups/~sampel-palnet%2Fdurable/agents/~scout'
  );
});

test('a failed request gives the server’s error text', () => {
  expect(
    durableErrorText(
      new Error(
        'Local backend: 409 {"error":"A workspace has at most 5 agents"}'
      )
    )
  ).toBe('A workspace has at most 5 agents');
  expect(durableErrorText(new Error('offline'))).toBeUndefined();
});

test('a picked avatar goes in an agent’s settings as base64 with its type', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      blob: async () =>
        new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
    }))
  );
  try {
    expect(await avatarFields('blob:picked')).toEqual({
      avatar: 'AQID',
      avatarType: 'image/jpeg',
    });
    expect(await avatarFields('/v1/avatars/a/b')).toEqual({});
  } finally {
    vi.unstubAllGlobals();
  }
});

test('agents carry the bot claim and your own entry is not a contact', () => {
  const local = client();
  local.bootstrap.people = [
    { id: 'brian', contactId: '~sampel-palnet', name: 'Brian' },
    { id: 'galen', contactId: '~nec', name: 'Galen' },
  ];
  local.bootstrap.agents = [{ owner: 'brian', contactId: '~dur', name: 'Pi' }];
  const contacts = Object.fromEntries(local.contacts().map((c) => [c.id, c]));
  expect(contacts['~dur'].botInfo).toBe(SLAB_AGENT_CLAIM);
  expect(contacts['~nec'].botInfo).toBeNull();
  expect(contacts['~sampel-palnet'].isContact).toBe(false);
  expect(contacts['~nec'].isContact).toBe(true);
  expect(contacts['~dur'].isContact).toBe(true);
});
