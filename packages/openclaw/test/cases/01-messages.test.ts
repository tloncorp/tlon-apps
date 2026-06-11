import type { Story } from '@tloncorp/api';
import { getTextContent } from '@tloncorp/api';

/**
 * Messages — plugin's outbound `message` tool + inbound channel-engagement
 * decision (src/monitor/utils.ts shouldEngageInGroup, isBotMentioned).
 *
 * Covers what the plugin actually owns:
 *   - sending DMs / channel posts via the message tool
 *   - reply / react actions via the ChannelMessageActionAdapter
 *   - the decision to engage on a channel message (mention / thread / skip)
 *
 * Skill-owned operations (read history, list channels, etc.) live in the
 * skill's own test suite and are NOT covered here.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  type TestFixtures,
  getFixtures,
  requireFixtureGroup,
  waitFor,
} from '../lib/index.js';
import { fakeModel } from '../support/fake-model/client.js';

describe('messages', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await getFixtures();
  });

  beforeEach(async () => {
    await fakeModel.reset();
  });

  // ── helpers ────────────────────────────────────────────────────────────

  function story(text: string): Story {
    return [{ inline: [text] }];
  }

  function storyWithMention(ship: string, text: string): Story {
    const norm = ship.startsWith('~') ? ship : `~${ship}`;
    return [{ inline: [{ ship: norm }, ` ${text}`] }];
  }

  type PostLike = {
    id?: string;
    authorId?: string;
    sentAt?: number;
    sequenceNum?: number | null;
    textContent?: string | null;
    content?: unknown;
    /**
     * Client-shaped post reactions (after @tloncorp/api's toReactionsData).
     * Each entry: { contactId, postId, value }. NOT the raw seal.reacts map.
     */
    reactions?: Array<{ contactId?: string; value?: string }>;
  };

  function botReaction(
    post: PostLike | undefined,
    botShip: string
  ): string | undefined {
    const match = (post?.reactions ?? []).find((r) => r.contactId === botShip);
    return match?.value;
  }

  function postText(p: PostLike): string {
    return (p.textContent ?? getTextContent(p.content) ?? '').trim();
  }

  async function findChannelPost(
    nest: string,
    authorId: string,
    matchText: string,
    timeoutMs = 30_000
  ): Promise<{ id: string; text: string }> {
    return waitFor(async () => {
      const posts = await fixtures.botState.channelPosts(nest, 30);
      for (const post of posts ?? []) {
        const p = post as PostLike;
        if (p.authorId !== authorId) {
          continue;
        }
        const text = postText(p);
        if (!text.includes(matchText)) {
          continue;
        }
        return { id: String(p.id), text };
      }
      return undefined;
    }, timeoutMs);
  }

  async function getBotNickname(): Promise<string> {
    const profile = await fixtures.botState.scry<Record<string, unknown>>(
      'contacts',
      '/v1/self'
    );
    const raw = (profile ?? {}) as {
      nickname?: string | { value?: string | null } | null;
      nickName?: string | { value?: string | null } | null;
    };
    const fromField =
      typeof raw.nickname === 'string'
        ? raw.nickname
        : (raw.nickname as { value?: string | null } | null | undefined)?.value;
    const fromAlt =
      typeof raw.nickName === 'string'
        ? raw.nickName
        : (raw.nickName as { value?: string | null } | null | undefined)?.value;
    return fromField ?? fromAlt ?? '';
  }

  // ── DMs ────────────────────────────────────────────────────────────────

  describe('DMs', () => {
    test('posts a message into a bot-owned channel', async () => {
      requireFixtureGroup(fixtures);
      const token = `it-post-${Date.now().toString(36)}`;

      await fakeModel.script('post-channel-basic', [
        {
          kind: 'tool_call',
          name: 'message',
          args: {
            action: 'send',
            target: fixtures.group.chatChannel,
            message: token,
          },
        },
        { kind: 'text', content: 'Done' },
      ]);

      const response = await fixtures.client.prompt(
        `[tlon-test:post-channel-basic] Post a test message into ${fixtures.group.chatChannel}.`
      );
      if (!response.success) {
        throw new Error(response.error ?? 'Prompt failed');
      }

      const created = await waitFor(async () => {
        const posts = await fixtures.botState.channelPosts(
          fixtures.group!.chatChannel,
          30
        );
        const found = (posts ?? []).some((post) => {
          const p = post as PostLike;
          return (
            p.authorId === fixtures.botShip &&
            postText(p).toLowerCase().includes(token.toLowerCase())
          );
        });
        return found ? true : undefined;
      }, 30_000);
      expect(created).toBe(true);
    });

    test('processes a DM thread reply', async () => {
      // Owner sends a parent DM, then replies to it. The plugin should
      // hand the reply to the agent loop — verify via _received.
      const parentToken = `it-dm-parent-${Date.now().toString(36)}`;
      await fixtures.userState.sendPost({
        channelId: fixtures.botShip,
        content: story(`parent ${parentToken}`),
      });

      // Poll for the parent post to land on the BOT'S view of the DM channel.
      // The previous test in this file shares the same DM session lane and the
      // bot's SSE-driven processing can lag the user's view by a few seconds;
      // waiting on the user view raced ahead of the bot, so the reply arrived
      // before the bot had ingested the parent.
      const parent = await waitFor(async () => {
        const posts = await fixtures.botState.channelPosts(
          fixtures.userShip,
          10
        );
        const found = (posts ?? []).find((p) => {
          const pp = p as PostLike;
          return (
            pp.authorId === fixtures.userShip &&
            postText(pp).includes(parentToken)
          );
        }) as PostLike | undefined;
        return found?.id ? found : undefined;
      }, 30_000);

      const key = 'dm-thread-reply';
      await fakeModel.script(key, [
        { kind: 'text', content: 'Got your thread reply' },
      ]);

      await fixtures.userState.sendReply({
        channelId: fixtures.botShip,
        parentId: String(parent.id),
        parentAuthor: fixtures.userShip,
        content: story(`[tlon-test:${key}] reply body`),
      });

      const calls = await waitFor(async () => {
        const c = await fakeModel.received(key);
        return c.length > 0 ? c : undefined;
      }, 60_000);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  // ── channel engagement ────────────────────────────────────────────────

  describe('channel engagement', () => {
    test('engages on @ship mention', async () => {
      requireFixtureGroup(fixtures);
      const key = 'engage-ship-mention';
      await fakeModel.script(key, [{ kind: 'text', content: 'Acked mention' }]);

      await fixtures.userState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: storyWithMention(
          fixtures.botShip,
          `[tlon-test:${key}] hello bot`
        ),
      });

      const calls = await waitFor(async () => {
        const c = await fakeModel.received(key);
        return c.length > 0 ? c : undefined;
      }, 30_000);
      expect(calls.length).toBeGreaterThan(0);
    });

    test('engages on nickname mention', async () => {
      requireFixtureGroup(fixtures);
      const nickname = await getBotNickname();
      // Bot nickname is set by fixtures setup; if empty, fixture is broken.
      expect(nickname.length).toBeGreaterThan(0);

      const key = 'engage-nickname-mention';
      await fakeModel.script(key, [
        { kind: 'text', content: 'Acked nickname' },
      ]);

      await fixtures.userState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: story(`${nickname} [tlon-test:${key}] hello`),
      });

      const calls = await waitFor(async () => {
        const c = await fakeModel.received(key);
        return c.length > 0 ? c : undefined;
      }, 30_000);
      expect(calls.length).toBeGreaterThan(0);
    });

    // Negative case "plain owner post does NOT engage" depends on
    // owner-listen state. Lives in 02-owner-listen.test.ts where we can
    // toggle the setting first.

    test("engages on reply to bot's own channel post (thread participation)", async () => {
      requireFixtureGroup(fixtures);

      // Seed: have the bot post a parent message in the channel directly,
      // bypassing the agent loop. The test exercises the engagement decision
      // on the *reply*, not the parent.
      const parentToken = `it-bot-parent-${Date.now().toString(36)}`;
      await fixtures.botState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: story(`parent from bot ${parentToken}`),
      });
      const parent = await findChannelPost(
        fixtures.group.chatChannel,
        fixtures.botShip,
        parentToken,
        15_000
      );

      const key = 'engage-thread-reply';
      await fakeModel.script(key, [
        { kind: 'text', content: 'Acked thread reply' },
      ]);

      // Reply to the bot's parent — no mention text, but thread participation
      // should engage per shouldEngageInGroup.
      await fixtures.userState.sendReply({
        channelId: fixtures.group.chatChannel,
        parentId: parent.id,
        parentAuthor: fixtures.botShip,
        content: story(`[tlon-test:${key}] thread reply text`),
      });

      const calls = await waitFor(async () => {
        const c = await fakeModel.received(key);
        return c.length > 0 ? c : undefined;
      }, 30_000);
      expect(calls.length).toBeGreaterThan(0);
    });

    // Negative case "reply-to-non-bot-post does NOT engage" also depends on
    // owner-listen state — moves to 02-owner-listen.test.ts.
  });

  // ── reactions ─────────────────────────────────────────────────────────

  describe('reactions', () => {
    test('adds then removes a reaction via the message tool', async () => {
      requireFixtureGroup(fixtures);

      const target = fixtures.group.chatChannel;
      const parentToken = `it-react-roundtrip-${Date.now().toString(36)}`;
      await fixtures.userState.sendPost({
        channelId: target,
        content: story(`target ${parentToken}`),
      });
      const parent = await findChannelPost(
        target,
        fixtures.userShip,
        parentToken,
        15_000
      );

      // First DM: scripted add. NOTE the trailing pad text step: openclaw's
      // agent loop makes ONE extra model call after the final text on tool
      // flows. Without the pad, that 3rd call fails 400 → run is flagged
      // isError=true and the reaction's tool dispatch doesn't survive.
      const emoji = '🎉';
      const addKey = 'react-add-roundtrip';
      await fakeModel.script(addKey, [
        {
          kind: 'tool_call',
          name: 'message',
          args: {
            action: 'react',
            target,
            messageId: parent.id,
            emoji,
          },
        },
        { kind: 'text', content: 'Reacted.' },
        { kind: 'text', content: 'Reacted.' },
      ]);
      const addResp = await fixtures.client.prompt(
        `[tlon-test:${addKey}] React with ${emoji} to ${parent.id} in ${target}.`
      );
      if (!addResp.success) {
        throw new Error(addResp.error ?? 'add prompt failed');
      }

      await waitFor(async () => {
        const posts = await fixtures.botState.channelPosts(target, 30);
        const updated = (posts ?? []).find(
          (p) => String((p as PostLike).id) === parent.id
        ) as PostLike | undefined;
        const value = botReaction(updated, fixtures.botShip);
        return typeof value === 'string' && value.includes(emoji)
          ? true
          : undefined;
      }, 30_000);

      // Second DM: scripted remove.
      const removeKey = 'react-remove-roundtrip';
      await fakeModel.script(removeKey, [
        {
          kind: 'tool_call',
          name: 'message',
          args: {
            action: 'react',
            target,
            messageId: parent.id,
            emoji,
            remove: true,
          },
        },
        { kind: 'text', content: 'Reaction removed.' },
        { kind: 'text', content: 'Reaction removed.' },
      ]);
      const rmResp = await fixtures.client.prompt(
        `[tlon-test:${removeKey}] Remove your ${emoji} reaction from ${parent.id} in ${target}.`
      );
      if (!rmResp.success) {
        throw new Error(rmResp.error ?? 'remove prompt failed');
      }

      const removed = await waitFor(async () => {
        const posts = await fixtures.botState.channelPosts(target, 30);
        const updated = (posts ?? []).find(
          (p) => String((p as PostLike).id) === parent.id
        ) as PostLike | undefined;
        return botReaction(updated, fixtures.botShip) == null
          ? true
          : undefined;
      }, 30_000);
      expect(removed).toBe(true);
    });
  });
});
