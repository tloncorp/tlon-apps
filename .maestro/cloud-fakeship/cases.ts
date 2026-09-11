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

// Each flow owns a group. Only the DM flow writes DMs; profile changes keep the
// peer's name stable. Cloud devices can therefore exercise the same ships safely.
export async function prepareCases(zod: TlonActorClient, ten: TlonActorClient) {
  const tag = process.env.MAESTRO_RUN_TAG!;
  const out = process.env.PROOF_OUTPUT!;
  const selection = process.env.PROOF_CASES ?? 'exchange';
  const selected = (name: string) =>
    selection === 'all' || selection.split(',').includes(name);
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
      await received('~zod', 'dm mobile', 30 * 60_000);
      record('dm-delivery', {
        sender: '~zod',
        recipient: '~ten',
        text: 'dm mobile',
      });
      await ten.sendDm('~zod', 'dm verified');
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
        const result = await getChannelPosts({ channelId: g.chatChannel });
        writeFileSync(
          `${out}/reaction-observed.json`,
          JSON.stringify(
            {
              expectedId: post.id,
              posts: result.posts.map((p) => ({
                id: p.id,
                text: p.textContent,
                reactions: p.reactions,
              })),
            },
            null,
            2
          )
        );
        return result.posts.find((p) => p.id === post.id)?.reactions ?? [];
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
