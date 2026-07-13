import { expect } from 'vitest';

import type { RuntimeContext } from '../../drivers/types.js';
import type { FakeModelClient, ReceivedCall } from '../../fake-model/index.js';
import {
  execInComposeService,
  startComposeService,
  stopComposeService,
} from '../../runtime/docker-direct.js';
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
  withSettingsEntry,
} from './isolation.js';
import {
  type BenignModelCallPredicate,
  benignModelCallPredicate,
  expectModelExpectations,
  expectNoModelCalls,
  primaryModelCalls,
  registerModelScript,
} from './model.js';

const NEGATIVE_SETTLE_MS = 12_000;
const MODEL_CALL_WAIT_MS = 90_000;
const BOT_REPLY_WAIT_MS = 90_000;
const LOOP_TIMEOUT_MARGIN_MS = 60_000;
const REACTION_PROVENANCE_BY_DRIVER = {
  hermes: 'latest-user',
  openclaw: 'latest-user',
} as const;

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
    'reaction-on-bot-post-dispatches',
    {},
    async ({ ctx, driver, actors }) => {
      const fixture = await createOwnerHostedChannelFixture(actors);
      await withSettingsEntry(actors, 'ownerListenEnabled', false);
      const key = scenarioKey('reaction-own-post');
      const tag = `[tlon-test:${key}]`;
      const replyOne = `Reaction root reply ${key} ${tag}`;
      const reactionAck = `Reaction acknowledgement ${key}`;
      const script = driver.model.replyTexts([replyOne, reactionAck]);
      await registerModelScript(ctx.fakeModel, key, script);
      const baseline = await botChannelBaseline(
        actors.owner,
        fixture.channelId,
        actors.bot.ship
      );

      await actors.owner.sendChannelPost({
        channelId: fixture.channelId,
        content: storyWithMention(
          actors.bot.ship,
          `${tag} Write the scripted root reply.`
        ),
      });
      await waitForModelCalls(ctx.fakeModel, key);
      const botPost = await waitForBotChannelReply(
        actors.owner,
        fixture.channelId,
        actors.bot.ship,
        replyOne,
        baseline
      );
      if (!botPost.id || !botPost.authorId || botPost.parentId) {
        throw new Error(
          'Expected the initial bot reaction target to be a root post.'
        );
      }

      await actors.owner.addReact({
        channelId: fixture.channelId,
        postId: botPost.id,
        react: '👍',
        postAuthor: botPost.authorId,
      });

      // OpenClaw passes replyParentId for a reaction. Hermes adapter.py send()
      // only threads on metadata.thread_id; the shared config keeps
      // reply_in_thread false, so its top-level reaction acknowledgement stays
      // top-level.
      if (driver.name === 'openclaw') {
        const acknowledgements = await waitForThreadReplies(
          actors.owner,
          fixture.channelId,
          botPost.id,
          botPost.authorId,
          actors.bot.ship,
          reactionAck
        );
        expect(acknowledgements).toHaveLength(1);
        expect(acknowledgements[0]?.parentId).toBe(botPost.id);
      } else {
        const acknowledgement = await waitForBotChannelReply(
          actors.owner,
          fixture.channelId,
          actors.bot.ship,
          reactionAck,
          baseline
        );
        expect(acknowledgement.parentId).toBeUndefined();
      }

      const calls = await expectModelExpectations(ctx.fakeModel, key, script);
      const isBenign = benignModelCallPredicate(driver);
      await expectNoNewModelCallsAfterSettle(
        ctx.fakeModel,
        isBenign,
        await modelCallCount(ctx.fakeModel, isBenign)
      );
      if (driver.name === 'openclaw') {
        const settledAcknowledgements = await waitForThreadReplies(
          actors.owner,
          fixture.channelId,
          botPost.id,
          botPost.authorId,
          actors.bot.ship,
          reactionAck
        );
        expect(settledAcknowledgements).toHaveLength(1);
        expect(settledAcknowledgements[0]?.parentId).toBe(botPost.id);
      } else {
        const settledAcknowledgements = channelPostsByBot(
          await actors.owner.state.channelPosts(fixture.channelId, 40),
          actors.bot.ship
        ).filter(
          (post) =>
            postAfterBaseline(post, baseline) && post.text.includes(reactionAck)
        );
        expect(settledAcknowledgements).toHaveLength(1);
        expect(settledAcknowledgements[0]?.parentId).toBeUndefined();
      }
      expect(calls).toHaveLength(2);
      const reactionCall = calls[1];
      expect(reactionCall?.userText).toContain('👍');
      expect(reactionCall?.userText).toContain(replyOne);
      // Hermes carries the reactor via TlonIncomingMessage.user_id →
      // MessageEvent.source.user_id (event metadata), not in model-visible
      // text. Its text contract is emoji plus the reacted-post snippet
      // (adapter.py:_handle_reaction), while OpenClaw includes the actor in its
      // text envelope.
      if (driver.name === 'openclaw') {
        expect(reactionCall?.userText).toContain(actors.owner.ship);
      }
      // Hermes _handle_reaction() synthesizes TlonIncomingMessage.text, then
      // _dispatch_message() passes that text through the current MessageEvent.
      // The reaction tag is therefore in the latest user turn for both drivers.
      expect(reactionCall?.provenance).toBe(
        REACTION_PROVENANCE_BY_DRIVER[driver.name]
      );
    }
  ),

  testScenario(
    'channel-thread-anchoring-and-follow',
    {},
    async ({ ctx, driver, actors }) => {
      const fixture = await createOwnerHostedChannelFixture(actors);
      await withSettingsEntry(actors, 'ownerListenEnabled', false);
      const firstRoot = await actors.owner.sendChannelPost({
        channelId: fixture.channelId,
        content: `Unrelated thread root ${scenarioKey('thread-root')}`,
      });
      const secondRoot = await actors.owner.sendChannelPost({
        channelId: fixture.channelId,
        content: `Participated thread root ${scenarioKey('thread-root')}`,
      });
      const topLevelBaseline = await botChannelBaseline(
        actors.owner,
        fixture.channelId,
        actors.bot.ship
      );

      const firstKey = scenarioKey('thread-anchor');
      const firstReply = `Thread root anchor reply ${firstKey}`;
      const firstScript = driver.model.replyText(firstReply);
      const firstTag = await registerModelScript(
        ctx.fakeModel,
        firstKey,
        firstScript
      );
      await actors.owner.replyToPost({
        channelId: fixture.channelId,
        parentId: secondRoot.id,
        parentAuthor: secondRoot.authorId,
        content: storyWithMention(
          actors.bot.ship,
          `${firstTag} Reply in this thread.`
        ),
      });
      await waitForModelCalls(ctx.fakeModel, firstKey);
      const firstThreadReplies = await waitForThreadReplies(
        actors.owner,
        fixture.channelId,
        secondRoot.id,
        actors.owner.ship,
        actors.bot.ship,
        firstReply
      );
      expect(firstThreadReplies).toHaveLength(1);
      await expectModelExpectations(ctx.fakeModel, firstKey, firstScript);

      const followKey = scenarioKey('thread-follow');
      const followReply = `Participated thread follow reply ${followKey}`;
      const followScript = driver.model.replyText(followReply);
      const followTag = await registerModelScript(
        ctx.fakeModel,
        followKey,
        followScript
      );
      await actors.owner.replyToPost({
        channelId: fixture.channelId,
        parentId: secondRoot.id,
        parentAuthor: secondRoot.authorId,
        content: `${followTag} Follow the participated thread without a mention.`,
      });
      await waitForModelCalls(ctx.fakeModel, followKey);
      const followThreadReplies = await waitForThreadReplies(
        actors.owner,
        fixture.channelId,
        secondRoot.id,
        actors.owner.ship,
        actors.bot.ship,
        followReply
      );
      expect(followThreadReplies).toHaveLength(1);
      await expectModelExpectations(ctx.fakeModel, followKey, followScript);

      const controlKey = scenarioKey('thread-control');
      await actors.owner.replyToPost({
        channelId: fixture.channelId,
        parentId: firstRoot.id,
        parentAuthor: firstRoot.authorId,
        content: `[tlon-test:${controlKey}] Do not follow this unparticipated thread.`,
      });
      await expectNoBotThreadReply(
        actors.owner,
        fixture.channelId,
        firstRoot.id,
        actors.owner.ship,
        actors.bot.ship
      );
      await expectNoModelCalls(ctx.fakeModel, controlKey);

      await expectNoTopLevelBotChannelReplies(
        actors.owner,
        fixture.channelId,
        actors.bot.ship,
        [firstReply, followReply],
        topLevelBaseline
      );
      const thread = await actors.owner.state.postWithReplies({
        channelId: fixture.channelId,
        rootId: secondRoot.id,
        rootAuthor: actors.owner.ship,
      });
      const firstSettledReplies = thread.replies.filter(
        (reply) =>
          reply.author === normalizeShip(actors.bot.ship) &&
          reply.text.includes(firstReply)
      );
      expect(firstSettledReplies).toHaveLength(1);
      expect(firstSettledReplies[0]?.parentId).toBe(secondRoot.id);
      const followSettledReplies = thread.replies.filter(
        (reply) =>
          reply.author === normalizeShip(actors.bot.ship) &&
          reply.text.includes(followReply)
      );
      expect(followSettledReplies).toHaveLength(1);
      expect(followSettledReplies[0]?.parentId).toBe(secondRoot.id);
    }
  ),

  testScenario('dm-thread-anchoring', {}, async ({ ctx, driver, actors }) => {
    const firstKey = scenarioKey('dm-thread-root');
    const firstReply = `DM thread root reply ${firstKey}`;
    const firstScript = driver.model.replyText(firstReply);
    const firstTag = await registerModelScript(
      ctx.fakeModel,
      firstKey,
      firstScript
    );
    const prompt = await actors.owner.prompt(
      `${firstTag} Write the scripted DM root reply.`
    );
    expectPromptSuccess(prompt, firstReply);
    const botReply = await waitForDmBotReply(
      actors.owner,
      actors.bot.ship,
      firstReply
    );
    if (!botReply.id || !botReply.authorId) {
      throw new Error(
        'Expected the DM root reply to include an id and author.'
      );
    }
    await expectModelExpectations(ctx.fakeModel, firstKey, firstScript);

    const followKey = scenarioKey('dm-thread-follow');
    const followReply = `DM thread follow reply ${followKey}`;
    const followScript = driver.model.replyText(followReply);
    const followTag = await registerModelScript(
      ctx.fakeModel,
      followKey,
      followScript
    );
    await actors.owner.replyToPost({
      channelId: actors.bot.ship,
      parentId: botReply.id,
      parentAuthor: botReply.authorId,
      content: `${followTag} Follow this DM thread without a mention.`,
    });
    await waitForModelCalls(ctx.fakeModel, followKey);
    const threadReplies = await waitForThreadReplies(
      actors.owner,
      actors.bot.ship,
      botReply.id,
      botReply.authorId,
      actors.bot.ship,
      followReply
    );
    expect(threadReplies).toHaveLength(1);
    expect(threadReplies[0]?.parentId).toBe(botReply.id);
    await expectModelExpectations(ctx.fakeModel, followKey, followScript);
    await expectNoMainDmBotReply(actors.owner, actors.bot.ship, followReply);
    const settledThread = await actors.owner.state.postWithReplies({
      channelId: actors.bot.ship,
      rootId: botReply.id,
      rootAuthor: botReply.authorId,
    });
    const settledReplies = settledThread.replies.filter(
      (reply) =>
        reply.author === normalizeShip(actors.bot.ship) &&
        reply.text.includes(followReply)
    );
    expect(settledReplies).toHaveLength(1);
    expect(settledReplies[0]?.parentId).toBe(botReply.id);
  }),

  // TLON-6150 (https://linear.app/tlon/issue/TLON-6150) tracks the model-driven,
  // cron-enabled capability partition intentionally excluded from this scenario.
  testScenario(
    'hermes-cron-delivery-targets-home-conversation',
    { drivers: ['hermes'] },
    async ({ ctx, driver, actors }) => {
      const fixture = await createOwnerHostedChannelFixture(actors);
      await allowDmFrom(actors, actors.thirdParty.ship);
      const routeKey = scenarioKey('cron-route');
      const routeReply = `Third-party route seed ${routeKey}`;
      const routeScript = driver.model.replyText(routeReply);
      const routeTag = await registerModelScript(
        ctx.fakeModel,
        routeKey,
        routeScript
      );
      const routeResult = await actors.thirdParty.prompt(
        `${routeTag} Establish the competing DM route.`
      );
      expectPromptSuccess(routeResult, routeReply);
      await expectModelExpectations(ctx.fakeModel, routeKey, routeScript);

      const isBenign = benignModelCallPredicate(driver);
      const modelBaseline = await modelCallCount(ctx.fakeModel, isBenign);
      const ownerBaseline = await conversationBaseline(
        actors.owner,
        actors.bot.ship
      );
      const thirdPartyBaseline = await conversationBaseline(
        actors.thirdParty,
        actors.bot.ship
      );
      const channelBaseline = await conversationBaseline(
        actors.owner,
        fixture.channelId
      );
      const marker = `Hermes cron marker ${scenarioKey('cron-marker')}`;
      const scriptName = `${scenarioKey('cron-script')}.sh`;

      await writeHermesCronMarkerScript(ctx, scriptName, marker);
      actors.bot.teardown(
        async () => {
          await removeHermesCronMarkerScript(ctx, scriptName);
        },
        { label: `remove cron marker script ${scriptName}` }
      );

      const jobId = await createHermesCronJob(ctx, scriptName);
      actors.bot.teardown(
        async () => {
          await removeHermesCronJobAndOutput(ctx, jobId);
        },
        { label: `remove cron job and output ${jobId}` }
      );

      await runHermesCronJob(ctx, jobId);
      await waitForConversationTextAfterBaseline(
        actors.owner,
        actors.bot.ship,
        marker,
        ownerBaseline
      );
      await expectNoConversationTextAfterBaseline(
        actors.thirdParty,
        actors.bot.ship,
        marker,
        thirdPartyBaseline
      );
      await expectNoConversationTextAfterBaseline(
        actors.owner,
        fixture.channelId,
        marker,
        channelBaseline
      );
      await expectNoNewModelCallsAfterSettle(
        ctx.fakeModel,
        isBenign,
        modelBaseline
      );
    }
  ),

  testScenario(
    'restart-no-double-reply',
    {
      orderDependent: true,
      skipReason:
        'TLON-6098: reconnect does not replay messages received while the bot is down.',
      timeoutMs: 360_000,
    },
    async ({ ctx, driver, actors }) => {
      const firstKey = scenarioKey('restart-before');
      const firstReply = `Restart first reply ${firstKey}`;
      const firstScript = driver.model.replyText(firstReply);
      const firstTag = await registerModelScript(
        ctx.fakeModel,
        firstKey,
        firstScript
      );
      const firstResult = await actors.owner.prompt(
        `${firstTag} Reply before the restart.`
      );
      expectPromptSuccess(firstResult, firstReply);
      await expectModelExpectations(ctx.fakeModel, firstKey, firstScript);

      await stopComposeService(ctx, ctx.services.bot);
      let serviceStarted = false;
      actors.bot.teardown(
        async () => {
          if (!serviceStarted) {
            await startComposeService(ctx, ctx.services.bot);
          }
        },
        { label: `restore stopped service ${ctx.services.bot}` }
      );
      const secondKey = scenarioKey('restart-boundary');
      const secondReply = `Restart boundary reply ${secondKey}`;
      const secondScript = driver.model.replyText(secondReply);
      const secondTag = await registerModelScript(
        ctx.fakeModel,
        secondKey,
        secondScript
      );
      await actors.owner.sendDm(
        `${secondTag} This message arrives while the bot is stopped.`
      );
      await startComposeService(ctx, ctx.services.bot);
      serviceStarted = true;
      await waitForModelCalls(ctx.fakeModel, secondKey);
      await waitForDmBotReply(actors.owner, actors.bot.ship, secondReply);

      await expectModelExpectations(ctx.fakeModel, firstKey, firstScript);
      await expectModelExpectations(ctx.fakeModel, secondKey, secondScript);
      await expectNoNewModelCallsAfterSettle(
        ctx.fakeModel,
        benignModelCallPredicate(driver),
        await modelCallCount(ctx.fakeModel, benignModelCallPredicate(driver))
      );
      expect(
        await matchingDmBotReplies(actors.owner, actors.bot.ship, firstReply)
      ).toHaveLength(1);
      expect(
        await matchingDmBotReplies(actors.owner, actors.bot.ship, secondReply)
      ).toHaveLength(1);
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
      const primaryCalls = primaryModelCalls(calls);
      return primaryCalls.length >= minCalls ? primaryCalls : undefined;
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
  return primaryModelCalls(await fakeModel.received()).filter(
    (call) => !isBenign(call)
  ).length;
}

async function expectNoNewModelCallsAfterSettle(
  fakeModel: FakeModelClient,
  isBenign: BenignModelCallPredicate,
  baselineCount: number,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  await sleep(settleMs);
  const calls = primaryModelCalls(await fakeModel.received()).filter(
    (call) => !isBenign(call)
  );
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

async function waitForThreadReplies(
  actor: ScenarioActor,
  channelId: string,
  rootId: string,
  rootAuthor: string,
  botShip: string,
  expectedText: string
): Promise<
  Array<{ id: string; author: string; text: string; parentId?: string }>
> {
  return waitFor(
    async () => {
      const post = await actor.state.postWithReplies({
        channelId,
        rootId,
        rootAuthor,
      });
      const replies = post.replies.filter(
        (reply) =>
          reply.author === normalizeShip(botShip) &&
          reply.text.includes(expectedText)
      );
      return replies.length > 0 ? replies : undefined;
    },
    {
      timeoutMs: BOT_REPLY_WAIT_MS,
      intervalMs: 500,
      description: `thread reply containing ${JSON.stringify(expectedText)}`,
    }
  );
}

async function expectNoTopLevelBotChannelReplies(
  actor: ScenarioActor,
  channelId: string,
  botShip: string,
  expectedTexts: readonly string[],
  baseline: ChannelBaseline,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < settleMs) {
    const unexpected = channelPostsByBot(
      await actor.state.channelPosts(channelId, 40),
      botShip
    ).find(
      (post) =>
        !post.parentId &&
        postAfterBaseline(post, baseline) &&
        expectedTexts.some((text) => post.text.includes(text))
    );
    if (unexpected) {
      throw new Error(
        `Unexpected top-level channel reply from ${botShip}: ${unexpected.text.slice(0, 200)}`
      );
    }
    await sleep(500);
  }
}

async function expectNoBotThreadReply(
  actor: ScenarioActor,
  channelId: string,
  rootId: string,
  rootAuthor: string,
  botShip: string,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < settleMs) {
    const post = await actor.state.postWithReplies({
      channelId,
      rootId,
      rootAuthor,
    });
    const unexpected = post.replies.find(
      (reply) => reply.author === normalizeShip(botShip)
    );
    if (unexpected) {
      throw new Error(
        `Unexpected thread reply from ${botShip}: ${unexpected.text.slice(0, 200)}`
      );
    }
    await sleep(500);
  }
}

