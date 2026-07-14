import type { RuntimeContext } from '../../drivers/types.js';
import type { FakeModelClient, ReceivedCall } from '../../fake-model/index.js';
import { sleep, waitFor } from '../../runtime/waiters.js';
import type {
  ChannelPost,
  PromptResult,
  StoryInput,
} from '../../tlon/index.js';
import { normalizeShip } from '../../tlon/index.js';
import type { ScenarioActor, ScenarioActors } from './actors.js';
import { type SharedScenario, testScenario } from './dsl.js';
import {
  allowDmFrom,
  monitorGroupChannels,
  settingsBucket,
  waitForSettingsEntries,
  waitForSettingsKeysAbsent,
  withNudgeSettingsIsolation,
  withSettingsEntry,
} from './isolation.js';
import {
  type BenignModelCallPredicate,
  benignModelCallPredicate,
  expectModelExpectations,
  expectNoModelCalls,
  registerModelScript,
} from './model.js';

const NEGATIVE_SETTLE_MS = 12_000;
const MODEL_CALL_WAIT_MS = 90_000;
const BOT_REPLY_WAIT_MS = 90_000;
const LOOP_TIMEOUT_MARGIN_MS = 60_000;
const NUDGE_DELIVERY_WAIT_MS = 90_000;
const NUDGE_CLEANUP_WAIT_MS = 45_000;
const NUDGE_DUPLICATE_WINDOW_MS = 15_000;

