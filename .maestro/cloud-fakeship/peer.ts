import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedNotes } from '../../scripts/agent-qa/seed-notes';
import { TlonActorClient } from '../../packages/tlon-bot-e2e/src/tlon/actor';

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
  // A poke completes only after its ack arrives over the controller event stream.
  await zod.state.poke({
    app: 'hood',
    mark: 'helm-hi',
    json: 'Cloud stream preflight',
  });
  const controllerStreamMs = Date.now() - started;
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
  await ten.sendChannelPost({
    channelId: group.chatChannel,
    content: `${tag} from ten`,
  });
  await until('zod receives peer post', async () =>
    (await zod.state.channelPosts(group.chatChannel)).some(
      (p) => p.authorId === '~ten' && p.text === `${tag} from ten`
    )
  );
  const setup = JSON.parse(process.env.QA_FIXTURE_PLAN || '{"fixtures":[]}');
  const fixtures = [];
  if (setup.fixtures.includes('notes-v1'))
    fixtures.push(
      await seedNotes({
        url: process.env.PROOF_PUBLIC_URL!,
        code: manifest['~zod'].code,
        groupId: group.groupId,
        tag,
      })
    );
  const evidence = {
    fixtures,
    regressionResults: existsSync(`${out}/regression-results.json`)
      ? JSON.parse(readFileSync(`${out}/regression-results.json`, 'utf8'))
      : [],
    source: readFileSync(`${out}/source.txt`, 'utf8').trim(),
    snapshotSource: snapshot?.source,
    previousFixtureCleared: snapshot ? true : null,
    controllerStreamMs,
    deskHashes: hashes,
    group,
    setupMs: Date.now() - started,
  };
  writeFileSync(`${out}/peer-ready.json`, JSON.stringify(evidence, null, 2));
  console.log('PEER_READY', JSON.stringify(evidence));
  if (process.env.QA_PR_MODE === 'true') {
    writeFileSync(
      `${out}/peer-result.json`,
      JSON.stringify({ ...evidence, fixtureVerified: true }, null, 2)
    );
    console.log('PR_FIXTURE_READY');
    process.exit(0);
  }
  await until(
    'native reply reaches ten',
    async () =>
      (await ten.state.channelPosts(group.chatChannel)).some(
        (p) => p.authorId === '~zod' && p.text === `${tag} from mobile`
      ),
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
  writeFileSync(
    `${out}/peer-result.json`,
    JSON.stringify(
      {
        ...evidence,
        replyVerified: true,
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
