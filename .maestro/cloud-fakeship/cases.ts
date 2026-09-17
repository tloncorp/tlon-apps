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
  if (selected('member-invitation-filter')) {
    const g = await zod.createGroupWithChannel({
      title: `MemberInvite-${tag}`,
    });
    fixtures.MemberInvite = g;
    await zod.sendChannelPost({
      channelId: g.chatChannel,
      content: `${tag} invite ready`,
    });
    await until('member invitation fixture post reaches host', async () =>
      (await zod.state.channelPosts(g.chatChannel)).some(
        (post) =>
          post.authorId === '~zod' && post.text === `${tag} invite ready`
      )
    );
    task('member-invitation-filter', async () => {
      await until(
        'native deletes member invitation filter fixture',
        async () =>
          !(await zod.state.isMemberOfGroup(g.groupId)) &&
          !(await ten.state.isMemberOfGroup(g.groupId)),
        30 * 60_000
      );
      record('member-invitation-filter-cleanup', {
        groupId: g.groupId,
        hostMember: false,
        peerMember: false,
      });
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
  if (selected('home-unread-preview')) {
    await resetDmPeer();

    const g = await group('HomeUnread', zod);
    const groupText = `${tag} home group unread`;
    await say(g.chatChannel, groupText);

    await ten.sendDm('~zod', `${tag} home dm handshake`);
    await until('home DM handshake reaches zod', () =>
      includesShip(zod, '/dm/invited', '~ten')
    );
    await zod.state.poke({
      app: 'chat',
      mark: 'chat-dm-rsvp',
      json: { ship: '~ten', ok: true },
    });
    await until('accepted home DM reaches zod', async () => {
      const [active, invited] = await Promise.all([
        includesShip(zod, '/dm', '~ten'),
        includesShip(zod, '/dm/invited', '~ten'),
      ]);
      return active && !invited;
    });
    const dmText = `${tag} home dm unread`;
    await ten.sendDm('~zod', dmText);

    const unreads = async () =>
      zod.state.scry<any[]>('activity', '/v4/activity/unreads');
    await until('home unread fixtures reach zod', async () => {
      const [activity, groupPosts, dmPosts] = await Promise.all([
        unreads(),
        zod.state.channelPosts(g.chatChannel),
        zod.state.channelPosts('~ten'),
      ]);
      return (
        activity.some((entry) => entry.source?.group === g.groupId) &&
        activity.some((entry) => entry.source?.dm?.ship === '~ten') &&
        groupPosts.some(
          (post) => post.authorId === '~ten' && post.text === groupText
        ) &&
        dmPosts.some((post) => post.authorId === '~ten' && post.text === dmText)
      );
    });
    task('home-unread-preview', async () => {
      record('home-unread-preview-state', {
        groupId: g.groupId,
        channelId: g.chatChannel,
        groupText,
        dmText,
        groupUnread: true,
        dmUnread: true,
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
      const targetedReadChecks = [
        selected('group-mark-read') ? 'group-mark-read-state' : null,
        selected('channel-mark-read') ? 'channel-mark-read-state' : null,
      ].filter((name): name is string => name !== null);
      if (targetedReadChecks.length) {
        await until(
          'targeted read checks complete',
          async () => targetedReadChecks.every((name) => name in checks),
          30 * 60_000
        );
      }
      await say(g.chatChannel, `${tag} targeted reads verified`);
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
  if (selected('global-notification-preferences')) {
    const softGroup = await group('NotifySoft', zod);
    const softOrdinaryGroup = await group('NotifySoftPost', zod);
    const hushGroup = await group('NotifyHush', zod);
    const hushOrdinaryGroup = await group('NotifyHushPost', zod);
    type RawVolume = Record<string, { unreads?: boolean; notify?: boolean }>;
    type RawFeedSource = {
      events?: Array<{
        event?: { notified?: boolean } & Record<string, unknown>;
      }>;
    };
    const baseLevel = async () => {
      const settings = await zod.state.scry<Record<string, RawVolume>>(
        'activity',
        '/v6/volume-settings'
      );
      const base = settings.base;
      if (!base) return 'default';
      const entries = Object.values(base);
      if (entries.length > 0 && entries.every((entry) => !entry.notify)) {
        return 'hush';
      }
      if (
        base.post?.notify === false &&
        base['post-mention']?.notify === true &&
        base['reply-mention']?.notify === true &&
        base['dm-post']?.notify === true
      ) {
        return 'soft';
      }
      if (base.post?.notify === true) return 'medium';
      return 'unknown';
    };
    const eventNotified = async (marker: string) => {
      const response = await zod.state.scry<{
        feed?: RawFeedSource[];
      }>('activity', '/v5/feed/all/100');
      for (const source of response.feed ?? []) {
        for (const wrapped of source.events ?? []) {
          if (JSON.stringify(wrapped.event).includes(marker)) {
            return wrapped.event?.notified;
          }
        }
      }
      return undefined;
    };
    const sendPhase = async (
      notificationFixture: Awaited<ReturnType<typeof group>>,
      ordinaryFixture: Awaited<ReturnType<typeof group>>,
      phase: 'soft' | 'hush'
    ) => {
      const root = await zod.sendChannelPost({
        channelId: notificationFixture.chatChannel,
        content: `${tag} notification ${phase} root`,
      });
      await until(`${phase} root reaches peer`, async () =>
        (await ten.state.channelPosts(notificationFixture.chatChannel)).some(
          (post) => post.id === root.id
        )
      );
      const ordinary = `${tag} notification ${phase} ordinary`;
      const mention = `${tag} notification ${phase} mention`;
      const reply = `${tag} notification ${phase} reply`;
      await ten.sendChannelPost({
        channelId: ordinaryFixture.chatChannel,
        content: ordinary,
      });
      await ten.sendChannelPost({
        channelId: notificationFixture.chatChannel,
        content: [{ inline: [{ ship: '~zod' }, ` ${mention}`] }],
      });
      await ten.replyToPost({
        channelId: notificationFixture.chatChannel,
        parentId: root.id,
        parentAuthor: root.authorId,
        content: reply,
      });
      await until(
        `${phase} notification messages reach native ship`,
        async () => {
          const ordinaryArrived = (
            await zod.state.channelPosts(ordinaryFixture.chatChannel)
          ).some((post) => post.authorId === '~ten' && post.text === ordinary);
          const mentionArrived = (
            await zod.state.channelPosts(notificationFixture.chatChannel)
          ).some(
            (post) => post.authorId === '~ten' && post.text.includes(mention)
          );
          const replies = await zod.state.postWithReplies({
            channelId: notificationFixture.chatChannel,
            rootId: root.id,
            rootAuthor: root.authorId,
          });
          return (
            ordinaryArrived &&
            mentionArrived &&
            replies.replies.some(
              (post) => post.author === '~ten' && post.text === reply
            )
          );
        }
      );
      let delivered: string | undefined;
      if (phase === 'hush') {
        delivered = `${tag} notification hush delivered`;
        await ten.sendChannelPost({
          channelId: ordinaryFixture.chatChannel,
          content: delivered,
        });
        await until('hush Home-preview barrier reaches native ship', async () =>
          (await zod.state.channelPosts(ordinaryFixture.chatChannel)).some(
            (post) => post.authorId === '~ten' && post.text === delivered
          )
        );
      }
      return { ordinary, mention, reply, delivered };
    };
    task('global-notification-preferences', async () => {
      const failures: string[] = [];
      await until(
        'native selects mentions-and-replies notification level',
        async () => (await baseLevel()) === 'soft',
        30 * 60_000
      );
      const softMarkers = await sendPhase(softGroup, softOrdinaryGroup, 'soft');
      let soft: Record<string, boolean | undefined> = {};
      await until('soft mention and reply reach Activity', async () => {
        soft = {
          ordinary: await eventNotified(softMarkers.ordinary),
          mention: await eventNotified(softMarkers.mention),
          reply: await eventNotified(softMarkers.reply),
        };
        return soft.mention !== undefined && soft.reply !== undefined;
      });
      record('global-notification-soft', {
        level: 'soft',
        ordinaryInActivity: soft.ordinary !== undefined,
        mentionNotified: soft.mention,
        replyNotified: soft.reply,
      });
      if (soft.ordinary !== undefined) {
        failures.push('soft ordinary post entered Activity');
      }
      if (soft.mention !== true) failures.push('soft mention did not notify');
      if (soft.reply !== true) failures.push('soft reply did not notify');

      await until(
        'native selects no-notifications level',
        async () => (await baseLevel()) === 'hush',
        30 * 60_000
      );
      const hushMarkers = await sendPhase(hushGroup, hushOrdinaryGroup, 'hush');

      await until(
        'native restores default notification level',
        async () => (await baseLevel()) === 'medium',
        30 * 60_000
      );
      const hush = {
        ordinary: await eventNotified(hushMarkers.ordinary),
        mention: await eventNotified(hushMarkers.mention),
        reply: await eventNotified(hushMarkers.reply),
      };
      record('global-notification-hush', {
        level: 'hush',
        ordinaryNotified: hush.ordinary ?? null,
        mentionNotified: hush.mention ?? null,
        replyNotified: hush.reply ?? null,
        deliveredMarker: hushMarkers.delivered,
      });
      if (Object.values(hush).some((value) => value === true)) {
        failures.push('hush emitted a notifying Activity event');
      }
      const notificationFixtures = [
        softGroup,
        softOrdinaryGroup,
        hushGroup,
        hushOrdinaryGroup,
      ];
      for (const fixture of notificationFixtures) {
        try {
          await zod.state.deleteGroup(fixture.groupId);
        } catch (error) {
          if (await zod.state.isMemberOfGroup(fixture.groupId)) throw error;
        }
        await until(
          `notification fixture ${fixture.groupId} is removed`,
          async () =>
            !(await zod.state.isMemberOfGroup(fixture.groupId)) &&
            !(await ten.state.isMemberOfGroup(fixture.groupId))
        );
      }
      record('global-notification-cleanup', {
        groupIds: notificationFixtures.map((fixture) => fixture.groupId),
        restoredLevel: 'medium',
        removed: true,
      });
      if (failures.length) throw Error(failures.join('; '));
    });
  }
  if (selected('activity-pagination')) {
    const g = await group('ActivityPage', zod);
    const sourceCount = 32;
    let oldest = '';
    let newest = '';
    for (let i = 1; i <= sourceCount; i++) {
      const root = await zod.sendChannelPost({
        channelId: g.chatChannel,
        content: `${tag} activity page root ${i}`,
      });
      const marker =
        i === 1
          ? `${tag} activity page oldest`
          : i === sourceCount
            ? `${tag} activity page newest`
            : `${tag} activity page ${i}`;
      await ten.replyToPost({
        channelId: g.chatChannel,
        parentId: root.id,
        parentAuthor: root.authorId,
        content: marker,
      });
      if (i === 1) oldest = marker;
      if (i === sourceCount) newest = marker;
    }

    let initialFeed: { all?: unknown[] } = {};
    await until('newest Activity page reaches initial feed', async () => {
      initialFeed = await zod.state.scry<{ all?: unknown[] }>(
        'activity',
        '/v5/feed/init/30'
      );
      return JSON.stringify(initialFeed.all ?? []).includes(newest);
    });
    const initialSerialized = JSON.stringify(initialFeed.all ?? []);
    if (initialSerialized.includes(oldest)) {
      throw Error('Oldest Activity marker unexpectedly entered initial page');
    }
    const fullFeed = await zod.state.scry<{ feed?: unknown[] }>(
      'activity',
      '/v5/feed/all/100'
    );
    const fullSerialized = JSON.stringify(fullFeed.feed ?? fullFeed);
    if (!fullSerialized.includes(oldest) || !fullSerialized.includes(newest)) {
      throw Error(
        'Activity pagination boundary markers missing from full feed'
      );
    }
    task('activity-pagination', async () => {
      record('activity-pagination-state', {
        groupId: g.groupId,
        channelId: g.chatChannel,
        oldest,
        newest,
        seededSources: sourceCount,
        initialPageCount: 30,
        oldestExcludedFromInitialPage: true,
        fullFeedContainsBoundaryMarkers: true,
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
  if (selected('dm-copy-message')) {
    await resetDmPeer();
    await ten.sendDm('~zod', `${tag} dm clipboard handshake`);
    await until('DM clipboard handshake reaches zod', () =>
      includesShip(zod, '/dm/invited', '~ten')
    );
    await zod.state.poke({
      app: 'chat',
      mark: 'chat-dm-rsvp',
      json: { ship: '~ten', ok: true },
    });
    await until('accepted DM clipboard fixture reaches zod', async () => {
      const [active, invited] = await Promise.all([
        includesShip(zod, '/dm', '~ten'),
        includesShip(zod, '/dm/invited', '~ten'),
      ]);
      return active && !invited;
    });
    const text = `${tag} dm clipboard target`;
    await ten.sendDm('~zod', text);
    await until('DM clipboard target reaches zod', async () =>
      (await zod.state.channelPosts('~ten')).some(
        (post) => post.authorId === '~ten' && post.text === text
      )
    );
    fixtures.DmClipboard = { channelId: '~ten', text };
    record('dm-copy-message-state', {
      channelId: '~ten',
      sender: '~ten',
      recipient: '~zod',
      text,
    });
    task('dm-copy-message', async () => {
      const visible = (await zod.state.channelPosts('~ten')).some(
        (post) => post.authorId === '~ten' && post.text === text
      );
      if (!visible) throw Error('DM clipboard target disappeared');
    });
  }
  if (selected('dm-history-pagination')) {
    await resetDmPeer();
    await ten.sendDm('~zod', `${tag} dm history handshake`);
    await until('DM history handshake reaches zod', () =>
      includesShip(zod, '/dm/invited', '~ten')
    );
    await zod.state.poke({
      app: 'chat',
      mark: 'chat-dm-rsvp',
      json: { ship: '~ten', ok: true },
    });
    await until('accepted DM history fixture reaches zod', async () => {
      const [active, invited] = await Promise.all([
        includesShip(zod, '/dm', '~ten'),
        includesShip(zod, '/dm/invited', '~ten'),
      ]);
      return active && !invited;
    });

    const oldest = `${tag} dm history oldest`;
    const newest = `${tag} dm history newest`;
    await zod.sendDm('~ten', oldest);
    // The native newest-page query requests 50 posts. Keep the oldest marker
    // beyond that boundary so finding it requires the older-page action.
    for (let i = 1; i <= 55; i++) {
      await zod.sendDm('~ten', `${tag} dm history ${i}`);
    }
    await zod.sendDm('~ten', newest);
    await until('DM history fixture reaches both ships', async () => {
      const [nativePosts, peerPosts] = await Promise.all([
        zod.state.channelPosts('~ten', 80),
        ten.state.channelPosts('~zod', 80),
      ]);
      return [nativePosts, peerPosts].every(
        (posts) =>
          posts.some((post) => post.text === oldest) &&
          posts.some((post) => post.text === newest)
      );
    });
    task('dm-history-pagination', async () => {
      record('dm-history-pagination-state', {
        channelId: '~ten',
        oldest,
        newest,
        seededMessages: 57,
        initialPageCount: 50,
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
  if (selected('group-leave')) {
    const g = await group('Leave');
    const readyText = `${tag} leave ready`;
    await say(g.chatChannel, readyText);
    await until('leave fixture post reaches native ship', async () =>
      (await zod.state.channelPosts(g.chatChannel)).some(
        (post) => post.authorId === '~ten' && post.text === readyText
      )
    );
    task('group-leave', async () => {
      await until(
        'native leaves peer-hosted group',
        async () => {
          const host: any = await ten.state.group(g.groupId);
          return (
            !host?.members?.some(
              (member: any) =>
                member.contactId === '~zod' && member.status === 'joined'
            ) && !(await zod.state.isMemberOfGroup(g.groupId))
          );
        },
        30 * 60_000
      );
      let deleteAck = 'received';
      try {
        await ten.state.deleteGroup(g.groupId);
      } catch (error) {
        if (await ten.state.isMemberOfGroup(g.groupId)) throw error;
        deleteAck = 'timed out after removal';
      }
      await until(
        'peer host deletes leave fixture',
        async () => !(await ten.state.isMemberOfGroup(g.groupId))
      );
      record('group-leave-state', {
        groupId: g.groupId,
        departedShip: '~zod',
        hostMember: false,
        clientMember: false,
        hostFixtureDeleted: true,
        deleteAck,
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
  if (selected('gallery-actions')) {
    const g = await zod.createGroupWithChannel({
      title: `GalleryActions-${tag}`,
      members: ['~ten'],
      channelKind: 'heap',
      channelTitle: 'Gallery',
    });
    await ten.state.joinGroup(g.groupId);
    await until('gallery peer joins', () =>
      ten.state.isMemberOfGroup(g.groupId)
    );
    fixtures.GalleryActions = g;
    const text = `${tag} gallery action target`;
    const post = await zod.sendChannelPost({
      channelId: g.chatChannel,
      content: text,
      metadata: { title: `${tag} gallery title` },
    });
    const peerPost = async () =>
      (await ten.state.channelPosts(g.chatChannel)).find(
        (candidate) => candidate.id === post.id
      );
    await until('gallery post reaches peer', async () => !!(await peerPost()));
    task('gallery-actions', async () => {
      await until(
        'native gallery reaction reaches peer',
        async () =>
          await ten.withClient(async () => {
            const result = await getChannelPosts({
              channelId: g.chatChannel,
              mode: 'newest',
            });
            const target = result.posts.find(
              (candidate) => candidate.id === post.id
            );
            return !!target?.reactions?.some(
              (reaction) =>
                reaction.contactId === '~zod' && reaction.value === '👍'
            );
          }),
        30 * 60_000
      );
      record('gallery-reaction', {
        postId: post.id,
        contactId: '~zod',
        value: '👍',
      });
      await zod.sendChannelPost({
        channelId: g.chatChannel,
        content: `${tag} gallery reaction verified`,
      });
      await until(
        'native gallery deletion reaches peer',
        async () => (await peerPost())?.isDeleted === true,
        30 * 60_000
      );
      record('gallery-delete', { postId: post.id, deleted: true });
      await zod.sendChannelPost({
        channelId: g.chatChannel,
        content: `${tag} gallery delete verified`,
      });
      await until(
        'native gallery fixture is removed',
        async () => !(await zod.state.isMemberOfGroup(g.groupId)),
        180_000
      );
      record('gallery-cleanup', { groupId: g.groupId, removed: true });
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