export const commonScenarios: readonly SharedScenario[] = [
  testScenario('connectivity', {}, async ({ ctx, driver, actors }) => {
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

    await expectNoModelCallsAfterSettle(
      ctx.fakeModel,
      benignModelCallPredicate(driver)
    );
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

  testScenario(
    'owner-dm-tlon-tool-final-reply',
    {},
    async ({ ctx, driver, actors }) => {
      const key = scenarioKey('owner-tlon');
      const nicknameToken = `shared-tool-${key}`;
      const finalReply = `Common tlon command final reply ${key}`;
      const previousNickname = await botNickname(actors.bot);
      actors.bot.teardown(
        async () => {
          await setBotNickname(actors.bot, previousNickname);
          await waitForBotNickname(actors.bot, previousNickname);
        },
        { kind: 'profile-rollback', label: 'restore bot nickname' }
      );

      const script = driver.model.readOrAdmin(
        `contacts update-profile --nickname ${JSON.stringify(nicknameToken)}`,
        finalReply
      );
      const tag = await registerModelScript(ctx.fakeModel, key, script);

      const result = await actors.owner.prompt(
        `${tag} Update your profile nickname to ${JSON.stringify(
          nicknameToken
        )} via the Tlon tool, then reply with the scripted result.`,
        { timeoutMs: 120_000 }
      );

      expectPromptSuccess(result, finalReply);
      await waitForBotNickname(actors.bot, nicknameToken);
      await expectModelExpectations(ctx.fakeModel, key, script);
    }
  ),

  testScenario(
    'unauthorized-third-party-dm-ignored',
    {},
    async ({ ctx, driver, actors }) => {
      const key = scenarioKey('unauthorized');
      const baseline = await actors.thirdParty.state.latestSequenceFrom(
        actors.bot.ship,
        actors.bot.ship
      );

      await actors.thirdParty.sendDm(
        `[tlon-test:${key}] Unauthorized sender should not reach the model.`
      );
      await expectNoDirectReply(actors.thirdParty, actors.bot.ship, baseline);
      await expectNoModelCalls(
        ctx.fakeModel,
        undefined,
        benignModelCallPredicate(driver)
      );
    }
  ),

  testScenario(
    'allowlisted-third-party-dm-reply',
    {},
    async ({ ctx, driver, actors }) => {
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
    }
  ),

  testScenario(
    'owner-dm-works-when-owner-listen-off',
    {},
    async ({ ctx, driver, actors }) => {
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
    }
  ),

  testScenario(
    'owner-listen-channel-plain-owner-post-engages',
    {},
    async ({ ctx, driver, actors }) => {
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
    }
  ),

  testScenario(
    'owner-listen-channel-plain-owner-post-skipped-when-off',
    {},
    async ({ ctx, driver, actors }) => {
      const fixture = await createOwnerHostedChannelFixture(actors);
      await withSettingsEntry(actors, 'ownerListenEnabled', false);
      const key = scenarioKey('owner-listen-plain-off');
      const isBenign = benignModelCallPredicate(driver);
      const baseline = await botChannelBaseline(
        actors.owner,
        fixture.channelId,
        actors.bot.ship
      );
      const modelBaseline = await modelCallCount(ctx.fakeModel, isBenign);

      await actors.owner.sendChannelPost({
        channelId: fixture.channelId,
        content: `[tlon-test:${key}] Plain owner post should not wake the bot.`,
      });

      await expectNoNewModelCallsAfterSettle(
        ctx.fakeModel,
        isBenign,
        modelBaseline
      );
      await expectNoBotChannelReply(
        actors.owner,
        fixture.channelId,
        actors.bot.ship,
        baseline
      );
    }
  ),

  testScenario(
    'owner-listen-channel-mention-overrides-global-off',
    {},
    async ({ ctx, driver, actors }) => {
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
    }
  ),

  testScenario(
    'owner-listen-channel-plain-owner-post-skipped-when-muted',
    {},
    async ({ ctx, driver, actors }) => {
      const fixture = await createOwnerHostedChannelFixture(actors);
      await withSettingsEntry(actors, 'ownerListenDisabledChannels', [
        fixture.channelId,
      ]);
      const key = scenarioKey('owner-listen-muted-plain');
      const isBenign = benignModelCallPredicate(driver);
      const baseline = await botChannelBaseline(
        actors.owner,
        fixture.channelId,
        actors.bot.ship
      );
      const modelBaseline = await modelCallCount(ctx.fakeModel, isBenign);

      await actors.owner.sendChannelPost({
        channelId: fixture.channelId,
        content: `[tlon-test:${key}] Plain owner post in muted channel should not wake the bot.`,
      });

      await expectNoNewModelCallsAfterSettle(
        ctx.fakeModel,
        isBenign,
        modelBaseline
      );
      await expectNoBotChannelReply(
        actors.owner,
        fixture.channelId,
        actors.bot.ship,
        baseline
      );
    }
  ),

  testScenario(
    'owner-listen-channel-mention-overrides-muted-channel',
    {},
    async ({ ctx, driver, actors }) => {
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
    }
  ),

  testScenario(
    'owner-listen-all-off-command-persists',
    {},
    async ({ ctx, driver, actors }) => {
      await withSettingsEntry(actors, 'ownerListenEnabled', true);

      const result = await actors.owner.prompt('/owner-listen all off', {
        timeoutMs: 60_000,
      });

      expectPromptSuccess(result, 'Global owner-listen is now off');
      await waitForSettingsEntries(actors, { ownerListenEnabled: false });
      await expectNoModelCallsAfterSettle(
        ctx.fakeModel,
        benignModelCallPredicate(driver)
      );
    }
  ),

  testScenario(
    'owner-listen-all-on-command-persists',
    {},
    async ({ ctx, driver, actors }) => {
      await withSettingsEntry(actors, 'ownerListenEnabled', false);

      const result = await actors.owner.prompt('/owner-listen all on', {
        timeoutMs: 60_000,
      });

      expectPromptSuccess(result, 'Global owner-listen is now on');
      await waitForSettingsEntries(actors, { ownerListenEnabled: true });
      await expectNoModelCallsAfterSettle(
        ctx.fakeModel,
        benignModelCallPredicate(driver)
      );
    }
  ),

  testScenario(
    'known-bot-loop-protection-resets-on-human-dispatch',
    { timeoutMs: knownBotLoopScenarioTimeoutMs },
    async ({ ctx, driver, actors }) => {
      const fixture = await createOwnerHostedChannelFixture(actors);
      await openChannelAccess(actors, fixture.channelId);

      const loopLimit = knownBotLoopLimit(ctx);
      const allowedTurns = Array.from({ length: loopLimit }, (_, index) => {
        const key = scenarioKey(`loop-bot-${index + 1}`);
        const reply = `Known bot response ${index + 1} ${key}`;
        return {
          key,
          reply,
          script: driver.model.replyText(reply),
        };
      });
      const droppedKey = scenarioKey('loop-bot-dropped');
      const humanKey = scenarioKey('loop-human-reset');
      const afterResetKey = scenarioKey('loop-bot-after-reset');
      const humanReply = `Human reset response ${humanKey}`;
      const afterResetReply = `Known bot after reset response ${afterResetKey}`;

      for (const turn of allowedTurns) {
        await registerModelScript(ctx.fakeModel, turn.key, turn.script);
      }
      const humanScript = driver.model.replyText(humanReply);
      const afterResetScript = driver.model.replyText(afterResetReply);
      await registerModelScript(ctx.fakeModel, humanKey, humanScript);
      await registerModelScript(ctx.fakeModel, afterResetKey, afterResetScript);

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
        await expectModelExpectations(ctx.fakeModel, turn.key, turn.script);
      }

      const droppedBaseline = await botChannelBaseline(
        actors.owner,
        fixture.channelId,
        actors.bot.ship
      );
      const isBenign = benignModelCallPredicate(driver);
      const droppedModelBaseline = await modelCallCount(
        ctx.fakeModel,
        isBenign
      );
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
        isBenign,
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
      await expectModelExpectations(ctx.fakeModel, humanKey, humanScript);

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
      await expectModelExpectations(
        ctx.fakeModel,
        afterResetKey,
        afterResetScript
      );

      await sleep(NEGATIVE_SETTLE_MS);
      for (const turn of allowedTurns) {
        await expectModelExpectations(ctx.fakeModel, turn.key, turn.script);
      }
      await expectModelExpectations(ctx.fakeModel, humanKey, humanScript);
      await expectModelExpectations(
        ctx.fakeModel,
        afterResetKey,
        afterResetScript
      );
      await expectNoModelCalls(ctx.fakeModel, droppedKey);
    }
  ),

  testScenario(
    'nudge-delivery-and-reengagement',
    {
      timeoutMs: () =>
        NUDGE_DELIVERY_WAIT_MS +
        NUDGE_CLEANUP_WAIT_MS * 2 +
        MODEL_CALL_WAIT_MS +
        NUDGE_DUPLICATE_WINDOW_MS +
        LOOP_TIMEOUT_MARGIN_MS,
    },
    async ({ ctx, driver, actors }) => {
      const isolation = await withNudgeSettingsIsolation(actors);
      const sentinelAt = Date.now();
      await isolation.set('lastOwnerMessageAt', sentinelAt);
      await isolation.set(
        'lastOwnerMessageDate',
        new Date(sentinelAt).toISOString().slice(0, 10)
      );
      await waitForSettingsEntries(actors, {
        lastOwnerMessageAt: sentinelAt,
      });

      await isolation.set('nudgeActiveHoursStart', '00:00');
      await isolation.set('nudgeActiveHoursEnd', '00:00');
      await waitForSettingsEntries(actors, {
        nudgeActiveHoursStart: '00:00',
        nudgeActiveHoursEnd: '00:00',
      });
      isolation.confirmClosedWindow();
      await isolation.delete('lastNudgeStage');
      await isolation.delete('pendingNudge');
      await waitForSettingsKeysAbsent(actors, [
        'lastNudgeStage',
        'pendingNudge',
      ]);

      const dmBaseline = await actors.owner.state.latestSequenceFrom(
        actors.bot.ship,
        actors.bot.ship
      );
      const idleAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      await isolation.set('lastOwnerMessageAt', idleAt);
      await isolation.set(
        'lastOwnerMessageDate',
        new Date(idleAt).toISOString().slice(0, 10)
      );
      await isolation.set('nudgeActiveHoursEnd', '24:00');

      const nudge = await waitFor(
        async () => {
          const posts = await actors.owner.state.channelPosts(actors.bot.ship, 40);
          return posts.find(
            (post) =>
              post.authorId === actors.bot.ship &&
              typeof post.sequenceNum === 'number' &&
              post.sequenceNum > dmBaseline &&
              post.text.includes('Hey! Quick ideas for your week:')
          );
        },
        {
          timeoutMs: NUDGE_DELIVERY_WAIT_MS,
          intervalMs: 500,
          description: 'stage-1 re-engagement nudge DM',
        }
      );
      const nudgeSequence = nudge.sequenceNum ?? dmBaseline;
      await waitFor(
        async () => {
          const bucket = await settingsBucket(actors);
          const pending = parsePendingNudge(bucket.pendingNudge);
          return bucket.lastNudgeStage === 1 && pending?.stage === 1
            ? true
            : undefined;
        },
        {
          timeoutMs: NUDGE_CLEANUP_WAIT_MS,
          intervalMs: 500,
          description: 'persisted stage-1 pending nudge',
        }
      );

      const key = scenarioKey('nudge-reengagement');
      const reply = `Nudge re-engagement reply ${key}`;
      const script = driver.model.replyText(reply);
      const tag = await registerModelScript(ctx.fakeModel, key, script);
      const replyAt = Date.now();
      await actors.owner.sendDm(`${tag} Re-engaging after the nudge.`);

      await waitFor(
        async () => {
          const bucket = await settingsBucket(actors);
          return typeof bucket.lastOwnerMessageAt === 'number' &&
            bucket.lastOwnerMessageAt >= replyAt &&
            !Object.prototype.hasOwnProperty.call(bucket, 'lastNudgeStage') &&
            !Object.prototype.hasOwnProperty.call(bucket, 'pendingNudge')
            ? true
            : undefined;
        },
        {
          timeoutMs: NUDGE_CLEANUP_WAIT_MS,
          intervalMs: 500,
          description: 'nudge re-engagement cleanup',
        }
      );
      const calls = await waitForModelCalls(ctx.fakeModel, key);
      if (
        !calls.some((call) =>
          call.userText.includes('[Context: You recently sent')
        )
      ) {
        throw new Error('Expected owner re-engagement model request to include nudge context.');
      }
      await expectModelExpectations(ctx.fakeModel, key, script);

      const started = Date.now();
      while (Date.now() - started < NUDGE_DUPLICATE_WINDOW_MS) {
        await sleep(500);
        const posts = await actors.owner.state.channelPosts(actors.bot.ship, 40);
        const duplicate = posts.find(
          (post) =>
            post.authorId === actors.bot.ship &&
            typeof post.sequenceNum === 'number' &&
            post.sequenceNum > nudgeSequence &&
            post.text.includes('Hey! Quick ideas for your week:')
        );
        if (duplicate) {
          throw new Error('Received a duplicate stage-1 re-engagement nudge.');
        }
      }
    }
  ),
];

function parsePendingNudge(value: unknown): { stage?: unknown } | undefined {
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === 'object'
        ? (parsed as { stage?: unknown })
        : undefined;
    } catch {
      return undefined;
    }
  }
  return value && typeof value === 'object'
    ? (value as { stage?: unknown })
    : undefined;
}

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
  actor: {
    state: { channelPosts(channelId: string, count?: number): Promise<any[]> };
  },
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
      timeoutMs: MODEL_CALL_WAIT_MS,
      intervalMs: 500,
      description: `model call(s) for ${key}`,
    }
  );
}

