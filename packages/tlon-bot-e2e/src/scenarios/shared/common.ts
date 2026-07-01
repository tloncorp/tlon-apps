import type { FakeModelClient, ReceivedCall } from '../../fake-model/index.js';
import type { RuntimeContext } from '../../drivers/types.js';
import { sleep, waitFor } from '../../runtime/waiters.js';
import type { ChannelPost, PromptResult, StoryInput } from '../../tlon/index.js';
import { normalizeShip } from '../../tlon/index.js';
import type { ScenarioActors, ScenarioActor } from './actors.js';
import { testScenario, type SharedScenario } from './dsl.js';
import {
  allowDmFrom,
  monitorGroupChannels,
  settingsBucket,
  waitForSettingsEntries,
  withSettingsEntry,
} from './isolation.js';
import {
  expectModelExpectations,
  expectNoModelCalls,
  registerModelScript,
} from './model.js';

const NEGATIVE_SETTLE_MS = 12_000;

export const commonScenarios: readonly SharedScenario[] = [
  testScenario('connectivity', {}, async ({ ctx, actors }) => {
    await actors.bot.state.connect();
    await actors.owner.state.connect();
    await actors.thirdParty.state.connect();

    const selfProfile = await actors.bot.state.scry<unknown>(
      'contacts',
      '/v1/self'
    );
    if (selfProfile == null) {
      throw new Error('Expected bot self-profile scry to return a value.');
    }

    await actors.owner.state.channelPosts(actors.bot.ship, 10);

    const bucket = await settingsBucket(actors);
    if (!bucket || typeof bucket !== 'object') {
      throw new Error('Expected bot settings bucket to be readable.');
    }

    await expectNoModelCalls(ctx.fakeModel);
  }),

  testScenario('owner-dm-text-reply', {}, async ({ ctx, driver, actors }) => {
    const key = scenarioKey('owner-text');
    const reply = `Common text reply ${key}`;
    const script = driver.model.replyText(reply);
    const tag = await registerModelScript(ctx.fakeModel, key, script);

    const result = await actors.owner.prompt(
      `${tag} Reply with the scripted common text.`
    );

    expectPromptSuccess(result, reply);
    await expectModelExpectations(ctx.fakeModel, key, script);
  }),

  testScenario('owner-dm-tlon-tool-final-reply', {}, async ({ ctx, driver, actors }) => {
    const key = scenarioKey('owner-tlon');
    const finalReply = `Common tlon command final reply ${key}`;
    const script = driver.model.readOrAdmin('version', finalReply);
    const tag = await registerModelScript(ctx.fakeModel, key, script);

    const result = await actors.owner.prompt(
      `${tag} Run a harmless Tlon version command, then reply with the scripted result.`,
      { timeoutMs: 120_000 }
    );

    expectPromptSuccess(result, finalReply);
    await expectModelExpectations(ctx.fakeModel, key, script);
  }),

  testScenario('unauthorized-third-party-dm-ignored', {}, async ({ ctx, actors }) => {
    const key = scenarioKey('unauthorized');
    const baseline = await actors.thirdParty.state.latestSequenceFrom(
      actors.bot.ship,
      actors.bot.ship
    );

    await actors.thirdParty.sendDm(
      `[tlon-test:${key}] Unauthorized sender should not reach the model.`
    );
    await expectNoDirectReply(actors.thirdParty, actors.bot.ship, baseline);
    await expectNoModelCalls(ctx.fakeModel);
  }),

  testScenario('allowlisted-third-party-dm-reply', {}, async ({ ctx, driver, actors }) => {
    await allowDmFrom(actors, actors.thirdParty.ship);
    const key = scenarioKey('allowlisted-third-party');
    const reply = `Allowlisted third-party reply ${key}`;
    const script = driver.model.replyText(reply);
    const tag = await registerModelScript(ctx.fakeModel, key, script);

    const result = await actors.thirdParty.prompt(
      `${tag} Reply to this allowlisted sender.`
    );

    expectPromptSuccess(result, reply);
    await expectModelExpectations(ctx.fakeModel, key, script);
  }),

  testScenario('owner-dm-works-when-owner-listen-off', {}, async ({
    ctx,
    driver,
    actors,
  }) => {
    await withSettingsEntry(actors, 'ownerListenEnabled', false);
    const key = scenarioKey('owner-dm-owner-listen-off');
    const reply = `Owner DM while owner-listen is off ${key}`;
    const script = driver.model.replyText(reply);
    const tag = await registerModelScript(ctx.fakeModel, key, script);

    const result = await actors.owner.prompt(
      `${tag} Reply even though owner-listen is disabled for channels.`
    );

    expectPromptSuccess(result, reply);
    await expectModelExpectations(ctx.fakeModel, key, script);
  }),

  testScenario('owner-listen-channel-plain-owner-post-engages', {}, async ({
    ctx,
    driver,
    actors,
  }) => {
    const fixture = await createOwnerHostedChannelFixture(actors);
    const key = scenarioKey('owner-listen-plain-on');
    const reply = `Owner-listen heard plain owner post ${key}`;
    const script = driver.model.replyText(reply);
    const tag = await registerModelScript(ctx.fakeModel, key, script);
    const baseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );

    await actors.owner.sendChannelPost({
      channelId: fixture.channelId,
      content: `${tag} Plain owner post should wake the bot.`,
    });

    await waitForModelCalls(ctx.fakeModel, key);
    await waitForBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      reply,
      baseline
    );
    await expectModelExpectations(ctx.fakeModel, key, script);
  }),

  testScenario('owner-listen-channel-plain-owner-post-skipped-when-off', {}, async ({
    ctx,
    actors,
  }) => {
    const fixture = await createOwnerHostedChannelFixture(actors);
    await withSettingsEntry(actors, 'ownerListenEnabled', false);
    const key = scenarioKey('owner-listen-plain-off');
    const baseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );
    const modelBaseline = await modelCallCount(ctx.fakeModel);

    await actors.owner.sendChannelPost({
      channelId: fixture.channelId,
      content: `[tlon-test:${key}] Plain owner post should not wake the bot.`,
    });

    await expectNoNewModelCallsAfterSettle(ctx.fakeModel, modelBaseline);
    await expectNoBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      baseline
    );
  }),

  testScenario('owner-listen-channel-mention-overrides-global-off', {}, async ({
    ctx,
    driver,
    actors,
  }) => {
    const fixture = await createOwnerHostedChannelFixture(actors);
    await withSettingsEntry(actors, 'ownerListenEnabled', false);
    const key = scenarioKey('owner-listen-mention-off');
    const reply = `Owner mention overrides owner-listen off ${key}`;
    const script = driver.model.replyText(reply);
    const tag = await registerModelScript(ctx.fakeModel, key, script);
    const baseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );

    await actors.owner.sendChannelPost({
      channelId: fixture.channelId,
      content: storyWithMention(
        actors.bot.ship,
        `${tag} Mention should wake the bot.`
      ),
    });

    await waitForModelCalls(ctx.fakeModel, key);
    await waitForBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      reply,
      baseline
    );
    await expectModelExpectations(ctx.fakeModel, key, script);
  }),

  testScenario('owner-listen-channel-plain-owner-post-skipped-when-muted', {}, async ({
    ctx,
    actors,
  }) => {
    const fixture = await createOwnerHostedChannelFixture(actors);
    await withSettingsEntry(actors, 'ownerListenDisabledChannels', [
      fixture.channelId,
    ]);
    const key = scenarioKey('owner-listen-muted-plain');
    const baseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );
    const modelBaseline = await modelCallCount(ctx.fakeModel);

    await actors.owner.sendChannelPost({
      channelId: fixture.channelId,
      content: `[tlon-test:${key}] Plain owner post in muted channel should not wake the bot.`,
    });

    await expectNoNewModelCallsAfterSettle(ctx.fakeModel, modelBaseline);
    await expectNoBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      baseline
    );
  }),

  testScenario('owner-listen-channel-mention-overrides-muted-channel', {}, async ({
    ctx,
    driver,
    actors,
  }) => {
    const fixture = await createOwnerHostedChannelFixture(actors);
    await withSettingsEntry(actors, 'ownerListenDisabledChannels', [
      fixture.channelId,
    ]);
    const key = scenarioKey('owner-listen-muted-mention');
    const reply = `Owner mention overrides channel mute ${key}`;
    const script = driver.model.replyText(reply);
    const tag = await registerModelScript(ctx.fakeModel, key, script);
    const baseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );

    await actors.owner.sendChannelPost({
      channelId: fixture.channelId,
      content: storyWithMention(
        actors.bot.ship,
        `${tag} Mention should wake the bot in a muted channel.`
      ),
    });

    await waitForModelCalls(ctx.fakeModel, key);
    await waitForBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      reply,
      baseline
    );
    await expectModelExpectations(ctx.fakeModel, key, script);
  }),

  testScenario('owner-listen-all-off-command-persists', {}, async ({ ctx, actors }) => {
    await withSettingsEntry(actors, 'ownerListenEnabled', true);

    const result = await actors.owner.prompt('/owner-listen all off', {
      timeoutMs: 60_000,
    });

    expectPromptSuccess(result, 'Global owner-listen is now off');
    await waitForSettingsEntries(actors, { ownerListenEnabled: false });
    await expectNoModelCallsAfterSettle(ctx.fakeModel);
  }),

  testScenario('owner-listen-all-on-command-persists', {}, async ({ ctx, actors }) => {
    await withSettingsEntry(actors, 'ownerListenEnabled', false);

    const result = await actors.owner.prompt('/owner-listen all on', {
      timeoutMs: 60_000,
    });

    expectPromptSuccess(result, 'Global owner-listen is now on');
    await waitForSettingsEntries(actors, { ownerListenEnabled: true });
    await expectNoModelCallsAfterSettle(ctx.fakeModel);
  }),

  testScenario('known-bot-loop-protection-resets-on-human-dispatch', {}, async ({
    ctx,
    driver,
    actors,
  }) => {
    const fixture = await createOwnerHostedChannelFixture(actors);
    await openChannelAccess(actors, fixture.channelId);

    const loopLimit = knownBotLoopLimit(ctx);
    const allowedTurns = Array.from({ length: loopLimit }, (_, index) => {
      const key = scenarioKey(`loop-bot-${index + 1}`);
      return {
        key,
        reply: `Known bot response ${index + 1} ${key}`,
      };
    });
    const droppedKey = scenarioKey('loop-bot-dropped');
    const humanKey = scenarioKey('loop-human-reset');
    const afterResetKey = scenarioKey('loop-bot-after-reset');
    const humanReply = `Human reset response ${humanKey}`;
    const afterResetReply = `Known bot after reset response ${afterResetKey}`;

    for (const turn of allowedTurns) {
      await registerModelScript(
        ctx.fakeModel,
        turn.key,
        driver.model.replyText(turn.reply)
      );
    }
    await registerModelScript(
      ctx.fakeModel,
      humanKey,
      driver.model.replyText(humanReply)
    );
    await registerModelScript(
      ctx.fakeModel,
      afterResetKey,
      driver.model.replyText(afterResetReply)
    );

    for (const [index, turn] of allowedTurns.entries()) {
      const baseline = await botChannelBaseline(
        actors.owner,
        fixture.channelId,
        actors.bot.ship
      );
      await actors.thirdParty.sendChannelPost({
        channelId: fixture.channelId,
        content: storyWithMention(
          actors.bot.ship,
          `[tlon-test:${turn.key}] Known bot mention ${index + 1}.`
        ),
        botProfile: botProfileFor(actors.thirdParty.ship),
      });
      await waitForModelCalls(ctx.fakeModel, turn.key);
      await waitForBotChannelReply(
        actors.owner,
        fixture.channelId,
        actors.bot.ship,
        turn.reply,
        baseline
      );
    }

    const droppedBaseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );
    const droppedModelBaseline = await modelCallCount(ctx.fakeModel);
    await actors.thirdParty.sendChannelPost({
      channelId: fixture.channelId,
      content: storyWithMention(
        actors.bot.ship,
        `[tlon-test:${droppedKey}] Known bot mention should be dropped.`
      ),
      botProfile: botProfileFor(actors.thirdParty.ship),
    });
    await expectNoNewModelCallsAfterSettle(
      ctx.fakeModel,
      droppedModelBaseline
    );
    await expectNoBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      droppedBaseline
    );

    const humanBaseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );
    await actors.owner.sendChannelPost({
      channelId: fixture.channelId,
      content: storyWithMention(
        actors.bot.ship,
        `[tlon-test:${humanKey}] Human mention resets the loop counter.`
      ),
    });
    await waitForModelCalls(ctx.fakeModel, humanKey);
    await waitForBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      humanReply,
      humanBaseline
    );

    const afterResetBaseline = await botChannelBaseline(
      actors.owner,
      fixture.channelId,
      actors.bot.ship
    );
    await actors.thirdParty.sendChannelPost({
      channelId: fixture.channelId,
      content: storyWithMention(
        actors.bot.ship,
        `[tlon-test:${afterResetKey}] Known bot mention after reset.`
      ),
      botProfile: botProfileFor(actors.thirdParty.ship),
    });
    await waitForModelCalls(ctx.fakeModel, afterResetKey);
    await waitForBotChannelReply(
      actors.owner,
      fixture.channelId,
      actors.bot.ship,
      afterResetReply,
      afterResetBaseline
    );

    await expectNoModelCalls(ctx.fakeModel, droppedKey);
  }),
];

