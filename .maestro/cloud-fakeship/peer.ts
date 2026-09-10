import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TlonActorClient } from '../../packages/tlon-bot-e2e/src/tlon/actor';

// Runs on the CI host. No peer control service is exposed to the internet.
process.chdir(fileURLToPath(new URL('../../', import.meta.url)));
const manifest = JSON.parse(readFileSync('apps/tlon-web/e2e/shipManifest.json', 'utf8'));
const actor = (name: string) => new TlonActorClient({
  shipName: name, shipUrl: manifest[name].url, code: manifest[name].code,
});
const zod = actor('~zod');
const ten = actor('~ten');
const tag = process.env.MAESTRO_RUN_TAG!;
if (!/^[a-zA-Z0-9-]+$/.test(tag)) throw new Error('Missing unique run tag');
const out = process.env.PROOF_OUTPUT!;
const started = Date.now();
async function until(label: string, check: () => Promise<boolean>, timeout = 60_000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  throw new Error(`Timed out: ${label}`);
}
async function main() {
  await zod.state.connect();
  await ten.state.connect();
  const kiln = await Promise.all([zod, ten].map(a => a.state.scry<any>('hood', '/kiln/pikes')));
  const hashes = kiln.map(k => k.groups.hash);
  if (!hashes[0] || hashes[0] !== hashes[1]) throw new Error('Ships have different backend desk hashes');
  const group = await zod.createGroupWithChannel({ title: `Cloud-${tag}`, members: ['~ten'] });
  await ten.state.joinGroup(group.groupId);
  await until('peer joins group', () => ten.state.isMemberOfGroup(group.groupId));
  await ten.sendChannelPost({ channelId: group.chatChannel, content: `${tag} from ten` });
  await until('zod receives peer post', async () => (await zod.state.channelPosts(group.chatChannel)).some(p => p.authorId === '~ten' && p.text === `${tag} from ten`));
  const evidence = { source: process.env.GITHUB_SHA, deskHashes: hashes, group, setupMs: Date.now() - started };
  writeFileSync(`${out}/peer-ready.json`, JSON.stringify(evidence, null, 2));
  console.log('PEER_READY', JSON.stringify(evidence));
  await until('native reply reaches ten', async () => (await ten.state.channelPosts(group.chatChannel)).some(p => p.authorId === '~zod' && p.text === `${tag} from mobile`), 30 * 60_000);
  await ten.sendChannelPost({ channelId: group.chatChannel, content: `${tag} reply received` });
  writeFileSync(`${out}/peer-result.json`, JSON.stringify({ ...evidence, replyVerified: true, elapsedMs: Date.now() - started }, null, 2));
  console.log('PEER_REPLY_VERIFIED');
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
