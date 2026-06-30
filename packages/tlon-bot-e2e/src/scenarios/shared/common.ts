import { sleep } from '../../runtime/waiters.js';
import type { PromptResult } from '../../tlon/index.js';
import { testScenario, type SharedScenario } from './dsl.js';
import { allowDmFrom, withSettingsEntry } from './isolation.js';
import {
  expectModelExpectations,
  expectNoModelCalls,
  registerModelScript,
} from './model.js';

export const commonScenarios: readonly SharedScenario[] = [
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
