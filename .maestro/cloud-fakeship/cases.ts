import { writeFileSync } from 'node:fs';
import { actorApi } from '../../packages/tlon-bot-e2e/src/tlon/actor';
const {
  addContact,
  addChannelWriters,
  addGroupRole,
  addMembersToRole,
  getChannelPosts,
  getContacts,
  kickUsersFromGroup,
  updateCurrentUserProfile,
} = actorApi;
import type { TlonActorClient } from '../../packages/tlon-bot-e2e/src/tlon/actor';

// Each flow owns a group. Only DM cases write DMs; profile changes keep the
// peer's name stable. Cloud devices can therefore exercise the same ships safely.
export async function prepareCases(zod: TlonActorClient, ten: TlonActorClient) {
  const tag = process.env.MAESTRO_RUN_TAG!;
  const out = process.env.PROOF_OUTPUT!;
  const selection = process.env.PROOF_CASES ?? 'exchange';
  const defaultCases = new Set([
    'exchange',
    'invitations',
    'direct-messages',
    'moderation',
    'group-changes',
    'reactions',
    'contact-status',
    'group-mark-read',
    'channel-mark-read',
    'activity-filters',
    'permissions',
  ]);
  const selected = (name: string) =>
    selection === 'all'
      ? defaultCases.has(name)
      : selection.split(',').includes(name);
  const tasks: Array<() => Promise<void>> = [];
  const fixtures: Record<string, unknown> = {};
  async function until(
    label: string,
    check: () => Promise<boolean>,
    timeout = 180_000
  ) {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw Error(`Timed out: ${label}`);
  }
  const posts = (channelId: string) => ten.state.channelPosts(channelId);
  const received = (channelId: string, text: string, timeout?: number) =>
    until(
      text,
      async () =>
        (await posts(channelId)).some(
          (p) => p.authorId === '~zod' && p.text === text
        ),
      timeout
    );
  const say = (channelId: string, text: string) =>
    ten.sendChannelPost({ channelId, content: text });
  const checks: Record<string, unknown> = {};
  const record = (name: string, detail: unknown) => {
    checks[name] = { at: new Date().toISOString(), detail };
    writeFileSync(`${out}/case-checks.json`, JSON.stringify(checks, null, 2));
  };
  async function group(name: string, host = ten, join = true) {
    const other = host === ten ? zod : ten;
    const fixture = await host.createGroupWithChannel({
      title: `${name}-${tag}`,
      members: [other.shipName],
    });
    if (join) {
      await other.state.joinGroup(fixture.groupId);
      await until(`${name} joined`, () =>
        other.state.isMemberOfGroup(fixture.groupId)
      );
    }
    fixtures[name] = fixture;
    return fixture;
  }
  const includesShip = async (
    actor: TlonActorClient,
    path: string,
    ship: string
  ) => (await actor.state.scry<string[]>('chat', path)).includes(ship);
  const hasValidGroupInvite = async (
    actor: TlonActorClient,
    groupId: string
  ) => {
    const foreigns = await actor.state.scry<Record<string, any>>(
      'groups',
      '/v1/foreigns'
    );
    return (foreigns?.[groupId]?.invites ?? []).some(
      (invite: any) => invite.valid
    );
  };
  async function resetDmPeer() {
    if (await includesShip(zod, '/blocked', '~ten')) {
      await zod.state.poke({
        app: 'chat',
        mark: 'chat-unblock-ship',
        json: { ship: '~ten' },
      });
    }
    if (
      (await includesShip(zod, '/dm', '~ten')) ||
      (await includesShip(zod, '/dm/invited', '~ten'))
    ) {
      await zod.state.poke({
        app: 'chat',
        mark: 'chat-dm-rsvp',
        json: { ship: '~ten', ok: false },
      });
    }
    await until('neutral DM control state', async () => {
      const [blocked, active, invited] = await Promise.all([
        includesShip(zod, '/blocked', '~ten'),
        includesShip(zod, '/dm', '~ten'),
        includesShip(zod, '/dm/invited', '~ten'),
      ]);
      return !blocked && !active && !invited;
    });
  }
  function task(name: string, fn: () => Promise<void>) {
    tasks.push(async () => {
      try {
        await fn();
        record(name, { passed: true });
      } catch (error) {
        record(name, { passed: false, error: String(error) });
        throw error;
      }
    });
  }

  if (selected('invitations')) {
    const g = await group('Invite', ten, false);
    task('invitations', async () => {
      // The native Accept action must create an actual host-side member seat.
      await received(g.chatChannel, 'invite accepted', 30 * 60_000);
      const host: any = await ten.state.group(g.groupId);
      if (
        !host.members.some(
          (m: any) => m.contactId === '~zod' && m.status === 'joined'
        )
      )
        throw Error('No accepted member seat');
      record('invite-seat', { groupId: g.groupId, contactId: '~zod' });
      await say(g.chatChannel, 'invite verified');
    });
  }
  if (selected('direct-messages')) {
    await ten.sendDm('~zod', `${tag} DM request`);
    task('direct-messages', async () => {
      await received('~zod', `${tag} dm mobile`, 30 * 60_000);
      record('dm-delivery', {
        sender: '~zod',
        recipient: '~ten',
        text: `${tag} dm mobile`,
      });
      await ten.sendDm('~zod', `${tag} dm verified`);
    });
  }
  if (selected('group-mark-read')) {
    // Host on the native ship so the peer post contributes to the group's
    // aggregate unread badge and enables the group-level read action.
    const g = await group('Unread', zod);
    await say(g.chatChannel, `${tag} unread channel`);
    const groupIsUnread = async () => {
      const unreads = await zod.state.scry<any[]>(
        'activity',
        '/v4/activity/unreads'
      );
      return unreads.some((entry) => entry.source?.group === g.groupId);
    };
    await until('group unread fixture reaches zod', groupIsUnread);
    task('group-mark-read', async () => {
      await until(
        'native marks channel read',
        async () => !(await groupIsUnread()),
        30 * 60_000
      );
      record('group-mark-read-state', {
        channelId: g.chatChannel,
        unread: false,
      });
    });
  }
  if (selected('channel-mark-read')) {
    const g = await group('UnreadChannels', zod);
    const channelName = `${tag.toLowerCase()}-unread-topic`;
    const channelId = `chat/~zod/${channelName}`;
    await zod.state.poke({
      app: 'channels',
      mark: 'channel-action-2',
      json: {
        create: {
          kind: 'chat',
          group: g.groupId,
          name: channelName,
          title: 'Unread topic',
          description: 'Channel-level unread fixture',
          meta: null,
          readers: [],
          writers: [],
        },
      },
    });
    await until('second channel reaches both ships', async () => {
      const groups: any[] = await Promise.all([
        zod.state.group(g.groupId),
        ten.state.group(g.groupId),
      ]);
      return groups.every((candidate) =>
        candidate?.channels?.some((channel: any) => channel.id === channelId)
      );
    });
    await say(channelId, `${tag} unread topic`);
    const channelIsUnread = async () => {
      const unreads = await zod.state.scry<any[]>(
        'activity',
        '/v4/activity/unreads'
      );
      return unreads.some((entry) => entry.source?.channel?.nest === channelId);
    };
    await until('channel unread fixture reaches zod', channelIsUnread);
    task('channel-mark-read', async () => {
      await until(
        'native marks individual channel read',
        async () => !(await channelIsUnread()),
        30 * 60_000
      );
      record('channel-mark-read-state', {
        groupId: g.groupId,
        channelId,
        unread: false,
      });
    });
  }
  if (selected('permissions') || selected('permissions-restore')) {
    const restoresPermissions = selected('permissions-restore');
    const g = await group('Permissions');
    const roleId = `${tag.toLowerCase()}-member`;
    const channelName = `${tag.toLowerCase()}-permission-target`;
    const channelId = `chat/~ten/${channelName}`;
    await ten.withClient(() =>
      addGroupRole({
        groupId: g.groupId,
        roleId,
        meta: {
          title: `${tag} member`,
          description: 'Native permission enforcement fixture',
        },
      })
    );
    await ten.withClient(() =>
      addMembersToRole({
        groupId: g.groupId,
        roleId,
        ships: ['~zod'],
      })
    );
    await ten.state.poke({
      app: 'channels',
      mark: 'channel-action-2',
      json: {
        create: {
          kind: 'chat',
          group: g.groupId,
          name: channelName,
          title: 'Permission target',
          description: 'Native member permission enforcement',
          meta: null,
          readers: ['admin', roleId],
          writers: ['admin'],
        },
      },
    });
    await until('read-only permission fixture reaches both ships', async () => {
      const groups: any[] = await Promise.all([
        zod.state.group(g.groupId),
        ten.state.group(g.groupId),
      ]);
      return groups.every((candidate) =>
        candidate?.channels?.some(
          (channel: any) =>
            channel.id === channelId && channel.currentUserIsMember !== false
        )
      );
    });
    await ten.sendChannelPost({
      channelId,
      content: `${tag} read-only visible`,
    });
    await until('read-only post reaches native member', async () =>
      (await zod.state.channelPosts(channelId)).some(
        (post) =>
          post.authorId === '~ten' && post.text === `${tag} read-only visible`
      )
    );

    const changeReaders = (action: 'add-readers' | 'del-readers') =>
      ten.state.poke({
        app: 'groups',
        mark: 'group-action-5',
        json: {
          group: {
            flag: g.groupId,
            'a-group': {
              channel: {
                nest: channelId,
                'a-channel': { [action]: [roleId] },
              },
            },
          },
        },
      });
    const canReadTargetChannel = async () => {
      const member: any = await zod.state.group(g.groupId);
      return member?.channels?.some(
        (channel: any) =>
          channel.id === channelId && channel.currentUserIsMember !== false
      );
    };
    task(
      restoresPermissions ? 'permissions-restore' : 'permissions',
      async () => {
        await received(g.chatChannel, `${tag} request no-read`, 30 * 60_000);
        await changeReaders('del-readers');
        await until(
          'target channel hidden from native member',
          async () => !(await canReadTargetChannel())
        );
        await say(g.chatChannel, `${tag} no-read applied`);
        record('permission-read-only', {
          groupId: g.groupId,
          channelId,
          roleId,
          seededPost: `${tag} read-only visible`,
        });
        record('permission-no-read-backend', {
          groupId: g.groupId,
          channelId,
          roleId,
          readable: false,
        });
        if (!restoresPermissions) return;

        await received(g.chatChannel, `${tag} request restore`, 30 * 60_000);
        await changeReaders('add-readers');
        await ten.withClient(() =>
          addChannelWriters({ channelId, writers: [roleId] })
        );
        await until(
          'target channel restored to native member',
          canReadTargetChannel
        );
        await ten.sendChannelPost({
          channelId,
          content: `${tag} read-write restored`,
        });
        await received(channelId, `${tag} restored mobile post`, 30 * 60_000);
        record('permission-restored', {
          groupId: g.groupId,
          channelId,
          roleId,
          restoredPost: `${tag} restored mobile post`,
        });
      }
    );
  }
  if (selected('activity-filters')) {
    const g = await group('Activity', zod);
    const root = await zod.sendChannelPost({
      channelId: g.chatChannel,
      content: `${tag} activity root`,
    });
    const reply = await ten.replyToPost({
      channelId: g.chatChannel,
      parentId: root.id,
      parentAuthor: root.authorId,
      content: `${tag} activity reply`,
    });
    const mention = await ten.sendChannelPost({
      channelId: g.chatChannel,
      content: [{ inline: [{ ship: '~zod' }, ` ${tag} activity mention`] }],
    });
    await until('activity mention and reply reach zod feeds', async () => {
      const feed = await zod.state.scry<{
        mentions?: unknown[];
        replies?: unknown[];
      }>('activity', '/v5/feed/init/30');
      return (
        JSON.stringify(feed.mentions ?? []).includes(
          `${tag} activity mention`
        ) &&
        JSON.stringify(feed.replies ?? []).includes(`${tag} activity reply`)
      );
    });
    const fixtureIsUnread = async () => {
      const unreads = await zod.state.scry<unknown[]>(
        'activity',
        '/v4/activity/unreads'
      );
      const serialized = JSON.stringify(unreads);
      return (
        serialized.includes(g.groupId) || serialized.includes(g.chatChannel)
      );
    };
    await until('activity fixture reaches zod unreads', fixtureIsUnread);
    task('activity-filters', async () => {
      await until(
        'native marks all fixture activity read',
        async () => !(await fixtureIsUnread()),
        30 * 60_000
      );
      record('activity-filter-state', {
        groupId: g.groupId,
        channelId: g.chatChannel,
        mentionId: mention.id,
        replyId: reply.id,
        mentionFeedReady: true,
        replyFeedReady: true,
        unread: false,
      });
    });
  }
  if (selected('group-swipe-read')) {
    const g = await group('SwipeGroup', zod);
    await say(g.chatChannel, `${tag} group swipe unread`);
    const groupIsUnread = async () => {
      const unreads = await zod.state.scry<any[]>(
        'activity',
        '/v4/activity/unreads'
      );
      return unreads.some((entry) => entry.source?.group === g.groupId);
    };
    await until('group swipe unread fixture reaches zod', groupIsUnread);
    task('group-swipe-read', async () => {
      await until(
        'native swipe marks group read',
        async () => !(await groupIsUnread()),
        30 * 60_000
      );
      record('group-swipe-read-state', {
        groupId: g.groupId,
        channelId: g.chatChannel,
        unread: false,
      });
    });
  }
  if (selected('dm-swipe-read')) {
    await resetDmPeer();
    await ten.sendDm('~zod', `${tag} dm handshake`);
    await until('DM handshake reaches zod', () =>
      includesShip(zod, '/dm/invited', '~ten')
    );
    await zod.state.poke({
      app: 'chat',
      mark: 'chat-dm-rsvp',
      json: { ship: '~ten', ok: true },
    });
    await until('accepted DM fixture reaches zod', async () => {
      const [active, invited] = await Promise.all([
        includesShip(zod, '/dm', '~ten'),
        includesShip(zod, '/dm/invited', '~ten'),
      ]);
      return active && !invited;
    });
    await ten.sendDm('~zod', `${tag} dm swipe unread`);
    const dmIsUnread = async () => {
      const unreads = await zod.state.scry<any[]>(
        'activity',
        '/v4/activity/unreads'
      );
      return unreads.some((entry) => entry.source?.dm?.ship === '~ten');
    };
    await until('DM swipe unread fixture reaches zod', dmIsUnread);
    task('dm-swipe-read', async () => {
      await until(
        'native swipe marks DM read',
        async () => !(await dmIsUnread()),
        30 * 60_000
      );
      record('dm-swipe-read-state', {
        channelId: '~ten',
        unread: false,
      });
    });
  }
  if (selected('dm-deny')) {
    await resetDmPeer();
    await ten.sendDm('~zod', `${tag} deny request`);
    await until('deny request reaches zod', () =>
      includesShip(zod, '/dm/invited', '~ten')
    );
    task('dm-deny', async () => {
      await until(
        'native denies request',
        async () => !(await includesShip(zod, '/dm/invited', '~ten')),
        30 * 60_000
      );
      record('dm-deny-state', { requester: '~ten', blocked: false });
    });
  }
  if (selected('dm-block')) {
    await resetDmPeer();
    await ten.sendDm('~zod', `${tag} block request`);
    await until('block request reaches zod', () =>
      includesShip(zod, '/dm/invited', '~ten')
    );
    task('dm-block', async () => {
      await until(
        'native blocks requester',
        async () =>
          (await includesShip(zod, '/blocked', '~ten')) &&
          !(await includesShip(zod, '/dm/invited', '~ten')),
        30 * 60_000
      );
      record('dm-block-state', { requester: '~ten', blocked: true });
      let blockedSendError: string | null = null;
      try {
        await ten.sendDm('~zod', `${tag} blocked request`);
      } catch (error) {
        blockedSendError = String(error);
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const [stillBlocked, leakedInvite] = await Promise.all([
        includesShip(zod, '/blocked', '~ten'),
        includesShip(zod, '/dm/invited', '~ten'),
      ]);
      if (!stillBlocked || leakedInvite) {
        throw Error('Blocked peer created a visible DM invitation');
      }
      record('dm-block-suppression', {
        requester: '~ten',
        inviteSuppressed: true,
        sendRejected: blockedSendError !== null,
      });
    });
  }
  if (selected('dm-unblock')) {
    await resetDmPeer();
    await zod.state.poke({
      app: 'chat',
      mark: 'chat-block-ship',
      json: { ship: '~ten' },
    });
    await until('blocked user fixture reaches zod', () =>
      includesShip(zod, '/blocked', '~ten')
    );
    task('dm-unblock', async () => {
      await until(
        'native unblocks requester',
        async () => !(await includesShip(zod, '/blocked', '~ten')),
        30 * 60_000
      );
      record('dm-unblock-state', { requester: '~ten', blocked: false });
    });
  }
  if (selected('blocked-group-invite')) {
    await resetDmPeer();
    await zod.state.poke({
      app: 'chat',
      mark: 'chat-block-ship',
      json: { ship: '~ten' },
    });
    await until('blocked group inviter fixture reaches zod', () =>
      includesShip(zod, '/blocked', '~ten')
    );
    const blockedInvite = await ten.createGroupWithChannel({
      title: `BlockedInvite-${tag}`,
      members: ['~zod'],
    });
    fixtures.BlockedInvite = blockedInvite;
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const foreigns = await zod.state.scry<Record<string, any>>(
      'groups',
      '/v1/foreigns'
    );
    const backendHasInvite = (
      foreigns?.[blockedInvite.groupId]?.invites ?? []
    ).some((invite: any) => invite.valid);
    const control = await zod.createGroupWithChannel({
      title: `InviteControl-${tag}`,
    });
    fixtures.InviteControl = control;
    await until('invite control group reaches zod', () =>
      zod.state.isMemberOfGroup(control.groupId)
    );
    record('blocked-group-invite-state', {
      blockedShip: '~ten',
      blockedInviteGroupId: blockedInvite.groupId,
      backendHasInvite,
      controlGroupId: control.groupId,
    });
  }
  if (selected('blocked-group-content')) {
    await resetDmPeer();
    const g = await group('BlockedContent', zod);
    await zod.state.poke({
      app: 'chat',
      mark: 'chat-block-ship',
      json: { ship: '~ten' },
    });
    await until('blocked shared-group peer fixture reaches zod', () =>
      includesShip(zod, '/blocked', '~ten')
    );
    const blockedText = `${tag} blocked group post`;
    const controlText = `${tag} blocker control post`;
    await say(g.chatChannel, blockedText);
    await until('blocked peer post reaches blocker backend', async () =>
      (await zod.state.channelPosts(g.chatChannel)).some(
        (post) => post.authorId === '~ten' && post.text === blockedText
      )
    );
    await zod.sendChannelPost({
      channelId: g.chatChannel,
      content: controlText,
    });
    record('blocked-group-content-state', {
      groupId: g.groupId,
      blockedShip: '~ten',
      blockedText,
      controlText,
      backendReceivedBlockedPost: true,
    });
  }
  if (selected('member-ban')) {
    const g = await group('Ban', zod);
    await zod.sendChannelPost({
      channelId: g.chatChannel,
      content: `${tag} member ready`,
    });
    task('member-ban', async () => {
      await until(
        'native bans and removes peer member',
        async () => {
          const host: any = await zod.state.group(g.groupId);
          return (
            host?.bannedMembers?.some(
              (member: any) => member.contactId === '~ten'
            ) &&
            !host?.members?.some(
              (member: any) =>
                member.contactId === '~ten' && member.status === 'joined'
            ) &&
            !(await ten.state.isMemberOfGroup(g.groupId))
          );
        },
        30 * 60_000
      );

      let rejoinRejected = false;
      try {
        await ten.state.joinGroup(g.groupId);
      } catch {
        rejoinRejected = true;
      }
      await new Promise((resolve) => setTimeout(resolve, 3_000));
      const hostWhileBanned: any = await zod.state.group(g.groupId);
      if (
        !hostWhileBanned?.bannedMembers?.some(
          (member: any) => member.contactId === '~ten'
        ) ||
        (await ten.state.isMemberOfGroup(g.groupId))
      ) {
        throw Error('Banned peer regained group membership');
      }
      await zod.sendChannelPost({
        channelId: g.chatChannel,
        content: `${tag} ban verified`,
      });
      record('member-ban-state', {
        groupId: g.groupId,
        contactId: '~ten',
        banned: true,
        member: false,
        rejoinRejected,
      });
    });
  }
  if (selected('invite-revocation')) {
    const g = await zod.createGroupWithChannel({
      title: `RevokeInvite-${tag}`,
    });
    fixtures.RevokeInvite = g;
    await zod.state.inviteToGroup(g.groupId, ['~ten']);
    await until('active invite reaches host and peer', async () => {
      const host: any = await zod.state.group(g.groupId);
      return (
        host?.members?.some(
          (member: any) =>
            member.contactId === '~ten' && member.status === 'invited'
        ) && (await hasValidGroupInvite(ten, g.groupId))
      );
    });
    task('invite-revocation', async () => {
      await until(
        'native revokes active peer invite',
        async () => {
          const host: any = await zod.state.group(g.groupId);
          return (
            !host?.members?.some(
              (member: any) => member.contactId === '~ten'
            ) && !(await hasValidGroupInvite(ten, g.groupId))
          );
        },
        30 * 60_000
      );
      record('invite-revocation-state', {
        groupId: g.groupId,
        contactId: '~ten',
        hostPending: false,
        peerInvite: false,
      });
    });
  }
  if (selected('moderation')) {
    const g = await group('Kick');
    await say(g.chatChannel, 'member before kick');
    task('moderation', async () => {
      await received(g.chatChannel, 'kick ready', 30 * 60_000);
      await ten.withClient(() =>
        kickUsersFromGroup({ groupId: g.groupId, contactIds: ['~zod'] })
      );
      await until('member removed on both ships', async () => {
        const host: any = await ten.state.group(g.groupId);
        return (
          !host.members.some(
            (m: any) => m.contactId === '~zod' && m.status === 'joined'
          ) && !(await zod.state.isMemberOfGroup(g.groupId))
        );
      });
      record('kick-membership', { groupId: g.groupId, removed: '~zod' });
    });
  }
  if (selected('group-changes')) {
    const g = await group('Meta', zod);
    task('group-changes', async () => {
      await until(
        'native metadata reaches peer',
        async () => {
          const peer: any = await ten.state.group(g.groupId);
          return (
            peer.title === `Renamed-${tag}` &&
            peer.description === 'Shared description'
          );
        },
        30 * 60_000
      );
      record('group-metadata', {
        groupId: g.groupId,
        title: `Renamed-${tag}`,
        description: 'Shared description',
      });
      await say(g.chatChannel, 'metadata verified');
    });
  }
  if (selected('reactions')) {
    const g = await group('React', zod);
    const post = await say(g.chatChannel, 'reaction target');
    const reactions = () =>
      ten.withClient(async () => {
        const result = await getChannelPosts({
          channelId: g.chatChannel,
          mode: 'newest',
        });
        const target = result.posts.find((p) => p.id === post.id);
        if (!target) throw Error(`Reaction target missing on peer: ${post.id}`);
        return target.reactions ?? [];
      });
    task('reactions', async () => {
      await until(
        'native reaction reaches original peer post',
        async () =>
          (await reactions()).some(
            (r) => r.contactId === '~zod' && r.value === '👍'
          ),
        30 * 60_000
      );
      record('reaction-add', {
        postId: post.id,
        contactId: '~zod',
        value: '👍',
      });
      await ten.addReact({
        channelId: g.chatChannel,
        postId: post.id,
        postAuthor: '~ten',
        react: '👍',
      });
      await until(
        'both reactions exist',
        async () => (await reactions()).length === 2
      );
      await say(g.chatChannel, 'two reactions verified');
      await until(
        'native reaction removed, peer reaction retained',
        async () => {
          const current = await reactions();
          return (
            current.length === 1 &&
            current[0].contactId === '~ten' &&
            current[0].value === '👍'
          );
        }
      );
      record('reaction-remove', { postId: post.id, remainingAuthor: '~ten' });
      await say(g.chatChannel, 'reaction removal verified');
    });
  }
  if (selected('contact-status')) {
    const g = await group('Status');
    await zod.withClient(() => addContact('~ten'));
    await ten.withClient(() =>
      updateCurrentUserProfile({ status: `Available-${tag}` })
    );
    await until('initial contact status reaches zod', async () =>
      (await zod.withClient(getContacts)).some(
        (c) => c.id === '~ten' && c.status === `Available-${tag}`
      )
    );
    task('contact-status', async () => {
      await received(g.chatChannel, 'status ready', 30 * 60_000);
      await ten.withClient(() =>
        updateCurrentUserProfile({ status: `Busy-${tag}` })
      );
      await until('updated contact status reaches zod', async () =>
        (await zod.withClient(getContacts)).some(
          (c) => c.id === '~ten' && c.status === `Busy-${tag}`
        )
      );
      record('contact-status-update', {
        contactId: '~ten',
        before: `Available-${tag}`,
        after: `Busy-${tag}`,
      });
      await say(g.chatChannel, 'status verified');
    });
  }
  return {
    fixtures,
    selected,
    async run() {
      const results = await Promise.allSettled(tasks.map((fn) => fn()));
      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length)
        throw Error(`${failures.length} peer scenarios failed`);
      return checks;
    },
  };
}
