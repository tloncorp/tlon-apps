import type { Story } from '@tloncorp/api';

/**
 * Owner-listen — plugin's toggle that decides whether the bot responds to
 * the owner's plain (non-mention) channel messages.
 *
 * Logic lives in src/monitor/utils.ts (shouldEngageInGroup) and is gated
 * by two settings persisted on the bot ship under moltbot/tlon/:
 *   - ownerListenEnabled: boolean (default true)
 *   - ownerListenDisabledChannels: string[] (per-channel mute list)
 *
 * The plugin also intercepts `/owner-listen ...` slash commands from the
 * owner and mutates those settings directly (no model call).
 *
 * The fake-model's GET /v1/_received endpoint is the key tool for the
 * negative tests here: we send a plain channel post tagged with
 * [tlon-test:KEY], wait a beat, then assert no model call landed for KEY.
 */
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  type TestFixtures,
  getContainerLogsSince,
  getFixtures,
  getGatewayRestartPreflight,
  registerEngagingTurn,
  requireFixtureGroup,
  waitFor,
} from '../lib/index.js';
import { extractPostText } from '../lib/post-baseline.js';
import { fakeModel } from '../support/fake-model/client.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function story(text: string): Story {
  return [{ inline: [text] }];
}

function storyWithMention(ship: string, text: string): Story {
  const norm = ship.startsWith('~') ? ship : `~${ship}`;
  return [{ inline: [{ ship: norm }, ` ${text}`] }];
}

