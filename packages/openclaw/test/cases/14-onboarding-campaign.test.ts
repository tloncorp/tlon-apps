/** Real gateway/DM proof; accelerate only the disposable fixture's durable enrollment time. */
import { appendToPostBlob, parsePostBlob } from '@tloncorp/api';
import { execFileSync } from 'node:child_process';
import { beforeAll, expect, test } from 'vitest';
import type { CampaignState } from '../../src/monitor/campaign/model.js';
import { DAY } from '../../src/monitor/campaign/model.js';
import {
  getFixtures,
  registerEngagingTurn,
  requireThirdParty,
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
    const owner = process.argv[1];
    const row = db.prepare('SELECT * FROM campaign_owner WHERE owner=?').get(owner);
    if (row) {
      row.sent = db.prepare('SELECT step,at,text,destination FROM campaign_sent WHERE owner=? ORDER BY at').all(owner);
      row.skipped = db.prepare('SELECT step,reason FROM campaign_skipped WHERE owner=?').all(owner);
    }
    console.log(JSON.stringify(row ?? null)); db.close();
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
    // Always change a reloadable channel option, even when an earlier suite
    // left it enabled. An identical config write does not restart the monitor.
    const signature = config.channels.tlon.showModelSignature === true;
    Object.assign(config.channels.tlon, JSON.parse(process.argv[1]));
    config.channels.tlon.showModelSignature = !signature;
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
async function sendCampaignMessage(text: string) {
  if (!fixtures.group) throw new Error('Fixture group required');
  await fixtures.userState.sendPost({
    channelId: fixtures.group.chatChannel,
    content: [{ inline: [text] }],
  });
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
  // Give this case its own marker history, including when the fake ships are reused.
  const title = `Campaign ${Date.now()}`;
  const created = await fixtures.botState.createGroup(title, [
    fixtures.userShip,
  ]);
  await fixtures.userState.joinGroup(created.groupId);
  await waitFor(
    async () =>
      (await fixtures.userState.isMemberOfGroup(created.groupId))
        ? true
        : undefined,
    30_000
  );
  fixtures = {
    ...fixtures,
    group: { id: created.groupId, title, chatChannel: created.chatChannel },
  };
});

