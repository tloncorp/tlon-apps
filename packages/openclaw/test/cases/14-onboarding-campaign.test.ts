/** Real gateway/DM proof; accelerate only the disposable fixture's durable enrollment time. */
import {
  appendToPostBlob,
  parsePostBlob,
  conversationIdToPresenceContext,
} from '@tloncorp/api';
import { publishCampaignView } from '../../../app/features/top/campaignPresence.js';
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
    const db = new DatabaseSync('/root/.openclaw/tlon/onboarding-campaign.sqlite');
    const row = db.prepare('SELECT value_json FROM campaign_state WHERE key = ?').get(process.argv[1]);
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

test('enrolls a live initial request, sends one marked private-channel tip, creates agreed work, asks feedback on open, and saves opt-out', async () => {
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
    const db = new DatabaseSync('/root/.openclaw/tlon/onboarding-campaign.sqlite');
    const key = [process.argv[1]];
    const state = JSON.parse(db.prepare('SELECT value_json FROM campaign_state WHERE key=?').get(...key).value_json);
    state.enrolledAt = Date.now() - Number(process.argv[2]) - 60000;
    state.lastActivityAt = 0;
    const offset = new Date().getUTCHours() - 12;
    state.timezone = offset === 0 ? 'Etc/UTC' : 'Etc/GMT' + (offset > 0 ? '+' : '') + offset;
    db.prepare('UPDATE campaign_state SET value_json=? WHERE key=?').run(JSON.stringify(state), ...key);
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
  const resultTag = await registerEngagingTurn('campaign-result', [
    { kind: 'text', content: 'Architecture result: a verified test delivery.' },
  ]);
  const createTag = await registerEngagingTurn('campaign-task', [
    {
      kind: 'tool_call',
      name: 'cron',
      args: {
        action: 'add',
        job: {
          name: 'tlon-campaign-e2e-digest',
          schedule: { kind: 'cron', expr: '0 12 * * 5', tz: 'UTC' },
          sessionTarget: 'isolated',
          payload: {
            kind: 'agentTurn',
            message: `Send the architecture digest. ${resultTag}`,
          },
          delivery: {
            mode: 'announce',
            channel: 'tlon',
            to: fixtures.userShip,
          },
        },
      },
    },
    { kind: 'text', content: 'Your Friday digest is scheduled.' },
  ]);
  expect(
    (
      await fixtures.client.prompt(
        `Yes, send an architecture digest every Friday at 12:00 UTC in this DM. ${createTag}`
      )
    ).success
  ).toBe(true);
  const readTask = () =>
    JSON.parse(
      inBot(
        `import fs from 'node:fs'; const data=JSON.parse(fs.readFileSync('/root/.openclaw/cron/jobs.json','utf8')); console.log(JSON.stringify(data.jobs.find(j=>j.name==='tlon-campaign-e2e-digest') ?? null));`
      )
    );
  const task = await waitFor(async () => readTask() ?? undefined, 20_000);
  await waitFor(
    async () => (campaignState()?.status === 'feedback' ? true : undefined),
    20_000
  );
  const runTag = await registerEngagingTurn('campaign-run', [
    {
      kind: 'tool_call',
      name: 'cron',
      args: { action: 'run', jobId: task.id },
    },
    { kind: 'text', content: 'Running the first example now.' },
  ]);
  expect(
    (await fixtures.client.prompt(`Run that task once now. ${runTag}`)).success
  ).toBe(true);
  await waitFor(
    async () => (readTask()?.state?.lastDelivered === true ? true : undefined),
    60_000
  );
  // Advance only this disposable fixture past recent-conversation suppression.
  inBot(
    `import {DatabaseSync} from 'node:sqlite'; const db=new DatabaseSync('/root/.openclaw/tlon/onboarding-campaign.sqlite'); const row=JSON.parse(db.prepare('SELECT value_json FROM campaign_state WHERE key=?').get(process.argv[1]).value_json); row.lastActivityAt=0; db.prepare('UPDATE campaign_state SET value_json=? WHERE key=?').run(JSON.stringify(row),process.argv[1]); db.close();`,
    fixtures.userShip
  );
  await reloadConfig({ showModelSignature: false });
  const closeView = publishCampaignView({
    conversationId: fixtures.group.chatChannel,
    bot: fixtures.botShip,
    token: 'campaign-feedback-open',
    timezone: campaignState()!.timezone!,
    reportError: (error) => {
      throw error;
    },
    publish: async (input) =>
      fixtures.userState.poke({
        app: 'presence',
        mark: 'presence-action-1',
        json: {
          set: {
            disclose: input.disclose,
            key: {
              context: conversationIdToPresenceContext(input.conversationId),
              ship: fixtures.userShip,
              topic: input.topic,
            },
            timeout: input.timeout,
            display: {
              icon: null,
              text: null,
              blob: input.display?.blob ?? null,
            },
          },
        },
      }),
  });
  try {
    await waitFor(
      async () =>
        campaignState()?.sent.some((s) => s.step === 'task-feedback')
          ? true
          : undefined,
      30_000
    );
    expect(
      campaignState()?.sent.find((s) => s.step === 'task-feedback')?.text
    ).toContain('tlon-campaign-e2e-digest');
  } finally {
    await closeView();
  }
  await fixtures.client.sendDm('/stop-tips');
  await waitFor(
    async () => (campaignState()?.status === 'opted-out' ? true : undefined),
    20_000
  );
  expect(campaignState()?.sent).toHaveLength(2);
  expect(readTask()?.id).toBe(task.id);
}, 180_000);