async function waitForDmBotReply(
  actor: ScenarioActor,
  botShip: string,
  expectedText: string
): Promise<ChannelPost> {
  return waitFor(
    async () => {
      const replies = await matchingDmBotReplies(actor, botShip, expectedText);
      return replies[0];
    },
    {
      timeoutMs: BOT_REPLY_WAIT_MS,
      intervalMs: 500,
      description: `DM reply containing ${JSON.stringify(expectedText)}`,
    }
  );
}

async function matchingDmBotReplies(
  actor: ScenarioActor,
  botShip: string,
  expectedText: string
): Promise<ChannelPost[]> {
  return channelPostsByBot(
    await actor.state.channelPosts(botShip, 40),
    botShip
  ).filter((post) => post.text.includes(expectedText));
}

async function expectNoMainDmBotReply(
  actor: ScenarioActor,
  botShip: string,
  expectedText: string,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < settleMs) {
    const posts = await matchingDmBotReplies(actor, botShip, expectedText);
    const mainReply = posts.find((post) => !post.parentId);
    if (mainReply) {
      throw new Error(
        `Unexpected main-DM reply from ${botShip}: ${mainReply.text.slice(0, 200)}`
      );
    }
    await sleep(500);
  }
}

interface ConversationBaseline {
  sequence: number;
  sentAt: number;
}