async function modelCallCount(
  fakeModel: FakeModelClient,
  isBenign: BenignModelCallPredicate
): Promise<number> {
  return (await fakeModel.received()).filter((call) => !isBenign(call)).length;
}

async function expectNoNewModelCallsAfterSettle(
  fakeModel: FakeModelClient,
  isBenign: BenignModelCallPredicate,
  baselineCount: number,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  await sleep(settleMs);
  const calls = (await fakeModel.received()).filter((call) => !isBenign(call));
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
  isBenign: BenignModelCallPredicate,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  await sleep(settleMs);
  await expectNoModelCalls(fakeModel, undefined, isBenign);
}

async function botNickname(actor: ScenarioActor): Promise<string> {
  const profile = await actor.state.scry<Record<string, unknown>>(
    'contacts',
    '/v1/self'
  );
  return extractNickname(profile);
}

async function setBotNickname(
  actor: ScenarioActor,
  nickname: string
): Promise<void> {
  await actor.state.poke({
    app: 'contacts',
    mark: 'contact-action',
    json: {
      edit: [{ nickname }],
    },
  });
}

async function waitForBotNickname(
  actor: ScenarioActor,
  expectedNickname: string
): Promise<void> {
  await waitFor(
    async () => {
      const current = await botNickname(actor);
      return current === expectedNickname ? true : undefined;
    },
    {
      timeoutMs: 45_000,
      intervalMs: 1_000,
      description: `bot nickname ${JSON.stringify(expectedNickname)}`,
    }
  );
}

