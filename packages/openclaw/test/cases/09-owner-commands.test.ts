import type { Story } from '@tloncorp/api';

/**
 * Owner commands — the owner's bare (no @-mention) registered slash commands
 * engage in any watched chat/ channel, including third-party-hosted channels
 * where owner-listen never applies (TLON-6301). They only RUN where owner
 * privilege is trusted (TLON-6959, src/owner-trust.ts): in a channel hosted
 * by the owner or the bot. In a channel hosted by anyone else, the host can
 * author posts as the owner, so the command gets a short refusal instead.
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

import { OWNER_PRIVILEGE_ELSEWHERE_TEXT } from '../../src/owner-trust.js';
import {
  type TestFixtures,
  getFixtures,
  requireFixtureGroup,
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

/** The bot's posts in a channel after a sequence baseline, oldest first. */
async function botPostsAfter(
  fixtures: TestFixtures,
  channel: string,
  baseline: number
): Promise<SequencePostView[]> {
  const posts = await fixtures.botState.channelPosts(channel, 30);
  return (posts ?? [])
    .map((post) => post as SequencePostView)
    .filter(
      (post) =>
        post.authorId === fixtures.botShip && getPostSequence(post) > baseline
    )
    .sort((a, b) => getPostSequence(a) - getPostSequence(b));
}

/** Settle time before asserting that no further bot reply landed. */
const NEGATIVE_SETTLE_MS = 2_000;

describe('owner commands in third-party-hosted channels', () => {
  let fixtures: TestFixtures;
  // Narrowed copies taken right after requireThirdParty: the assertion only
  // narrows `fixtures` in beforeAll's scope, not in later test callbacks.
  let thirdPartyState: NonNullable<TestFixtures['thirdPartyState']>;
  let thirdPartyShip: string;
  let chatChannel: string;

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

  async function getJournaledGroupChannels(): Promise<string[]> {
    // Raw scry, not botState.settings(): that reads the `groups` desk, and the
    // journal writes `moltbot`/`tlon`.
    const raw = await fixtures.botState.scry<{
      all?: Record<string, Record<string, { groupChannels?: string[] }>>;
    }>('settings', '/all');
    return raw?.all?.moltbot?.tlon?.groupChannels ?? [];
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

    // The join's %groups `create` fact journals the group's channels into the
    // shared `groupChannels` settings key (src/monitor/group-channels.ts).
    // Exercises the real mark, the fact parser, and the settings poke.
    await waitFor(
      async () =>
        (await getJournaledGroupChannels()).includes(chatChannel)
          ? true
          : undefined,
      60_000,
      2_000,
      'joined channel to be journaled to groupChannels'
    );

    // Seed the channel with an earlier post so command dispatch runs the
    // context-enriched path: processMessage prepends recent channel history
    // to messageText, and command authorization must still be computed from
    // the raw text (a fresh, empty channel would skip enrichment and mask a
    // regression there).
    await fixtures.userState.sendPost({
      channelId: chatChannel,
      content: story('earlier chatter to enrich context with'),
    });
    await waitFor(
      async () => {
        const posts = await fixtures.botState.channelPosts(chatChannel, 10);
        return (posts ?? []).length > 0 ? true : undefined;
      },
      30_000,
      1_500,
      'seed post to reach the bot ship'
    );
  }, 300_000);

  beforeEach(async () => {
    await fakeModel.reset();
  });

  test("owner's bare /pending gets the refusal and does not run", async () => {
    // No fake-model script: the refusal is posted by the plugin before any
    // model turn.
    const baseline = await getLatestSequenceForAuthor(
      fixtures.botState,
      chatChannel,
      fixtures.botShip
    );

    await fixtures.userState.sendPost({
      channelId: chatChannel,
      content: story('/pending'),
    });

    const [reply] = await waitFor(
      async () => {
        const replies = await botPostsAfter(fixtures, chatChannel, baseline);
        return replies.length > 0 ? replies : undefined;
      },
      30_000,
      1_500,
      'bot refusal to bare /pending'
    );
    expect(extractPostText(reply)).toBe(OWNER_PRIVILEGE_ELSEWHERE_TEXT);

    // The command itself never ran: no pending-list reply follows the
    // refusal.
    await sleep(NEGATIVE_SETTLE_MS);
    const replies = await botPostsAfter(fixtures, chatChannel, baseline);
    expect(replies.map(extractPostText)).toEqual([
      OWNER_PRIVILEGE_ELSEWHERE_TEXT,
    ]);
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

describe('owner commands in a bot-hosted channel', () => {
  test("owner's bare /pending is answered without a mention", async () => {
    const fixtures = await getFixtures();
    requireFixtureGroup(fixtures);
    // The fixture group is hosted by the bot, so owner privilege is trusted.
    const channel = fixtures.group.chatChannel;
    await fakeModel.reset();
    const baseline = await getLatestSequenceForAuthor(
      fixtures.botState,
      channel,
      fixtures.botShip
    );

    await fixtures.userState.sendPost({
      channelId: channel,
      content: story('/pending'),
    });

    const [reply] = await waitFor(
      async () => {
        const replies = await botPostsAfter(fixtures, channel, baseline);
        return replies.length > 0 ? replies : undefined;
      },
      30_000,
      1_500,
      'bot reply to bare /pending'
    );

    // The pending list (possibly empty): the command ran, not the refusal.
    const text = extractPostText(reply);
    expect(text).toMatch(/pending/i);
    expect(text).not.toBe(OWNER_PRIVILEGE_ELSEWHERE_TEXT);
  }, 60_000);
});