async function conversationBaseline(
  actor: ScenarioActor,
  channelId: string
): Promise<ConversationBaseline> {
  const posts = await actor.state.channelPosts(channelId, 40);
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

async function waitForConversationTextAfterBaseline(
  actor: ScenarioActor,
  channelId: string,
  expectedText: string,
  baseline: ConversationBaseline
): Promise<ChannelPost> {
  return waitFor(
    async () => {
      const posts = await actor.state.channelPosts(channelId, 40);
      return posts.find(
        (post) =>
          post.text.includes(expectedText) && postAfterBaseline(post, baseline)
      );
    },
    {
      timeoutMs: BOT_REPLY_WAIT_MS,
      intervalMs: 500,
      description: `new conversation post containing ${JSON.stringify(expectedText)}`,
    }
  );
}

async function expectNoConversationTextAfterBaseline(
  actor: ScenarioActor,
  channelId: string,
  expectedText: string,
  baseline: ConversationBaseline,
  settleMs = NEGATIVE_SETTLE_MS
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < settleMs) {
    const posts = await actor.state.channelPosts(channelId, 40);
    const unexpected = posts.find(
      (post) =>
        post.text.includes(expectedText) && postAfterBaseline(post, baseline)
    );
    if (unexpected) {
      throw new Error(
        `Unexpected conversation post containing ${JSON.stringify(expectedText)}.`
      );
    }
    await sleep(500);
  }
}

