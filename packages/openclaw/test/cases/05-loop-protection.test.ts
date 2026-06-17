/**
 * Loop Protection Integration Tests
 *
 * Tests the bot-to-bot loop protection feature that prevents infinite
 * conversation loops between bots mentioning each other.
 *
 * LIMITATIONS:
 * Full bot-to-bot loop testing requires two OpenClaw bots in the same channel.
 * The current test environment only has one bot, so loop scenarios are skipped.
 *
 * @tlon-e2e openclaw: loop.human_dm_processed, loop.repeated_human_dms_processed, loop.non_owner_without_bot_profile_processed, dm.basic_reply
 */
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  type TestFixtures,
  ensureThirdPartyDmAccess,
  getFixtures,
  requireFixtureGroup,
} from '../lib/index.js';
import { fakeModel } from '../support/fake-model/client.js';

describe('loop protection', () => {
  let fixtures: TestFixtures;
  let hasThirdParty: boolean;

  beforeAll(async () => {
    fixtures = await getFixtures();
    requireFixtureGroup(fixtures);
    hasThirdParty = !!fixtures.thirdPartyClient;

    if (hasThirdParty) {
      await ensureThirdPartyDmAccess(fixtures);
    } else {
      console.log(
        '[LOOP-PROTECTION] Skipping third-party tests - not configured'
      );
    }
  }, 180_000);

  beforeEach(async () => {
    await fakeModel.reset();
  });

  describe('human interactions', () => {
    test('human DM is processed and counter resets', async () => {
      // Plugin's bot-detection classifies ~ten as human → no rate limit,
      // and the consecutive-bot counter is logged as reset.
      const key = 'loop-human-single';
      await fakeModel.script(key, [{ kind: 'text', content: 'Hi human.' }]);

      const response = await fixtures.client.prompt(
        `[tlon-test:${key}] hello bot, just checking in as a human`
      );
      expect(response.success).toBe(true);

      const calls = await fakeModel.received(key);
      expect(calls.length).toBeGreaterThan(0);
    });

    test('three consecutive human DMs all get processed', async () => {
      // If humans were ever rate-limited, only the first call would land.
      // Same key, three step slots — each DM consumes one.
      const key = 'loop-human-triple';
      await fakeModel.script(key, [
        { kind: 'text', content: 'human 1' },
        { kind: 'text', content: 'human 2' },
        { kind: 'text', content: 'human 3' },
      ]);

      for (let i = 1; i <= 3; i += 1) {
        const response = await fixtures.client.prompt(
          `[tlon-test:${key}] human message ${i} of 3`
        );
        expect(response.success).toBe(true);
      }

      const calls = await fakeModel.received(key);
      expect(calls.length).toBe(3);
    });
  });

  describe('regular users (no BotProfile)', () => {
    test('non-owner without BotProfile is processed (treated as human)', async () => {
      if (!hasThirdParty) {
        console.log('[TEST] Skipped - no third-party configured');
        return;
      }

      // ~mug has no BotProfile metadata, so the plugin should treat them
      // as a human and process every DM.
      const key = 'loop-thirdparty-human';
      await fakeModel.script(key, [
        { kind: 'text', content: 'ok 1' },
        { kind: 'text', content: 'ok 2' },
        { kind: 'text', content: 'ok 3' },
        { kind: 'text', content: 'ok 4' },
        { kind: 'text', content: 'ok 5' },
      ]);

      for (let i = 1; i <= 5; i += 1) {
        const response = await fixtures.thirdPartyClient!.prompt(
          `[tlon-test:${key}] regular user message ${i}`,
          { timeoutMs: 30_000 }
        );
        expect(response.success).toBe(true);
      }

      const calls = await fakeModel.received(key);
      expect(calls.length).toBe(5);
    });
  });

  describe('bot-to-bot loop protection', () => {
    /**
     * These tests require two OpenClaw bots in the same channel.
     * The current test environment only has one bot (~zod).
     *
     * To test properly, you would need:
     * 1. Two ships running OpenClaw bots
     * 2. Both bots in the same group channel
     * 3. Owner tells Bot A to mention Bot B
     * 4. Bot B responds and mentions Bot A
     * 5. Loop continues until maxConsecutiveBotResponses is reached
     */

    test.skip('bot stops responding after maxConsecutiveBotResponses', async () => {
      // Requires multi-bot setup
      // After 3 consecutive bot mentions (default limit), bot should stop responding
    });

    test.skip('warning message appears when at limit', async () => {
      // Requires multi-bot setup
      // Response to 3rd consecutive bot mention should include:
      // "This is my last response to [bot] for now..."
    });

    test.skip('human mention breaks the loop and allows continuation', async () => {
      // Requires multi-bot setup
      // After human mentions bot, the counter resets and bot responds to bots again
    });
  });
});