describe('owner-listen', () => {
  let fixtures: TestFixtures;

  // How long to wait after sending a channel post before asserting
  // "no model call landed". Generous enough for SSE round-trip + the
  // plugin's engagement decision, short enough to not slow tests.
  const NEGATIVE_SETTLE_MS = 2_000;

  // Small headroom after the settings store confirms the value, to let
  // the plugin's SSE subscriber ingest the update into its in-memory
  // state. Local docker SSE round-trip is <100ms; 300ms is comfortable.
  const PLUGIN_INGEST_HEADROOM_MS = 300;

  beforeAll(async () => {
    fixtures = await getFixtures();
  });

  beforeEach(async () => {
    await fakeModel.reset();
    // Two pokes, one combined waitFor — much faster than two sequential
    // sleeps. Resets owner-listen to default (enabled, no mutes).
    await pokeOwnerListenEnabled(true);
    await pokeOwnerListenDisabledChannels([]);
    await waitFor(async () => {
      const state = await getOwnerListenState();
      return state.enabled === true && state.disabled.length === 0
        ? true
        : undefined;
    }, 5_000);
    await sleep(PLUGIN_INGEST_HEADROOM_MS);
  });

  async function pokeOwnerListenEnabled(enabled: boolean): Promise<void> {
    await fixtures.botState.poke({
      app: 'settings',
      mark: 'settings-event',
      json: {
        'put-entry': {
          desk: 'moltbot',
          'bucket-key': 'tlon',
          'entry-key': 'ownerListenEnabled',
          value: enabled,
        },
      },
    });
  }

  async function pokeOwnerListenDisabledChannels(
    nests: string[]
  ): Promise<void> {
    await fixtures.botState.poke({
      app: 'settings',
      mark: 'settings-event',
      json: {
        'put-entry': {
          desk: 'moltbot',
          'bucket-key': 'tlon',
          'entry-key': 'ownerListenDisabledChannels',
          value: nests,
        },
      },
    });
  }

  async function setOwnerListenEnabled(enabled: boolean): Promise<void> {
    await pokeOwnerListenEnabled(enabled);
    await waitFor(async () => {
      const state = await getOwnerListenState();
      return state.enabled === enabled ? true : undefined;
    }, 5_000);
    await sleep(PLUGIN_INGEST_HEADROOM_MS);
  }

  async function setOwnerListenDisabledChannels(
    nests: string[]
  ): Promise<void> {
    await pokeOwnerListenDisabledChannels(nests);
    await waitFor(async () => {
      const state = await getOwnerListenState();
      const same =
        state.disabled.length === nests.length &&
        state.disabled.every((n) => nests.includes(n));
      return same ? true : undefined;
    }, 5_000);
    await sleep(PLUGIN_INGEST_HEADROOM_MS);
  }

  async function getOwnerListenState(): Promise<{
    enabled: boolean | undefined;
    disabled: string[];
  }> {
    const raw = await fixtures.botState.scry<{
      all?: {
        moltbot?: {
          tlon?: {
            ownerListenEnabled?: boolean;
            ownerListenDisabledChannels?: string[];
          };
        };
      };
    }>('settings', '/all');
    const tlon = raw?.all?.moltbot?.tlon ?? {};
    return {
      enabled: tlon.ownerListenEnabled,
      disabled: Array.isArray(tlon.ownerListenDisabledChannels)
        ? tlon.ownerListenDisabledChannels
        : [],
    };
  }

  // ── DM behavior ────────────────────────────────────────────────────────

  describe('DMs', () => {
    test('owner DM is processed regardless of owner-listen state', async () => {
      // Even with global owner-listen off, owner DMs always engage.
      await setOwnerListenEnabled(false);

      const key = 'ol-dm-while-off';
      await fakeModel.script(key, [
        { kind: 'text', content: 'Heard you in DM.' },
      ]);

      await fixtures.userState.sendPost({
        channelId: fixtures.botShip,
        content: story(`[tlon-test:${key}] hello while owner-listen off`),
      });

      await sleep(NEGATIVE_SETTLE_MS);
      const calls = await fakeModel.received(key);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  // ── channel behavior (owner-hosted fixture) ───────────────────────────

  describe('channels (owner-listen enabled)', () => {
    test("owner's plain channel post engages", async () => {
      requireFixtureGroup(fixtures);
      // Default state: owner-listen on, channel not muted.
      const key = 'ol-plain-engages-when-on';
      await fakeModel.script(key, [{ kind: 'text', content: 'Heard you.' }]);

      await fixtures.userState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: story(`[tlon-test:${key}] plain owner post, no mention`),
      });

      await sleep(NEGATIVE_SETTLE_MS);
      const calls = await fakeModel.received(key);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('channels (owner-listen globally disabled)', () => {
    test("owner's plain channel post does NOT engage", async () => {
      requireFixtureGroup(fixtures);
      await setOwnerListenEnabled(false);

      const key = 'ol-plain-skipped-when-off';
      // Intentionally no script — engage would cause 400 noise.

      await fixtures.userState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: story(`[tlon-test:${key}] plain owner post, owner-listen off`),
      });

      await sleep(NEGATIVE_SETTLE_MS);
      const calls = await fakeModel.received(key);
      expect(calls.length).toBe(0);
    });

    test("owner's @mention still engages even when owner-listen is off", async () => {
      requireFixtureGroup(fixtures);
      await setOwnerListenEnabled(false);

      const key = 'ol-mention-overrides-off';
      await fakeModel.script(key, [{ kind: 'text', content: 'Mentioned.' }]);

      await fixtures.userState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: storyWithMention(
          fixtures.botShip,
          `[tlon-test:${key}] mention while owner-listen off`
        ),
      });

      await sleep(NEGATIVE_SETTLE_MS);
      const calls = await fakeModel.received(key);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('channels (per-channel mute)', () => {
    test("muted channel skips owner's plain post even when global is on", async () => {
      requireFixtureGroup(fixtures);
      // Global on (default), but THIS channel muted.
      await setOwnerListenDisabledChannels([fixtures.group.chatChannel]);

      const key = 'ol-channel-muted-plain';
      // No script — engagement would be a bug.

      await fixtures.userState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: story(`[tlon-test:${key}] plain post in muted channel`),
      });

      await sleep(NEGATIVE_SETTLE_MS);
      const calls = await fakeModel.received(key);
      expect(calls.length).toBe(0);
    });

    test('muted channel still engages on @mention', async () => {
      requireFixtureGroup(fixtures);
      await setOwnerListenDisabledChannels([fixtures.group.chatChannel]);

      const key = 'ol-channel-muted-mention';
      await fakeModel.script(key, [
        { kind: 'text', content: 'Mention beats mute.' },
      ]);

      await fixtures.userState.sendPost({
        channelId: fixtures.group.chatChannel,
        content: storyWithMention(
          fixtures.botShip,
          `[tlon-test:${key}] mention overrides per-channel mute`
        ),
      });

      await sleep(NEGATIVE_SETTLE_MS);
      const calls = await fakeModel.received(key);
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  // ── participated threads (TLON-6818) ───────────────────────────────────

  describe('participated threads', () => {
    // Owner-authored posts are located by text token; the parent is never
    // [tlon-test:]-tagged so thread history cannot misroute a later key.
    async function findOwnerPost(nest: string, token: string): Promise<string> {
      return waitFor(async () => {
        const posts = (await fixtures.botState.channelPosts(
          nest,
          30
        )) as Array<{ id?: string; authorId?: string; content?: unknown }>;
        const match = posts.find(
          (p) =>
            p.authorId === fixtures.userShip &&
            extractPostText(p).includes(token)
        );
        return match?.id ? String(match.id) : undefined;
      }, 15_000);
    }

    function requireComposeFile(): string {
      const composeFile = process.env.TEST_COMPOSE_FILE ?? '';
      if (!composeFile) {
        throw new Error('TEST_COMPOSE_FILE is required for container logs');
      }
      return composeFile;
    }

    // The plugin adds a thread to participatedThreads only after the bot's
    // reply is sent, then logs this line (once per delivery to that thread).
    // Waiting on it (rather than on the reply being visible) guarantees the
    // negative step below is not vacuous.
    function countThreadTracked(parentId: string, sinceIso: string): number {
      // The API hands back dotted @ud ids; the plugin logs them undotted.
      const marker = `[tlon] Now tracking thread for future replies: ${parentId.replace(/\./g, '')}`;
      const logs = getContainerLogsSince(requireComposeFile(), sinceIso);
      return logs.split(marker).length - 1;
    }

    async function waitForThreadTracked(
      parentId: string,
      sinceIso: string,
      moreThan: number
    ): Promise<void> {
      await waitFor(async () => {
        return countThreadTracked(parentId, sinceIso) > moreThan
          ? true
          : undefined;
      }, 60_000);
    }

    // Same idle wait as 07-blobs: an engaging turn's trailing model call can
    // still be running when its assertion returns, and resetting the fake
    // model under it (next beforeEach) recreates the 400 error path.
    async function waitForRuntimeIdle(): Promise<void> {
      const composeFile = process.env.TEST_COMPOSE_FILE ?? '';
      if (composeFile) {
        const deadline = Date.now() + 15_000;
        let preflight = getGatewayRestartPreflight(composeFile, 10_000);
        while (preflight.counts.totalActive > 0 && Date.now() < deadline) {
          await new Promise((resolve) => setTimeout(resolve, 500));
          preflight = getGatewayRestartPreflight(composeFile, 10_000);
        }
        if (preflight.counts.totalActive > 0) {
          throw new Error(
            `Runtime not idle: ${JSON.stringify(preflight.counts)} ` +
              `(${preflight.summary})`
          );
        }
      }
    }

    async function expectNoModelCall(key: string): Promise<void> {
      await sleep(NEGATIVE_SETTLE_MS);
      expect(await fakeModel.received(key)).toHaveLength(0);
    }

    async function expectModelCall(key: string): Promise<void> {
      await waitFor(async () => {
        const calls = await fakeModel.received(key);
        return calls.length > 0 ? true : undefined;
      }, 30_000);
    }

    async function runScenario(opts: {
      mode: string;
      mute: (chat: string) => Promise<void>;
      reenableCommand: string;
    }): Promise<void> {
      requireFixtureGroup(fixtures);
      const chat = fixtures.group.chatChannel;
      const run = `${opts.mode}-${Date.now().toString(36)}`;
      const sinceIso = new Date(Date.now() - 5_000).toISOString();
      const reply = (content: Story, parentId: string) =>
        fixtures.userState.sendReply({
          channelId: chat,
          parentId,
          parentAuthor: fixtures.userShip,
          content,
        });

      // 1. Mute first so the parent post does not engage.
      await opts.mute(chat);

      // 2. Plain top-level parent.
      const parentToken = `ol-thread-parent-${run}`;
      await fixtures.userState.sendPost({
        channelId: chat,
        content: story(`thread parent ${parentToken}`),
      });
      const parentId = await findOwnerPost(chat, parentToken);

      // 3. Mentioned thread reply: mention beats mute, the bot replies in the
      //    thread and joins it.
      const joinTag = await registerEngagingTurn(`ol-thread-join-${run}`);
      await reply(
        storyWithMention(fixtures.botShip, `${joinTag} join this thread`),
        parentId
      );
      await waitForThreadTracked(parentId, sinceIso, 0);

      // 4. Regression: unmentioned owner reply in the joined thread is muted.
      const threadKey = `ol-thread-muted-${run}`;
      await reply(
        story(`[tlon-test:${threadKey}] unmentioned reply`),
        parentId
      );
      await expectNoModelCall(threadKey);

      // 5. Unmentioned top-level post is muted.
      const topKey = `ol-thread-top-${run}`;
      await fixtures.userState.sendPost({
        channelId: chat,
        content: story(`[tlon-test:${topKey}] unmentioned top-level post`),
      });
      await expectNoModelCall(topKey);

      // 6. Mention escape hatch inside the thread; wait for delivery so no
      //    run is in flight during later steps. The join turn's allowed extra
      //    model call can deliver a second reply to this thread, so snapshot
      //    the tracking count once the runtime is idle and wait past it.
      await waitForRuntimeIdle();
      const trackedBefore = countThreadTracked(parentId, sinceIso);
      const mentionKey = `ol-thread-mention-${run}`;
      const mentionTag = await registerEngagingTurn(mentionKey);
      await reply(
        storyWithMention(fixtures.botShip, `${mentionTag} mentioned reply`),
        parentId
      );
      await expectModelCall(mentionKey);
      await waitForThreadTracked(parentId, sinceIso, trackedBefore);

      // 7. Command escape hatch from the muted channel.
      await fixtures.userState.sendPost({
        channelId: chat,
        content: story(opts.reenableCommand),
      });
      await waitFor(async () => {
        const state = await getOwnerListenState();
        return state.enabled === true && state.disabled.length === 0
          ? true
          : undefined;
      }, 15_000);
      await sleep(PLUGIN_INGEST_HEADROOM_MS);

      // 8. Listening restored: the unmentioned thread reply engages again.
      const afterKey = `ol-thread-after-${run}`;
      const afterTag = await registerEngagingTurn(afterKey);
      await reply(
        story(`${afterTag} unmentioned reply after re-enable`),
        parentId
      );
      await expectModelCall(afterKey);
      await waitForRuntimeIdle();
    }

    test('per-channel mute silences owner replies in a joined thread', async () => {
      await runScenario({
        mode: 'channel',
        mute: (chat) => setOwnerListenDisabledChannels([chat]),
        reenableCommand: '/owner-listen on',
      });
    }, 180_000);

    test('global owner-listen off silences owner replies in a joined thread', async () => {
      await runScenario({
        mode: 'global',
        mute: () => setOwnerListenEnabled(false),
        reenableCommand: '/owner-listen all on',
      });
    }, 180_000);
  });

  // ── slash command (handled inline by plugin, no model call) ────────────

  describe('slash command', () => {
    test('/owner-listen all off persists ownerListenEnabled=false', async () => {
      // Start with default (enabled true).
      await setOwnerListenEnabled(true);

      const response = await fixtures.client.prompt('/owner-listen all off');
      if (!response.success) {
        throw new Error(response.error ?? 'slash command failed');
      }

      // Poll the settings store for the new value (slash command writes
      // settings synchronously after the bot processes it).
      const state = await waitFor(async () => {
        const s = await getOwnerListenState();
        return s.enabled === false ? s : undefined;
      }, 5_000);
      expect(state.enabled).toBe(false);
    });

    test('/owner-listen all on persists ownerListenEnabled=true', async () => {
      await setOwnerListenEnabled(false);

      const response = await fixtures.client.prompt('/owner-listen all on');
      if (!response.success) {
        throw new Error(response.error ?? 'slash command failed');
      }

      const state = await waitFor(async () => {
        const s = await getOwnerListenState();
        return s.enabled === true ? s : undefined;
      }, 5_000);
      expect(state.enabled).toBe(true);
    });
  });
});