async function writeHermesCronMarkerScript(
  ctx: RuntimeContext,
  scriptName: string,
  marker: string
): Promise<void> {
  const result = await execInComposeService(ctx, ctx.services.bot, [
    'python3',
    '-c',
    String.raw`
import sys
from pathlib import Path

path = Path('/workspace/hermes-home/scripts') / sys.argv[1]
path.parent.mkdir(parents=True, exist_ok=True)
path.write_text('#!/bin/sh\nprintf "%s\\n" ' + repr(sys.argv[2]) + '\n', encoding='utf-8')
path.chmod(0o755)
`,
    scriptName,
    marker,
  ]);
  assertExecOk(result, `write Hermes cron marker script ${scriptName}`);
}

async function createHermesCronJob(
  ctx: RuntimeContext,
  scriptName: string
): Promise<string> {
  const result = await execInComposeService(ctx, ctx.services.bot, [
    'python3',
    '-c',
    String.raw`
import sys
from cron.jobs import create_job

job = create_job(None, '1h', script=sys.argv[1], deliver='tlon', no_agent=True)
print(job['id'])
`,
    scriptName,
  ]);
  assertExecOk(result, 'create Hermes no-agent cron job');
  const jobId = result.stdout
    .split(/\s+/)
    .find((value) => /^[a-f0-9]{12}$/.test(value));
  if (!jobId) {
    throw new Error(
      `Could not read a Hermes cron job id from: ${JSON.stringify(result.stdout)}`
    );
  }
  return jobId;
}

