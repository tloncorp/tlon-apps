import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TlonActorClient } from '../../packages/tlon-bot-e2e/src/tlon/actor';

import { prepareCases } from './cases';

// Runs on the CI host. No peer control service is exposed to the internet.
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const manifest = JSON.parse(
  readFileSync('apps/tlon-web/e2e/shipManifest.json', 'utf8')
);
const actor = (name: string) =>
  new TlonActorClient({
    shipName: name,
    shipUrl:
      name === '~zod' ? process.env.PROOF_PUBLIC_URL! : manifest[name].url,
    code: manifest[name].code,
  });
const zod = actor('~zod');
const ten = actor('~ten');
const tag = process.env.MAESTRO_RUN_TAG!;
if (!/^[a-zA-Z0-9-]+$/.test(tag)) throw new Error('Missing unique run tag');
const out = process.env.PROOF_OUTPUT!;
const started = Date.now();
async function until(
  label: string,
  check: () => Promise<boolean>,
  timeout = 60_000
) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out: ${label}`);
}
async function main() {
  await zod.state.connect();
  // A poke completes only after its ack arrives over the public event stream.
  await zod.state.poke({
    app: 'hood',
    mark: 'helm-hi',
    json: 'Cloud stream preflight',
  });
  const publicStreamMs = Date.now() - started;
  await ten.state.connect();
  const snapshotPath = '.proof-snapshot/peer-result.json';
  const snapshot = existsSync(snapshotPath)
    ? JSON.parse(readFileSync(snapshotPath, 'utf8'))
    : null;
  if (snapshot) {
    const groups = await Promise.all([zod, ten].map((a) => a.state.groups()));
    if (
      groups.some((list) =>
        list.some((g: any) => g.id === snapshot.group.groupId)
      )
    ) {
      throw new Error(
        'Restored snapshot still contains the previous test group'
      );
    }
  }
  const kiln = await Promise.all(
    [zod, ten].map((a) => a.state.scry<any>('hood', '/kiln/pikes'))
  );
  const hashes = kiln.map((k) => k.groups.hash);
  if (!hashes[0] || hashes[0] !== hashes[1])
    throw new Error('Ships have different backend desk hashes');
  const group = await zod.createGroupWithChannel({
    title: `Cloud-${tag}`,
    members: ['~ten'],
  });
  await ten.state.joinGroup(group.groupId);
  await until('peer joins group', () =>
    ten.state.isMemberOfGroup(group.groupId)
  );
  const root = await ten.sendChannelPost({
    channelId: group.chatChannel,
    content: `${tag} from ten`,
  });
  await until('zod receives peer post', async () =>
    (await zod.state.channelPosts(group.chatChannel)).some(
      (p) => p.authorId === '~ten' && p.text === `${tag} from ten`
    )
  );
  const suite = await prepareCases(zod, ten);
  const evidence = {
    fixtures: suite.fixtures,
    source: process.env.GITHUB_SHA,
    snapshotSource: snapshot?.source,
    previousFixtureCleared: snapshot ? true : null,
    publicStreamMs,
    deskHashes: hashes,
    group,
    setupMs: Date.now() - started,
  };
  writeFileSync(`${out}/peer-ready.json`, JSON.stringify(evidence, null, 2));
  console.log('PEER_READY', JSON.stringify(evidence));
  const casesDone = suite.run();
  if (!suite.selected('exchange')) {
    const checks = await casesDone;
    writeFileSync(
      `${out}/peer-result.json`,
      JSON.stringify({ ...evidence, checks }, null, 2)
    );
    process.exit(0);
  }
  let mobileId: string | undefined;
  await until(
    'native reply reaches ten',
    async () => {
      mobileId = (await ten.state.channelPosts(group.chatChannel)).find(
        (p) => p.authorId === '~zod' && p.text === `${tag} from mobile`
      )?.id;
      return !!mobileId;
    },
    30 * 60_000
  );
  await ten.sendChannelPost({
    channelId: group.chatChannel,
    content: `${tag} reply received`,
  });
  await until('peer acknowledgement reaches zod', async () =>
    (await zod.state.channelPosts(group.chatChannel)).some(
      (p) => p.authorId === '~ten' && p.text === `${tag} reply received`
    )
  );
  // QA Authenticated App rows 207-209: observe the same post on the other ship.
  const checks: Record<string, string> = {};
  const record = (name: string) => {
    checks[name] = new Date().toISOString();
    writeFileSync(`${out}/peer-checks.json`, JSON.stringify(checks, null, 2));
  };
  await until(
    'edit reaches ten',
    async () =>
      (await ten.state.channelPosts(group.chatChannel)).some(
        (p) =>
          p.id === mobileId &&
          p.authorId === '~zod' &&
          p.text === `${tag} edited`
      ),
    180_000
  );
  record('edit');
  await ten.sendChannelPost({
    channelId: group.chatChannel,
    content: `${tag} edit received`,
  });
  await until(
    'delete tombstone reaches ten',
    async () =>
      (await ten.state.channelPosts(group.chatChannel)).some(
        (p) => p.id === mobileId && p.isDeleted === true
      ),
    180_000
  );
  record('delete');
  await ten.sendChannelPost({
    channelId: group.chatChannel,
    content: `${tag} delete received`,
  });

  // QA rows 201-202: replies must belong to the peer's root, with exact authors.
  const thread = {
    channelId: group.chatChannel,
    rootId: root.id,
    rootAuthor: '~ten',
  };
  await until(
    'native thread reply reaches ten',
    async () =>
      (await ten.state.postWithReplies(thread)).replies.some(
        (p) => p.author === '~zod' && p.text === `${tag} thread from mobile`
      ),
    180_000
  );
  await ten.replyToPost({
    channelId: group.chatChannel,
    parentId: root.id,
    parentAuthor: '~ten',
    content: `${tag} thread from ten`,
  });
  await until('both replies reach zod', async () => {
    const { replies } = await zod.state.postWithReplies(thread);
    return (
      replies.some(
        (p) => p.author === '~zod' && p.text === `${tag} thread from mobile`
      ) &&
      replies.some(
        (p) => p.author === '~ten' && p.text === `${tag} thread from ten`
      )
    );
  });
  record('thread');
  await casesDone;
  writeFileSync(
    `${out}/peer-result.json`,
    JSON.stringify(
      {
        ...evidence,
        replyVerified: true,
        checks,
        mobilePostId: mobileId,
        threadRootId: root.id,
        acknowledgementAt: new Date().toISOString(),
        elapsedMs: Date.now() - started,
      },
      null,
      2
    )
  );
  console.log('PEER_REPLY_VERIFIED');
  process.exit(0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