function scenarioKey(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function expectPromptSuccess(result: PromptResult, expectedText: string): void {
  if (!result.success) {
    throw new Error(result.error ?? 'Prompt failed without an error message.');
  }
  if (!result.text?.includes(expectedText)) {
    throw new Error(
      `Expected visible reply to include ${JSON.stringify(expectedText)}, ` +
        `got ${JSON.stringify(result.text ?? '')}.`
    );
  }
}

async function expectNoDirectReply(
  actor: { state: { channelPosts(channelId: string, count?: number): Promise<any[]> } },
  botShip: string,
  baselineSequence: number,
  settleMs = 12_000
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < settleMs) {
    await sleep(500);
    const posts = await actor.state.channelPosts(botShip, 30);
    const directReply = posts
      .filter((post) => post.authorId === botShip)
      .filter((post) => post.text.length > 0)
      .find(
        (post) =>
          typeof post.sequenceNum === 'number' &&
          post.sequenceNum > baselineSequence
      );
    if (directReply) {
      throw new Error(
        `Unexpected direct DM reply from ${botShip}: ${directReply.text.slice(0, 200)}`
      );
    }
  }
}

async function waitForModelCalls(
  fakeModel: FakeModelClient,
  key: string,
  minCalls = 1
): Promise<ReceivedCall[]> {
  return waitFor(
    async () => {
      const calls = await fakeModel.received(key);
      return calls.length >= minCalls ? calls : undefined;
    },
    {
      timeoutMs: 90_000,
      intervalMs: 500,
      description: `model call(s) for ${key}`,
    }
  );
}

