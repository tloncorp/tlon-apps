import { writeFileSync } from 'node:fs';
import { actorApi } from '../../packages/tlon-bot-e2e/src/tlon/actor';
const {
  addContact,
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