test('enrolls a live initial request, sends one marked private-channel tip, creates agreed work, asks scheduled feedback, and saves opt-out', async () => {
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
  const introSentAt = Date.now();
  await fixtures.userState.sendPost({
    channelId: fixtures.group.chatChannel,
    content: [{ inline: ["Let's get set up."] }],
    blob,
  });
  const enrolled = await waitFor(async () => campaignState(), 30_000);
  expect(enrolled.status).toBe('active');
  expect(enrolled.sent).toHaveLength(0);
  // Enrollment may arrive through catch-up before the live intro handler has
  // recorded owner activity. Let it settle before advancing fixture time.
  await waitFor(
    async () =>
      (campaignState()?.lastActivityAt ?? 0) >= introSentAt ? true : undefined,
    30_000
  );
  const personalized =
    'Before your Friday client meetings, I could prepare a short company update. Which company should we try?';
  const draftTag = await registerEngagingTurn('campaign-personalized', [
    { kind: 'text', content: personalized },
  ]);
  inBot(
    `
    import { DatabaseSync } from 'node:sqlite';
    const db = new DatabaseSync('/root/.openclaw/tlon/onboarding-campaign.sqlite');
    const offset = new Date().getUTCHours() - 12;
    const timezone = offset === 0 ? 'Etc/UTC' : 'Etc/GMT' + (offset > 0 ? '+' : '') + offset;
    db.prepare('UPDATE campaign_owner SET enrolledAt=?, lastActivityAt=0, timezone=?, topic=? WHERE owner=?')
      .run(Date.now() - Number(process.argv[2]) - 60000, timezone, process.argv[3], process.argv[1]);
    db.close();
  `,
    fixtures.userShip,
    String(DAY),
    `Friday client meetings ${draftTag}`
  );
  // Exercise monitor restart: durable state survives, ephemeral recent activity resets.
  await reloadConfig({});
  await waitFor(
    async () => (campaignState()?.sent.length === 1 ? true : undefined),
    90_000
  );
  expect(campaignState()?.sent[0].text).toContain(personalized);
  expect(campaignState()?.sent[0].text).toContain('/stop-tips');
  const draftCalls = await fakeModel.received('campaign-personalized');
  expect(JSON.stringify(draftCalls)).toContain('Friday client meetings');
  expect(draftCalls).toContainEqual(
    expect.objectContaining({ model: 'tlon-test-scripted', toolCount: 0 })
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
  await sendCampaignMessage(`yes ${tag}`);
  const yesCalls = await waitFor(async () => {
    const calls = await fakeModel.received('campaign-yes');
    return calls.length ? calls : undefined;
  }, 20_000);
  expect(JSON.stringify(yesCalls)).toContain(
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
            to: fixtures.group.chatChannel,
          },
        },
      },
    },
    { kind: 'text', content: 'Your Friday digest is scheduled.' },
  ]);
  await sendCampaignMessage(
    `Yes, send an architecture digest every Friday at 12:00 UTC in this channel. ${createTag}`
  );
  const readTask = () =>
    JSON.parse(
      inBot(
        `import fs from 'node:fs'; const jobsFile='/root/.openclaw/cron/jobs.json'; if (!fs.existsSync(jobsFile)) { console.log('null'); } else { const data=JSON.parse(fs.readFileSync(jobsFile,'utf8')); const job=data.jobs.find(j=>j.name==='tlon-campaign-e2e-digest'); const states=fs.existsSync('/root/.openclaw/cron/jobs-state.json') ? JSON.parse(fs.readFileSync('/root/.openclaw/cron/jobs-state.json','utf8')).jobs : {}; console.log(JSON.stringify(job ? {...job,state:states[job.id]?.state ?? job.state} : null)); }`
      )
    );
  const task = await waitFor(async () => readTask() ?? undefined, 20_000);
  expect(task.delivery?.to).toBe(fixtures.group.chatChannel);
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
    {
      kind: 'text',
      content:
        'How’s “tlon-campaign-e2e-digest” working for you? We can adjust it.',
    },
  ]);
  await sendCampaignMessage(`Run that task once now. ${runTag}`);
  await waitFor(
    async () => (readTask()?.state?.lastDelivered === true ? true : undefined),
    60_000
  );
  // Adding a third member makes the onboarding channel unsafe for personal
  // follow-ups, so the ordinary startup check must fall back to the owner DM.
  requireThirdParty(fixtures);
  await fixtures.botState.inviteToGroup(fixtures.group.id, [
    fixtures.thirdPartyShip,
  ]);
  await fixtures.thirdPartyState.joinGroup(fixtures.group.id);
  await waitFor(async () => {
    const group = (await fixtures.botState.group(fixtures.group.id)) as {
      members?: { contactId?: string; status?: string }[];
    } | null;
    return group?.members?.some(
      (member) =>
        member.contactId === fixtures.thirdPartyShip &&
        member.status === 'joined'
    )
      ? true
      : undefined;
  }, 30_000);
  // Advance the disposable fixture past spacing/recent activity, then exercise
  // the ordinary startup check. No client presence or conversation-open event.
  inBot(
    `import {DatabaseSync} from 'node:sqlite';
    const db=new DatabaseSync('/root/.openclaw/tlon/onboarding-campaign.sqlite');
    db.prepare('UPDATE campaign_owner SET lastActivityAt=0 WHERE owner=?').run(process.argv[1]);
    db.prepare('UPDATE campaign_sent SET at=? WHERE owner=?').run(Date.now()-Number(process.argv[2])-60000,process.argv[1]);
    db.close();`,
    fixtures.userShip,
    String(DAY)
  );
  await reloadConfig({});
  await waitFor(
    async () =>
      campaignState()?.sent.some((s) => s.step === 'task-feedback')
        ? true
        : undefined,
    30_000
  );
  const feedback = campaignState()?.sent.find(
    (sent) => sent.step === 'task-feedback'
  );
  expect(feedback?.text).toContain('tlon-campaign-e2e-digest');
  expect(feedback?.destination).toBe(fixtures.userShip);
  await fixtures.client.sendDm('/stop-tips');
  await waitFor(
    async () => (campaignState()?.status === 'opted-out' ? true : undefined),
    20_000
  );
  expect(campaignState()?.sent).toHaveLength(2);
  expect(readTask()?.id).toBe(task.id);
}, 180_000);