async function modelCallCount(fakeModel: FakeModelClient): Promise<number> {
  return (await fakeModel.received()).length;
}

async function expectNoNewModelCallsAfterSettle(
  fakeModel: FakeModelClient,
  baselineCount: number,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  await sleep(settleMs);
  const calls = await fakeModel.received();
  if (calls.length !== baselineCount) {
    const newCalls = calls.slice(baselineCount);
    const summary = newCalls
      .map((call) => call.key ?? '<unkeyed>')
      .slice(0, 5)
      .join(', ');
    throw new Error(
      `Expected no new model calls after baseline ${baselineCount}, ` +
        `got ${calls.length}` +
        (summary ? ` (new: ${summary})` : '') +
        `.`
    );
  }
}

async function expectNoModelCallsAfterSettle(
  fakeModel: FakeModelClient,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  await sleep(settleMs);
  await expectNoModelCalls(fakeModel);
}

async function createOwnerHostedChannelFixture(
  actors: ScenarioActors
): Promise<{ groupId: string; channelId: string }> {
  const group = await actors.owner.createGroupWithChannel({
    title: `shared-e2e-${scenarioKey('channel')}`,
    members: [actors.bot.ship, actors.thirdParty.ship],
  });

  await ensureGroupMember(actors.owner, group.groupId, actors.bot);
  await ensureGroupMember(actors.owner, group.groupId, actors.thirdParty);
  await monitorGroupChannels(actors, [group.chatChannel]);

  return { groupId: group.groupId, channelId: group.chatChannel };
}

