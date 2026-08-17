import type { Story } from '@tloncorp/api';

/**
 * Owner commands — the owner's bare (no @-mention) registered slash commands
 * engage in any watched chat/ channel, including third-party-hosted channels
 * where owner-listen never applies (TLON-6301).
 *
 * Engagement logic lives in src/monitor/utils.ts (shouldEngageInGroup's
 * 'owner-command' branch) and is fed by src/monitor/index.ts from the
 * engagement token set in src/commands-registry.ts. This case exercises the
 * composed firehose path the pure unit tests cannot: token aggregation, the
 * chat/ nest check, engagement, CommandBody/CommandAuthorized, and core
 * dispatch of a registered handler.
 *
 * TEST ENVIRONMENT:
 *   ~zod = bot ship
 *   ~ten = test user (configured as ownerShip)
 *   ~mug = third-party ship (hosts the group here)
 *
 * The bot is not invited by its owner, so its join goes through the group
 * approval flow: ~mug's invite queues for the owner, who approves with
 * /allow. That also keeps this case honest about the real-world path — a
 * bot present in a third-party-hosted group got there through authorization.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  type TestFixtures,
  getFixtures,
  requireThirdParty,
  waitFor,
} from '../lib/index.js';
import {
  type SequencePostView,
  extractPostText,
  getLatestSequenceForAuthor,
  getPostSequence,
} from '../lib/post-baseline.js';
import { fakeModel } from '../support/fake-model/client.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function story(text: string): Story {
  return [{ inline: [text] }];
}

describe('owner commands in third-party-hosted channels', () => {
  let fixtures: TestFixtures;
  // Narrowed copies taken right after requireThirdParty: the assertion only
  // narrows `fixtures` in beforeAll's scope, not in later test callbacks.
  let thirdPartyState: NonNullable<TestFixtures['thirdPartyState']>;
  let thirdPartyShip: string;
  let chatChannel: string;

  // How long to wait after a bare command that must NOT engage before
  // asserting no bot reply landed. Same budget as 02-owner-listen's
  // negative tests.
  const NEGATIVE_SETTLE_MS = 2_000;

  async function getPendingApprovalFrom(
    requestingShip: string
  ): Promise<{ id: string } | undefined> {
    const raw = await fixtures.botState.scry<{
      all?: Record<string, Record<string, { pendingApprovals?: string }>>;
    }>('settings', '/all');
    const serialized = raw?.all?.moltbot?.tlon?.pendingApprovals;
    if (!serialized) {
      return undefined;
    }
    const approvals = JSON.parse(serialized) as Array<{
      id: string;
      requestingShip: string;
      type?: string;
    }>;
    return approvals.find(
      (approval) =>
        approval.requestingShip === requestingShip && approval.type === 'group'
    );
  }

  beforeAll(async () => {
    fixtures = await getFixtures();
    requireThirdParty(fixtures);
    thirdPartyState = fixtures.thirdPartyState;
    thirdPartyShip = fixtures.thirdPartyShip;

    // A group hosted by the third party, with the owner and the bot as the
    // only guests. The host is neither the owner nor the bot, so
    // owner-listen engagement can never apply in its channels — any bare
    // command engagement must come from the owner-command escape hatch.
    const title = `Owner Command Test ${Date.now().toString(36)}`;
    const { groupId, chatChannel: channel } = await thirdPartyState.createGroup(
      title,
      [fixtures.userShip, fixtures.botShip]
    );
    chatChannel = channel;

    // The owner accepts the invite directly; the invite may need a moment
    // to arrive before the join poke can succeed.
    await waitFor(
      async () => {
        try {
          await fixtures.userState.joinGroup(groupId);
          return true;
        } catch {
          return undefined;
        }
      },
      30_000,
      2_000,
      'owner to join the third-party group'
    );

    // The bot's invite is from ~mug (not the owner, not on the group-invite
    // allowlist), so it queues as a pending approval for the owner.
    await waitFor(
      async () => getPendingApprovalFrom(thirdPartyShip),
      30_000,
      2_000,
      'group invite approval to be queued'
    );

    const allowResponse = await fixtures.client.prompt('/allow');
    if (!allowResponse.success) {
      throw new Error(allowResponse.error ?? '/allow failed');
    }

    await waitFor(
      async () =>
        (await fixtures.botState.isMemberOfGroup(groupId)) ? true : undefined,
      60_000,
      2_000,
      'bot to join the third-party group'
    );
  }, 300_000);

  beforeEach(async () => {
    await fakeModel.reset();
  });

  test("owner's bare /pending is answered without a mention", async () => {
    // No fake-model script: /pending completes in the plugin without a model
    // turn, so a model call here would itself be a failure signal.
    const baseline = await getLatestSequenceForAuthor(
      fixtures.botState,
      chatChannel,
      fixtures.botShip
    );

    await fixtures.userState.sendPost({
      channelId: chatChannel,
      content: story('/pending'),
    });

    const reply = await waitFor(
      async () => {
        const posts = await fixtures.botState.channelPosts(chatChannel, 30);
        return (posts ?? [])
          .map((post) => post as SequencePostView)
          .find(
            (post) =>
              post.authorId === fixtures.botShip &&
              getPostSequence(post) > baseline
          );
      },
      30_000,
      1_500,
      'bot reply to bare /pending'
    );

    // The pending list (possibly empty) — the command was answered at all,
    // bare, in a channel the bot does not host.
    expect(extractPostText(reply)).toMatch(/pending/i);
  }, 60_000);

  test("a non-owner's bare command gets no reply", async () => {
    const baseline = await getLatestSequenceForAuthor(
      fixtures.botState,
      chatChannel,
      fixtures.botShip
    );

    await thirdPartyState.sendPost({
      channelId: chatChannel,
      content: story('/pending'),
    });

    await sleep(NEGATIVE_SETTLE_MS);
    const after = await getLatestSequenceForAuthor(
      fixtures.botState,
      chatChannel,
      fixtures.botShip,
      30
    );
    expect(after).toBe(baseline);
  }, 60_000);
});