function extractNickname(profile: Record<string, unknown> | undefined): string {
  const p = (profile ?? {}) as {
    nickname?: string | { value?: string | null } | null;
    nickName?: string | { value?: string | null } | null;
  };
  const fromNickname =
    typeof p.nickname === 'string'
      ? p.nickname
      : (p.nickname as { value?: string | null } | null | undefined)?.value;
  const fromNickName =
    typeof p.nickName === 'string'
      ? p.nickName
      : (p.nickName as { value?: string | null } | null | undefined)?.value;
  return fromNickname ?? fromNickName ?? '';
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
  return [
    { inline: [{ ship: normalizeShip(ship) }, ` ${text}`] },
  ] as StoryInput;
}

function botProfileFor(ship: string): { nickname: string; avatar: string } {
  return {
    nickname: `${normalizeShip(ship)} test bot`,
    avatar: '',
  };
}

function knownBotLoopLimit(ctx: RuntimeContext): number {
  const raw =
    ctx.testMetadata?.tlonMaxConsecutiveBotResponses ??
    process.env.TLON_MAX_CONSECUTIVE_BOT_RESPONSES ??
    '3';
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `TLON_MAX_CONSECUTIVE_BOT_RESPONSES must be a positive integer for shared loop coverage, got ${JSON.stringify(raw)}.`
    );
  }
  return value;
}

function knownBotLoopScenarioTimeoutMs(ctx: RuntimeContext): number {
  const allowedBotTurns = knownBotLoopLimit(ctx);
  const dispatchWaitBudget =
    (allowedBotTurns + 2) * (MODEL_CALL_WAIT_MS + BOT_REPLY_WAIT_MS);
  const settleBudget = NEGATIVE_SETTLE_MS * 3;
  return dispatchWaitBudget + settleBudget + LOOP_TIMEOUT_MARGIN_MS;
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
          post.text.includes(expectedText) && postAfterBaseline(post, baseline)
      );
    },
    {
      timeoutMs: BOT_REPLY_WAIT_MS,
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

function channelPostsByBot(
  posts: ChannelPost[],
  botShip: string
): ChannelPost[] {
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

function postAfterBaseline(
  post: ChannelPost,
  baseline: ChannelBaseline
): boolean {
  if (typeof post.sequenceNum === 'number' && baseline.sequence >= 0) {
    return post.sequenceNum > baseline.sequence;
  }
  if (typeof post.sentAt === 'number' && baseline.sentAt > 0) {
    return post.sentAt > baseline.sentAt;
  }
  return baseline.sequence < 0 && baseline.sentAt <= 0;
}