async function ensureGroupMember(
  owner: ScenarioActor,
  groupId: string,
  member: ScenarioActor
): Promise<void> {
  if (!(await member.state.isMemberOfGroup(groupId))) {
    await owner.state.inviteToGroup(groupId, [member.ship]);
    await sleep(500);
    await member.state.joinGroup(groupId);
  }
  await waitFor(
    async () =>
      (await member.state.isMemberOfGroup(groupId)) ? true : undefined,
    {
      timeoutMs: 15_000,
      intervalMs: 500,
      description: `${member.ship} group membership in ${groupId}`,
    }
  );
}

async function openChannelAccess(
  actors: ScenarioActors,
  channelId: string
): Promise<void> {
  const rules = JSON.stringify({
    [channelId]: { mode: 'open' },
  });
  await withSettingsEntry(actors, 'channelRules', rules);
}

function storyWithMention(ship: string, text: string): StoryInput {
  return [{ inline: [{ ship: normalizeShip(ship) }, ` ${text}`] }] as StoryInput;
}

function botProfileFor(ship: string): { nickname: string; avatar: string } {
  return {
    nickname: `${normalizeShip(ship)} test bot`,
    avatar: '',
  };
}

function knownBotLoopLimit(ctx: RuntimeContext): number {
  const raw = ctx.composeEnv.TLON_MAX_CONSECUTIVE_BOT_RESPONSES ?? '2';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `TLON_MAX_CONSECUTIVE_BOT_RESPONSES must be a positive integer for shared loop coverage, got ${JSON.stringify(raw)}.`
    );
  }
  return value;
}