async function runHermesCronJob(
  ctx: RuntimeContext,
  jobId: string
): Promise<void> {
  const result = await execInComposeService(
    ctx,
    ctx.services.bot,
    [
      'python3',
      '-c',
      String.raw`
import sys
from cron.jobs import get_job
from cron.scheduler import run_one_job

job = get_job(sys.argv[1])
if job is None:
    raise RuntimeError(f'cron job {sys.argv[1]} was not found')
if not run_one_job(job, adapters=None, loop=None):
    raise RuntimeError(f'cron job {sys.argv[1]} was not processed')
`,
      jobId,
    ],
    { timeoutMs: 120_000 }
  );
  assertExecOk(result, `run Hermes cron job ${jobId}`);
}

async function removeHermesCronMarkerScript(
  ctx: RuntimeContext,
  scriptName: string
): Promise<void> {
  const result = await execInComposeService(ctx, ctx.services.bot, [
    'python3',
    '-c',
    String.raw`
import sys
from pathlib import Path

(Path('/workspace/hermes-home/scripts') / sys.argv[1]).unlink(missing_ok=True)
`,
    scriptName,
  ]);
  assertExecOk(result, `remove Hermes cron marker script ${scriptName}`);
}

async function removeHermesCronJobAndOutput(
  ctx: RuntimeContext,
  jobId: string
): Promise<void> {
  const result = await execInComposeService(ctx, ctx.services.bot, [
    'python3',
    '-c',
    String.raw`
import shutil
import sys
from pathlib import Path
from cron.jobs import remove_job

remove_job(sys.argv[1])
shutil.rmtree(Path('/workspace/hermes-home/cron/output') / sys.argv[1], ignore_errors=True)
`,
    jobId,
  ]);
  assertExecOk(result, `remove Hermes cron job and output ${jobId}`);
}

function assertExecOk(
  result: { stdout: string; stderr: string; exitCode: number },
  action: string
): void {
  if (result.exitCode !== 0) {
    throw new Error(
      `${action} failed with exit ${result.exitCode}: ` +
        `${(result.stderr || result.stdout).trim()}`
    );
  }
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
