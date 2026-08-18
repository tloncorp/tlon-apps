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
 * Seeding is fenced behind a closed active-hours window, the pattern the
 * shared scenario suite uses (`scenarios/shared/isolation.ts`). Without the
 * fence the 5s tick can land mid-seed: it sees the already-backdated owner,
 * sends stage 1, and only then observes the stage clear that was still in
 * flight — which re-arms the guard and lets the next tick send an identical
 * stage-1 nudge that Phase 3 reports as a duplicate.
 */
import { type PostContent, getTextContent } from '@tloncorp/api';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  type StateClient,
  createStateClient,
  getTestConfig,
  registerEngagingTurn,
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
  // Pre-seed values of the active-hours overrides (undefined = absent), so
  // cleanup restores what an operator may have set on a long-lived dev ship
  // instead of unconditionally deleting. null = seeding never started.
  let nudgeWindowSnapshot: { start: unknown; end: unknown } | null = null;

  beforeAll(async () => {
    const config = getTestConfig();
    botState = createStateClient(config.bot);
    // Owner is the test user in ephemeral test env (~ten)
    ownerState = createStateClient(config.testUser);
    botShip = config.bot.shipName.startsWith('~')
      ? config.bot.shipName
      : `~${config.bot.shipName}`;
  });

  async function putTlonSetting(
    entryKey: string,
    value: unknown
  ): Promise<void> {
    await botState.poke({
      app: 'settings',
      mark: 'settings-event',
      json: {
        'put-entry': {
          desk: 'moltbot',
          'bucket-key': 'tlon',
          'entry-key': entryKey,
          value,
        },
      },
    });
  }

  async function delTlonSetting(entryKey: string): Promise<void> {
    await botState.poke({
      app: 'settings',
      mark: 'settings-event',
      json: {
        'del-entry': {
          desk: 'moltbot',
          'bucket-key': 'tlon',
          'entry-key': entryKey,
        },
      },
    });
  }

  async function readTlonBucket(): Promise<Record<string, unknown>> {
    const raw = await botState.scry<{
      all?: { moltbot?: { tlon?: Record<string, unknown> } };
    }>('settings', '/all');
    return raw?.all?.moltbot?.tlon ?? {};
  }

  /**
   * A poke ack only means the ship stored the entry; the plugin observes it a
   * subscription hop later. Confirming each step against the bucket is what
   * makes the seed order below an order the plugin actually sees.
   */
  async function waitForTlonSettings(
    expected: Record<string, unknown>
  ): Promise<void> {
    await waitFor(
      async () => {
        const bucket = await readTlonBucket();
        // The `/all` scry renders a number as either a number or its decimal
        // string (see readLastNudgeStage), so compare stringified.
        const matched = Object.entries(expected).every(
          ([key, value]) => String(bucket[key]) === String(value)
        );
        return matched ? true : undefined;
      },
      8_000,
      500,
      `settings entries ${Object.keys(expected).join(', ')}`
    );
  }

  async function waitForTlonSettingsAbsent(keys: string[]): Promise<void> {
    await waitFor(
      async () => {
        const bucket = await readTlonBucket();
        const absent = keys.every(
          (key) => !Object.prototype.hasOwnProperty.call(bucket, key)
        );
        return absent ? true : undefined;
      },
      8_000,
      500,
      `absent settings keys ${keys.join(', ')}`
    );
  }

  function isoDate(ms: number): string {
    return new Date(ms).toISOString().split('T')[0];
  }

  /**
   * Seed the owner as idle, returning the DM baseline sequence captured inside
   * the gated region.
   *
   * Every prefix of this order is safe for a tick that fires mid-seed: the
   * fresh-activity sentinel lands first (an active owner is never nudged), the
   * window closes second (later ticks bail at the active-hours gate), and only
   * then are the stage keys cleared and the activity backdated. So the plugin
   * can never observe "stage cleared, owner idle" while the scheduler is live.
   */
  async function seedOwnerIdleGated(daysMs: number): Promise<number> {
    // Snapshot the window overrides before touching anything.
    const preSeedBucket = await readTlonBucket();
    nudgeWindowSnapshot = {
      start: preSeedBucket['nudgeActiveHoursStart'],
      end: preSeedBucket['nudgeActiveHoursEnd'],
    };

    const sentinelAt = Date.now();
    await putTlonSetting('lastOwnerMessageAt', sentinelAt);
    await putTlonSetting('lastOwnerMessageDate', isoDate(sentinelAt));
    await waitForTlonSettings({ lastOwnerMessageAt: sentinelAt });

    // Equal bounds are a zero-width, always-closed window.
    await putTlonSetting('nudgeActiveHoursStart', '00:00');
    await putTlonSetting('nudgeActiveHoursEnd', '00:00');
    await waitForTlonSettings({
      nudgeActiveHoursStart: '00:00',
      nudgeActiveHoursEnd: '00:00',
    });

    // Clear any previous nudge stage so the scheduler doesn't skip.
    await delTlonSetting('lastNudgeStage');
    await delTlonSetting('pendingNudge');
    await waitForTlonSettingsAbsent(['lastNudgeStage', 'pendingNudge']);

    // Baseline is taken inside the gate, so no bot post can predate it.
    const baseline = await getLatestSequenceForAuthor(
      ownerState,
      botShip,
      botShip,
      30
    );

    const idleAt = Date.now() - daysMs;
    const idleDate = isoDate(idleAt);
    await putTlonSetting('lastOwnerMessageAt', idleAt);
    await putTlonSetting('lastOwnerMessageDate', idleDate);

    // Reopen: start stays '00:00' ('24:00' is valid only as an end bound), so
    // the window is 00:00-24:00. Phase 1's poll absorbs the propagation lag,
    // so no confirm wait here.
    await putTlonSetting('nudgeActiveHoursEnd', '24:00');

    console.log(
      `Seeded lastOwnerMessageDate=${idleDate} (${Math.round(daysMs / (24 * 60 * 60 * 1000))} days ago)`
    );
    return baseline;
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

  afterAll(async () => {
    // Best effort: a mid-test failure must not leave the window closed (that
    // would silently disable the scheduler for later case files) or the owner
    // backdated (that would keep every later tick eligible to nudge).
    if (!botState || nudgeWindowSnapshot === null) {
      // Seeding never started, so nothing was written and there is nothing
      // to restore.
      return;
    }
    const snapshot = nudgeWindowSnapshot;
    try {
      const cleanupAt = Date.now();
      await putTlonSetting('lastOwnerMessageAt', cleanupAt);
      await putTlonSetting('lastOwnerMessageDate', isoDate(cleanupAt));
      // Force both bounds closed before deleting anything: if setup died
      // between the two writes, deleting one bound alone could open a
      // wrap-around window.
      await putTlonSetting('nudgeActiveHoursStart', '00:00');
      await putTlonSetting('nudgeActiveHoursEnd', '00:00');
      await waitForTlonSettings({
        nudgeActiveHoursStart: '00:00',
        nudgeActiveHoursEnd: '00:00',
      });
    } finally {
      // Attempt every step even when an earlier one fails: a transient nack
      // must not leave the window keys behind closed, which would gate the
      // scheduler for every later case file. Failures are collected and
      // rethrown after all steps have been tried.
      const failures: unknown[] = [];
      const attempt = async (op: () => Promise<void>) => {
        try {
          await op();
        } catch (error) {
          failures.push(error);
        }
      };
      const restoreWindowKey = (key: string, value: unknown) =>
        value === undefined ? delTlonSetting(key) : putTlonSetting(key, value);
      await attempt(() => delTlonSetting('lastNudgeStage'));
      await attempt(() => delTlonSetting('pendingNudge'));
      // Restore the window overrides to their pre-seed value or absence,
      // after the stage clears so those land behind a still-closed window.
      await attempt(() =>
        restoreWindowKey('nudgeActiveHoursStart', snapshot.start)
      );
      await attempt(() =>
        restoreWindowKey('nudgeActiveHoursEnd', snapshot.end)
      );
      await attempt(() =>
        waitForTlonSettingsAbsent(['lastNudgeStage', 'pendingNudge'])
      );
      if (failures.length > 0) {
        throw failures[0];
      }
    }
    // The activity keys are left at the fresh sentinel: the product writes
    // them on every owner DM, so present-and-fresh is their pre-test shape
    // here, and fresh activity blocks ticks whatever the window says.
  });

  test('sends stage 1 nudge when owner idle > 7 days, and owner reply prevents duplicates', async () => {
    const baselineSequence = await seedOwnerIdleGated(EIGHT_DAYS_MS);
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

    // After the nudge fires, lastNudgeStage should be 1 on the bot ship. The
    // nudge post and the lastNudgeStage settings write are separate pokes, so
    // the post can become visible before the settings write lands — poll for
    // the stage rather than reading it once (mirrors the Phase-2 poll below).
    const afterNudgeStage = await waitFor(
      async () => {
        const stage = await readLastNudgeStage();
        return stage === 1 ? stage : undefined;
      },
      30_000,
      1_000
    );
    console.log(`lastNudgeStage after nudge: ${afterNudgeStage}`);
    expect(afterNudgeStage).toBe(1);

    // Phase 2: owner replies. The plugin's owner-reply handler should clear
    // `lastNudgeStage` so the next inactivity cycle can re-send stage 1.
    const { markdownToStory } = await import('../../src/urbit/story.js');
    // Owner DMs always engage the model; tag this reply with its own key so it
    // can't inherit a stale [tlon-test:KEY] from the shared owner DM session
    // history. The assertion below is on lastNudgeStage state, not this reply.
    const replyTag = await registerEngagingTurn('heartbeat-owner-reply');
    const replyText = `${replyTag} heartbeat-reply-${Date.now()}`;
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
  }, 180_000);
});