async function waitForBotChannelReply(
  actor: ScenarioActor,
  channelId: string,
  botShip: string,
  expectedText: string,
  baseline: ChannelBaseline
): Promise<ChannelPost> {
  return waitFor(
    async () => {
      const posts = await actor.state.channelPosts(channelId, 40);
      return channelPostsByBot(posts, botShip).find(
        (post) =>
          post.text.includes(expectedText) &&
          postAfterBaseline(post, baseline)
      );
    },
    {
      timeoutMs: 90_000,
      intervalMs: 500,
      description: `bot channel reply containing ${JSON.stringify(expectedText)}`,
    }
  );
}

async function expectNoBotChannelReply(
  actor: ScenarioActor,
  channelId: string,
  botShip: string,
  baseline: ChannelBaseline,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < settleMs) {
    await sleep(500);
    const posts = await actor.state.channelPosts(channelId, 40);
    const reply = channelPostsByBot(posts, botShip).find((post) =>
      postAfterBaseline(post, baseline)
    );
    if (reply) {
      throw new Error(
        `Unexpected channel reply from ${botShip}: ${reply.text.slice(0, 200)}`
      );
    }
  }
}

function channelPostsByBot(posts: ChannelPost[], botShip: string): ChannelPost[] {
  const normalized = normalizeShip(botShip);
  return posts
    .filter((post) => post.authorId === normalized)
    .filter((post) => post.text.length > 0);
}

interface ChannelBaseline {
  sequence: number;
  sentAt: number;
}

async function botChannelBaseline(
  actor: ScenarioActor,
  channelId: string,
  botShip: string
): Promise<ChannelBaseline> {
  const posts = channelPostsByBot(
    await actor.state.channelPosts(channelId, 40),
    botShip
  );
  return {
    sequence: posts
      .map((post) =>
        typeof post.sequenceNum === 'number' ? post.sequenceNum : -1
      )
      .reduce((max, sequence) => Math.max(max, sequence), -1),
    sentAt: posts
      .map((post) => (typeof post.sentAt === 'number' ? post.sentAt : 0))
      .reduce((max, sentAt) => Math.max(max, sentAt), 0),
  };
}

function postAfterBaseline(post: ChannelPost, baseline: ChannelBaseline): boolean {
  if (typeof post.sequenceNum === 'number' && baseline.sequence >= 0) {
    return post.sequenceNum > baseline.sequence;
  }
  if (typeof post.sentAt === 'number' && baseline.sentAt > 0) {
    return post.sentAt > baseline.sentAt;
  }
  return baseline.sequence < 0 && baseline.sentAt <= 0;
}
