/**
 * Re-engagement nudge tests.
 *
 * Covers the plugin-driven nudge scheduler end-to-end:
 *   1. sends a stage-1 nudge when the owner has been idle > 7 days
 *   2. owner reply clears `lastNudgeStage` and produces no duplicate
 *      nudge in the subsequent tick window
 *
 * Requires the test harness to shorten the nudge tick interval so the
 * scheduler actually fires within the test window.
 *
 * @tlon-e2e openclaw: openclaw.heartbeat.idle_owner_nudge
 */
import { type PostContent, getTextContent } from '@tloncorp/api';
import { beforeAll, describe, expect, test } from 'vitest';

import {
  type StateClient,
  createStateClient,
  getTestConfig,
  waitFor,
} from '../lib/index.js';
import {
  getLatestSequenceForAuthor,
  getPostSequence,
} from '../lib/post-baseline.js';

const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;

/** Stage 1 template snippet (first line) */
const STAGE_1_MARKER = 'Quick ideas for your week';

type ParsedPost = {
  authorId?: string;
  sentAt: number;
  sequenceNum: number;
  text: string;
};

async function readBotPostsSince(
  ownerState: StateClient,
  botShip: string,
  sinceSequence: number
): Promise<ParsedPost[]> {
  const posts = await ownerState.channelPosts(botShip, 30);
  const allParsed = (posts ?? []).map((post) => {
    const p = post as {
      authorId?: string;
      sentAt?: number;
      sequenceNum?: number | null;
      textContent?: string | null;
      content?: PostContent;
    };
    const text =
      p.textContent ?? (p.content ? getTextContent(p.content) : null);
    return {
      authorId: p.authorId,
      sentAt: p.sentAt ?? 0,
      sequenceNum: getPostSequence(p),
      text: (text ?? '').trim(),
    };
  });
  return allParsed
    .filter((p) => p.authorId === botShip)
    .filter((p) => p.sequenceNum > sinceSequence);
}

describe('re-engagement nudges', () => {
  let botState: StateClient;
  let ownerState: StateClient;
  let botShip: string;

  beforeAll(async () => {
    const config = getTestConfig();
    botState = createStateClient(config.bot);
    // Owner is the test user in ephemeral test env (~ten)
    ownerState = createStateClient(config.testUser);
    botShip = config.bot.shipName.startsWith('~')
      ? config.bot.shipName
      : `~${config.bot.shipName}`;
  });

  async function seedOwnerIdle(daysMs: number): Promise<void> {
    const offsetMs = Date.now() - daysMs;
    const offsetDate = new Date(offsetMs).toISOString().split('T')[0];
    await Promise.all([
      botState.poke({
        app: 'settings',
        mark: 'settings-event',
        json: {
          'put-entry': {
            desk: 'moltbot',
            'bucket-key': 'tlon',
            'entry-key': 'lastOwnerMessageAt',
            value: offsetMs,
          },
        },
      }),
      botState.poke({
        app: 'settings',
        mark: 'settings-event',
        json: {
          'put-entry': {
            desk: 'moltbot',
            'bucket-key': 'tlon',
            'entry-key': 'lastOwnerMessageDate',
            value: offsetDate,
          },
        },
      }),
      // Clear any previous nudge stage so the scheduler doesn't skip.
      botState.poke({
        app: 'settings',
        mark: 'settings-event',
        json: {
          'del-entry': {
            desk: 'moltbot',
            'bucket-key': 'tlon',
            'entry-key': 'lastNudgeStage',
          },
        },
      }),
    ]);
    console.log(
      `Seeded lastOwnerMessageDate=${offsetDate} (${Math.round(daysMs / (24 * 60 * 60 * 1000))} days ago)`
    );
  }

  async function readLastNudgeStage(): Promise<number | null> {
    const raw = await botState.scry<{
      all?: { moltbot?: { tlon?: { lastNudgeStage?: number | string } } };
    }>('settings', '/all');
    const value = raw?.all?.moltbot?.tlon?.lastNudgeStage;
    if (typeof value === 'number') {
      return value;
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
      return Number(value);
    }
    return null;
  }

  test('sends stage 1 nudge when owner idle > 7 days, and owner reply prevents duplicates', async () => {
    const baselineSequence = await getLatestSequenceForAuthor(
      ownerState,
      botShip,
      botShip,
      30
    );

    await seedOwnerIdle(EIGHT_DAYS_MS);
    console.log(`Waiting for scheduler tick to send stage 1 nudge...`);

    // Phase 1: wait for stage-1 nudge to land.
    let pollCount = 0;
    const nudgePost = await waitFor(
      async () => {
        pollCount++;
        const newBotPosts = await readBotPostsSince(
          ownerState,
          botShip,
          baselineSequence
        );
        if (pollCount % 6 === 1) {
          console.log(
            `[poll ${pollCount}] newBot=${newBotPosts.length} baseline=${baselineSequence}`
          );
        }
        const match = newBotPosts.filter((p) =>
          p.text.includes(STAGE_1_MARKER)
        );
        return match.length > 0 ? match[0] : null;
      },
      // Tick interval is 5s in the test env; one tick should fire within
      // 5-10s and produce the nudge. 30s gives generous headroom.
      30_000,
      1_000
    );

    expect(nudgePost).not.toBeNull();
    console.log(`Got stage-1 nudge: ${nudgePost!.text.slice(0, 80)}...`);
    expect(nudgePost!.text).toContain(STAGE_1_MARKER);

    // After the nudge fires, lastNudgeStage should be 1 on the bot ship.
    const afterNudgeStage = await readLastNudgeStage();
    console.log(`lastNudgeStage after nudge: ${afterNudgeStage}`);
    expect(afterNudgeStage).toBe(1);

    // Phase 2: owner replies. The plugin's owner-reply handler should clear
    // `lastNudgeStage` so the next inactivity cycle can re-send stage 1.
    const { markdownToStory } = await import('../../src/urbit/story.js');
    const replyText = `heartbeat-reply-${Date.now()}`;
    await ownerState.sendPost({
      channelId: botShip,
      content: markdownToStory(replyText),
    });
    console.log(`Owner replied: ${replyText}`);

    // Wait for the plugin to observe the reply and drain the owner-reply
    // persistence queue (put-entries, then del-entry for lastNudgeStage).
    const clearedStage = await waitFor(
      async () => {
        const stage = await readLastNudgeStage();
        return stage == null ? true : undefined;
      },
      60_000,
      2_000
    );
    expect(clearedStage).toBe(true);
    console.log(`lastNudgeStage cleared after owner reply`);

    // Phase 3: spans ~3 scheduler tick intervals (tick is 5s in the test
    // env; window is 15s) to confirm the next tick does not send a duplicate
    // nudge. The owner is now "active" from the plugin's perspective, so the
    // scheduler's daysIdle check short-circuits before any send.
    const postNudgeSequence = nudgePost!.sequenceNum;
    const startWait = Date.now();
    const duplicateWindow = 15_000;
    while (Date.now() - startWait < duplicateWindow) {
      const newBotPosts = await readBotPostsSince(
        ownerState,
        botShip,
        postNudgeSequence
      );
      const duplicates = newBotPosts.filter((p) =>
        p.text.includes(STAGE_1_MARKER)
      );
      expect(duplicates.length).toBe(0);
      await new Promise((r) => setTimeout(r, 2_500));
    }
    console.log(
      `Confirmed no duplicate nudge across a ${duplicateWindow / 1000}s window.`
    );
  }, 120_000);
});
