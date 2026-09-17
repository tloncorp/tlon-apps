/** Real gateway/DM proof; accelerate only the disposable fixture's durable enrollment time. */
import { appendToPostBlob, parsePostBlob } from '@tloncorp/api';
import { execFileSync } from 'node:child_process';
import { beforeAll, expect, test } from 'vitest';
import type { CampaignState } from '../../src/monitor/campaign/model.js';
import { DAY } from '../../src/monitor/campaign/model.js';
import {
  getFixtures,
  registerEngagingTurn,
  waitFor,
  type TestFixtures,
} from '../lib/index.js';
import { fakeModel } from '../support/fake-model/client.js';

let fixtures: TestFixtures;
let container: string;
function inBot(script: string, ...args: string[]) {
  return execFileSync(
    'docker',
    ['exec', container, 'node', '--input-type=module', '-e', script, ...args],
    { encoding: 'utf8', timeout: 20_000 }
  );
}
function campaignState(): CampaignState | undefined {
  return (
    JSON.parse(
      inBot(
        `
    import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync('/root/.openclaw/plugin-state/state.sqlite');
    const row = db.prepare('SELECT value_json FROM plugin_state_entries WHERE plugin_id = ? AND namespace = ? AND entry_key = ?').get('tlon', 'tlon-onboarding-campaign', process.argv[1]);
    console.log(row?.value_json ?? 'null'); db.close();
  `,
        fixtures.userShip
      )
    ) ?? undefined
  );
}
async function reloadConfig(patch: Record<string, unknown>) {
  const since = new Date().toISOString();
  inBot(
    `
    import fs from 'node:fs';
    const file = '/root/.openclaw/openclaw.json';
    const config = JSON.parse(fs.readFileSync(file, 'utf8'));
    Object.assign(config.channels.tlon, JSON.parse(process.argv[1]));
    fs.writeFileSync(file, JSON.stringify(config));
  `,
    JSON.stringify(patch)
  );
  await waitFor(async () => {
    const logs = execFileSync('docker', ['logs', '--since', since, container], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return logs.includes('Connected! Firehose subscriptions active')
      ? true
      : undefined;
  }, 30_000);
}
beforeAll(async () => {
  const project = process.env.TEST_COMPOSE_PROJECT_NAME;
  if (!project)
    throw new Error('Run through test/run.sh against disposable fake ships');
  container = execFileSync(
    'docker',
    [
      'ps',
      '-q',
      '--filter',
      `label=com.docker.compose.project=${project}`,
      '--filter',
      'label=com.docker.compose.service=openclaw',
    ],
    { encoding: 'utf8' }
  ).trim();
  if (!container || container.includes('\n'))
    throw new Error('Expected one isolated gateway');
  fixtures = await getFixtures();
});

test('enrolls a live initial request, sends one marked private-channel tip, supplies yes-reply context, and saves opt-out', async () => {
  if (!fixtures.group) throw new Error('Fixture group required');
  await reloadConfig({
    onboardingCampaign: {
      enabled: true,
      enrollAfter: new Date(Date.now() - 60000).toISOString(),
    },
  });
  const readyTag = await registerEngagingTurn('campaign-ready');
  expect((await fixtures.client.prompt(readyTag)).success).toBe(true);
  const blob = appendToPostBlob(undefined, {
    type: 'tlon-agent-intro-request',
    version: 1,
    groupId: fixtures.group.id,
    isFirstGroup: true,
    campaignVersion: 1,
    timezone: 'Etc/UTC',
  });
  await fixtures.userState.sendPost({
    channelId: fixtures.group.chatChannel,
    content: [{ inline: ["Let's get set up."] }],
    blob,
  });
  const enrolled = await waitFor(async () => campaignState(), 30_000);
  expect(enrolled.status).toBe('active');
  expect(enrolled.sent).toHaveLength(0);
  inBot(
    `
    import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync('/root/.openclaw/plugin-state/state.sqlite');
    const key = ['tlon', 'tlon-onboarding-campaign', process.argv[1]];
    const state = JSON.parse(db.prepare('SELECT value_json FROM plugin_state_entries WHERE plugin_id=? AND namespace=? AND entry_key=?').get(...key).value_json);
    state.enrolledAt = Date.now() - Number(process.argv[2]) - 60000;
    state.lastActivityAt = 0;
    const offset = new Date().getUTCHours() - 12;
    state.timezone = offset === 0 ? 'Etc/UTC' : 'Etc/GMT' + (offset > 0 ? '+' : '') + offset;
    db.prepare('UPDATE plugin_state_entries SET value_json=? WHERE plugin_id=? AND namespace=? AND entry_key=?').run(JSON.stringify(state), ...key);
    db.close();
  `,
    fixtures.userShip,
    String(DAY)
  );
  // Exercise monitor restart: durable state survives, ephemeral recent activity resets.
  await reloadConfig({ showModelSignature: true });
  await waitFor(
    async () => (campaignState()?.sent.length === 1 ? true : undefined),
    90_000
  );
  const posts = (await fixtures.userState.channelPosts(
    fixtures.group.chatChannel,
    50
  )) as { authorId: string; blob?: string }[];
  expect(
    posts.filter(
      (post) =>
        post.authorId === fixtures.botShip &&
        post.blob &&
        parsePostBlob(post.blob)?.some(
          (entry) =>
            entry.type === 'tlon-agent-post-marker' &&
            entry.key === 'campaign-v1-useful-request'
        )
    )
  ).toHaveLength(1);
  const tag = await registerEngagingTurn('campaign-yes', [
    {
      kind: 'text',
      content:
        'Here is a useful answer with sources. Would this be useful every week?',
    },
  ]);
  expect((await fixtures.client.prompt(`yes ${tag}`)).success).toBe(true);
  expect(JSON.stringify(await fakeModel.received('campaign-yes'))).toContain(
    'Your most recent onboarding tip in this conversation'
  );
  await waitFor(
    async () => (campaignState()?.offeredAt ? true : undefined),
    20_000
  );
  await fixtures.client.sendDm('/stop-tips');
  await waitFor(
    async () => (campaignState()?.status === 'opted-out' ? true : undefined),
    20_000
  );
  expect(campaignState()?.sent).toHaveLength(1);
}, 180_000);
