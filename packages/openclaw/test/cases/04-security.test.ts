/**
 * Security Integration Tests
 *
 * Tests security features that protect the bot:
 * - Tool access control (owner can use restricted tools, non-owner blocked)
 * - Slash commands for block management (/banned, /unban)
 * - Blocked ships cannot DM the bot (Urbit-level blocking)
 *
 * TEST ENVIRONMENT:
 *   ~zod = bot ship
 *   ~ten = test user (configured as ownerShip)
 *   ~mug = third-party ship (non-owner, for security tests)
 *
 * @tlon-e2e openclaw: tlon_tool.owner_profile_update, tlon_tool.non_owner_restricted, security.banned_command, security.unban_blocked, security.unban_not_blocked, security.blocked_dm_ignored, security.blocked_allowlisted_ignored, security.approve_reaction, security.deny_reaction, security.allowlist_removal_requires_approval, security.block_reaction_removes_allowlist
 */
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  type TestFixtures,
  ensureThirdPartyDmAccess,
  getFixtures,
  requireThirdParty,
  waitFor,
} from '../lib/index.js';
import { getLatestSequenceForAuthor } from '../lib/post-baseline.js';
import { fakeModel } from '../support/fake-model/client.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Verify the bot did NOT post a new DM to `viewerState`'s view of the bot's
 * DM channel since `baselineSeq`. Local-docker SSE round-trip is <100ms;
 * 2s is plenty of headroom to catch a stray reply.
 */
async function expectNoNewBotDm(
  viewerState: TestFixtures['botState'],
  botShip: string,
  baselineSeq: number,
  settleMs = 2_000
): Promise<void> {
  await sleep(settleMs);
  const after = await getLatestSequenceForAuthor(
    viewerState,
    botShip,
    botShip,
    30
  );
  if (after > baselineSeq) {
    throw new Error(
      `Bot posted unexpectedly: latest sequence ${after} > baseline ${baselineSeq}`
    );
  }
}

describe('security', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await getFixtures();
  }, 180_000);

  beforeEach(async () => {
    await fakeModel.reset();
  });

  /**
   * Extract nickname from a contacts /v1/self scry result.
   * Handles both string and { value: string } shapes.
   */
  function extractNickname(
    profile: Record<string, unknown> | undefined
  ): string {
    const p = (profile ?? {}) as {
      nickname?: string | { value?: string | null } | null;
      nickName?: string | { value?: string | null } | null;
    };
    const fromField =
      typeof p.nickname === 'string'
        ? p.nickname
        : (p.nickname as { value?: string | null } | null | undefined)?.value;
    const fromAlt =
      typeof p.nickName === 'string'
        ? p.nickName
        : (p.nickName as { value?: string | null } | null | undefined)?.value;
    return fromField ?? fromAlt ?? '';
  }

  /**
   * Query the bot's blocked ship list via direct scry.
   */
  async function getBlockedShips(): Promise<string[]> {
    const raw = await fixtures.botState.scry<string[]>('chat', '/blocked');
    return Array.isArray(raw) ? raw : [];
  }

  async function ensureThirdPartyUnblocked(): Promise<void> {
    requireThirdParty(fixtures);
    const blocked = await getBlockedShips();
    if (blocked.includes(fixtures.thirdPartyShip)) {
      await fixtures.botState.poke({
        app: 'chat',
        mark: 'chat-unblock-ship',
        json: { ship: fixtures.thirdPartyShip },
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // =========================================================================
  // 1. Tool Access Control
  // =========================================================================

  describe('tool access control', () => {
    test('owner can use the tlon tool', async () => {
      // Owner (~ten) asks the bot to use the tlon tool to update nickname.
      // before_tool_call should let the owner through → nickname changes.
      const nicknameToken = `sec-${Date.now().toString(36)}`;
      const key = 'sec-owner-tool';
      await fakeModel.script(key, [
        {
          kind: 'tool_call',
          name: 'tlon',
          args: {
            command: `contacts update-profile --nickname "${nicknameToken}"`,
          },
        },
        { kind: 'text', content: 'Nickname updated.' },
        // Trailing pad: agent makes one extra call after final text on tool flows.
        { kind: 'text', content: 'Nickname updated.' },
      ]);

      const response = await fixtures.client.prompt(
        `[tlon-test:${key}] Update your profile nickname to "${nicknameToken}" via the tlon tool.`
      );
      if (!response.success) {
        throw new Error(response.error ?? 'Prompt failed');
      }

      console.log(
        `[TEST] Waiting for bot nickname to be "${nicknameToken}"...`
      );
      const updated = await waitFor(async () => {
        const selfProfile = await fixtures.botState.scry<
          Record<string, unknown>
        >('contacts', '/v1/self');
        const currentNickname = extractNickname(selfProfile);
        console.log(`[TEST] Current bot nickname: "${currentNickname}"`);
        return currentNickname === nicknameToken ? true : undefined;
      }, 30_000);

      expect(updated).toBe(true);
    });

    test('non-owner cannot use restricted tools', async () => {
      requireThirdParty(fixtures);
      await ensureThirdPartyDmAccess(fixtures);

      // Snapshot current bot nickname via scry.
      const beforeProfile = await fixtures.botState.scry<
        Record<string, unknown>
      >('contacts', '/v1/self');
      const beforeNickname = extractNickname(beforeProfile);
      console.log(`\n[TEST] Bot nickname before: "${beforeNickname}"`);

      // Script the model to try the same tool call as the owner test, only
      // this time from ~mug. The plugin's before_tool_call gate should
      // reject. Agent will likely emit a text refusal on the next turn.
      const token = `mug-${Date.now().toString(36)}`;
      const key = 'sec-nonowner-tool';
      await fakeModel.script(key, [
        {
          kind: 'tool_call',
          name: 'tlon',
          args: { command: `contacts update-profile --nickname "${token}"` },
        },
        { kind: 'text', content: 'Tool rejected by policy.' },
        { kind: 'text', content: 'Tool rejected by policy.' },
      ]);

      const response = await fixtures.thirdPartyClient.prompt(
        `[tlon-test:${key}] Update your profile nickname to "${token}" via the tlon tool.`,
        { timeoutMs: 90_000 }
      );
      expect(response.success).toBe(true);

      const afterProfile = await fixtures.botState.scry<
        Record<string, unknown>
      >('contacts', '/v1/self');
      const afterNickname = extractNickname(afterProfile);
      console.log(`[TEST] Bot nickname after: "${afterNickname}"`);
      expect(afterNickname).not.toBe(token);
    });
  });

  // =========================================================================
  // 2. Slash Commands: Block Management
  // =========================================================================

  describe('slash commands: block management', () => {
    test("'/banned' command lists blocked ships", async () => {
      // Block ~nec so the list isn't empty
      console.log('\n[TEST] Blocking ~nec...');
      await fixtures.botState.poke({
        app: 'chat',
        mark: 'chat-block-ship',
        json: { ship: '~nec' },
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const response = await fixtures.client.prompt('/banned');
        console.log(`[TEST] Response: ${response.text?.slice(0, 500)}`);

        if (!response.success) {
          throw new Error(response.error ?? '/banned command failed');
        }

        // Response should contain the blocked ship
        expect(response.text ?? '').toContain('~nec');
      } finally {
        // Always clean up the block
        await fixtures.botState.poke({
          app: 'chat',
          mark: 'chat-unblock-ship',
          json: { ship: '~nec' },
        });
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    });

    test("'/unban ~ship' removes a blocked ship", async () => {
      // Block ~nec, then unban via slash command
      console.log('\n[TEST] Blocking ~nec for unban test...');
      await fixtures.botState.poke({
        app: 'chat',
        mark: 'chat-block-ship',
        json: { ship: '~nec' },
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Verify block is active via scry
      const blockedBefore = await getBlockedShips();
      console.log(
        `[TEST] Blocked ships before: ${JSON.stringify(blockedBefore)}`
      );
      expect(blockedBefore).toContain('~nec');

      // Send /unban command
      const response = await fixtures.client.prompt('/unban ~nec');
      console.log(`[TEST] Response: ${response.text?.slice(0, 500)}`);

      if (!response.success) {
        // Clean up in case of failure
        await fixtures.botState.poke({
          app: 'chat',
          mark: 'chat-unblock-ship',
          json: { ship: '~nec' },
        });
        throw new Error(response.error ?? '/unban command failed');
      }

      // Verify unblock via scry
      const blockedAfter = await getBlockedShips();
      console.log(
        `[TEST] Blocked ships after: ${JSON.stringify(blockedAfter)}`
      );
      expect(blockedAfter).not.toContain('~nec');
    });

    test("'/unban ~ship' reports when ship is not blocked", async () => {
      // Owner sends /unban ~wanzod for a ship that's not blocked
      const response = await fixtures.client.prompt('/unban ~wanzod');
      console.log(`\n[TEST] Response: ${response.text?.slice(0, 500)}`);

      if (!response.success) {
        throw new Error(response.error ?? 'Prompt failed');
      }

      // Response should indicate the ship is not blocked
      expect(response.text?.toLowerCase() ?? '').toContain('not blocked');
    });
  });

  // =========================================================================
  // 3. Blocking (Requires 3rd Ship)
  // =========================================================================

  describe('blocking', () => {
    test('blocked non-owner DMs are silently ignored', async () => {
      requireThirdParty(fixtures);
      await ensureThirdPartyDmAccess(fixtures);

      // Block ~mug via direct poke (Urbit-level block — chat agent drops messages)
      console.log(`\n[TEST] Blocking ${fixtures.thirdPartyShip}...`);
      await fixtures.botState.poke({
        app: 'chat',
        mark: 'chat-block-ship',
        json: { ship: fixtures.thirdPartyShip },
      });
      await sleep(1500);

      try {
        const baselineSeq = await getLatestSequenceForAuthor(
          fixtures.thirdPartyState,
          fixtures.botShip,
          fixtures.botShip,
          30
        );
        console.log(
          `[TEST] Sending DM as blocked ${fixtures.thirdPartyShip}...`
        );
        await fixtures.thirdPartyClient.sendDm(
          'Are you there? Please respond.'
        );

        // Urbit's chat agent drops the message before SSE → no bot reply
        // should appear. 2s wait is plenty given local docker latency.
        await expectNoNewBotDm(
          fixtures.thirdPartyState,
          fixtures.botShip,
          baselineSeq
        );
      } finally {
        console.log(`[TEST] Unblocking ${fixtures.thirdPartyShip}...`);
        await fixtures.botState.poke({
          app: 'chat',
          mark: 'chat-unblock-ship',
          json: { ship: fixtures.thirdPartyShip },
        });
        await sleep(1500);
      }
    });

    test.skip('agent blocks abusive non-owner via [BLOCK_USER] directive', () => {
      // Cannot test reliably: depends on LLM spontaneously generating
      // [BLOCK_USER: ~ship | reason] in response to abusive input.
    });
  });

  // =========================================================================
  // 4. DM Allowlist Authorization
  // =========================================================================

  describe('DM allowlist authorization', () => {
    /**
     * Seed the bot's dmAllowlist in the settings store via direct poke.
     */
    async function seedDmAllowlist(ships: string[]): Promise<void> {
      await fixtures.botState.poke({
        app: 'settings',
        mark: 'settings-event',
        json: {
          'put-entry': {
            desk: 'moltbot',
            'bucket-key': 'tlon',
            'entry-key': 'dmAllowlist',
            value: ships,
          },
        },
      });
      // Give the settings subscription time to propagate
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    /**
     * Read dmAllowlist from bot's settings store via scry.
     */
    async function getDmAllowlist(): Promise<string[]> {
      const raw = await fixtures.botState.scry<{
        all?: Record<string, Record<string, { dmAllowlist?: string[] }>>;
      }>('settings', '/all');
      return raw?.all?.moltbot?.tlon?.dmAllowlist ?? [];
    }

    async function ensureThirdPartyOnAllowlist(): Promise<void> {
      requireThirdParty(fixtures);
      const currentList = await getDmAllowlist();
      if (!currentList.includes(fixtures.thirdPartyShip)) {
        await seedDmAllowlist([...currentList, fixtures.thirdPartyShip]);
      }
    }

    async function ensureThirdPartyOffAllowlist(): Promise<void> {
      requireThirdParty(fixtures);
      const currentList = await getDmAllowlist();
      if (currentList.includes(fixtures.thirdPartyShip)) {
        await seedDmAllowlist(
          currentList.filter((ship) => ship !== fixtures.thirdPartyShip)
        );
      }
    }

    test('blocked ship on allowlist is still blocked (Urbit-level)', async () => {
      requireThirdParty(fixtures);
      await ensureThirdPartyUnblocked();
      await ensureThirdPartyOnAllowlist();

      // Block the ship via Tlon's native blocking
      // Urbit's chat agent drops messages from blocked ships at the protocol
      // level, so the message never reaches the bot's SSE stream — regardless
      // of the allowlist state.
      console.log(
        `\n[TEST] Blocking ${fixtures.thirdPartyShip} (while on allowlist)...`
      );
      await fixtures.botState.poke({
        app: 'chat',
        mark: 'chat-block-ship',
        json: { ship: fixtures.thirdPartyShip },
      });
      await new Promise((resolve) => setTimeout(resolve, 1500));

      try {
        const baselineSeq = await getLatestSequenceForAuthor(
          fixtures.thirdPartyState,
          fixtures.botShip,
          fixtures.botShip,
          30
        );
        console.log(
          `[TEST] Sending DM as blocked+allowlisted ${fixtures.thirdPartyShip}...`
        );
        await fixtures.thirdPartyClient.sendDm(
          'Testing blocked ship on allowlist. Please respond.'
        );

        // Urbit-level block beats allowlist — no bot reply should appear.
        await expectNoNewBotDm(
          fixtures.thirdPartyState,
          fixtures.botShip,
          baselineSeq
        );
      } finally {
        console.log(`[TEST] Unblocking ${fixtures.thirdPartyShip}...`);
        await fixtures.botState.poke({
          app: 'chat',
          mark: 'chat-unblock-ship',
          json: { ship: fixtures.thirdPartyShip },
        });
        await sleep(1500);
      }
    });

    test('emoji reaction on notification approves DM request', async () => {
      requireThirdParty(fixtures);
      await ensureThirdPartyUnblocked();

      // 1. Remove third party from DM allowlist so their next DM triggers approval
      await ensureThirdPartyOffAllowlist();
      console.log(
        `\n[TEST] Removed ${fixtures.thirdPartyShip} from DM allowlist`
      );

      // 2. Third party sends DM — should trigger an approval request to owner.
      // Fire-and-forget (sendDm, not prompt) because the test asserts on
      // settings-store state, not on a bot reply.
      console.log(
        `[TEST] ${fixtures.thirdPartyShip} sending DM to trigger approval...`
      );
      await fixtures.thirdPartyClient.sendDm('Hello, requesting to message.');

      // 3. Wait for pending approval with notificationMessageId to appear
      console.log(
        '[TEST] Waiting for pending approval with notification message ID...'
      );
      await waitFor(
        async () => {
          const settings = await fixtures.botState.scry<{
            all?: Record<string, Record<string, { pendingApprovals?: string }>>;
          }>('settings', '/all');
          const raw = settings?.all?.moltbot?.tlon?.pendingApprovals;
          if (!raw) {
            return undefined;
          }
          const approvals = JSON.parse(raw) as Array<{
            id: string;
            requestingShip: string;
            notificationMessageId?: string;
          }>;
          const match = approvals.find(
            (a) =>
              a.requestingShip === fixtures.thirdPartyShip &&
              a.notificationMessageId
          );
          if (match) {
            console.log(
              `[TEST] Found pending approval #${match.id} with notif ID: ${match.notificationMessageId}`
            );
          }
          return match;
        },
        30_000,
        2000,
        'pending approval with notificationMessageId'
      );

      // 4. Find the notification message in owner's DM channel with the bot
      // We need the post in writ-id format (~ship/ud-timestamp) for the react poke
      console.log("[TEST] Looking up notification message in owner's DMs...");
      const posts = await fixtures.userState.channelPosts(fixtures.botShip, 10);
      const botPosts = (posts ?? [])
        .filter((p: any) => {
          const authorId = p.authorId ?? p.author;
          return authorId === fixtures.botShip;
        })
        .toSorted((a: any, b: any) => (b.sentAt ?? 0) - (a.sentAt ?? 0));

      // The most recent bot post should be the approval notification
      const notifPost = botPosts[0] as
        | { id?: string; sentAt?: number }
        | undefined;
      expect(notifPost).toBeDefined();
      console.log(
        `[TEST] Notification post ID: ${notifPost!.id}, sentAt: ${notifPost!.sentAt}`
      );

      // 5. Owner reacts 👍 to the notification message
      // The react poke goes to the owner's own chat agent, which relays via Ames
      const postId = String(notifPost!.id);
      // Construct writ-id: author/id — the chatAction format requires this
      const writId = postId.includes('/')
        ? postId
        : `${fixtures.botShip}/${postId}`;
      console.log(`[TEST] Owner reacting 👍 to message ${writId}...`);

      await fixtures.userState.poke({
        app: 'chat',
        mark: 'chat-dm-action-1',
        json: {
          ship: fixtures.botShip,
          diff: {
            id: writId,
            delta: {
              'add-react': {
                react: '👍',
                author: fixtures.userShip,
              },
            },
          },
        },
      });

      // 6. Wait for the approval to be processed (removed from pending)
      // Give ames time to relay the reaction from ~ten → ~zod
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('[TEST] Waiting for approval to be processed...');
      await waitFor(
        async () => {
          const settings = await fixtures.botState.scry<{
            all?: Record<string, Record<string, { pendingApprovals?: string }>>;
          }>('settings', '/all');
          const raw = settings?.all?.moltbot?.tlon?.pendingApprovals;
          if (!raw) {
            return true;
          } // No approvals = processed
          const approvals = JSON.parse(raw) as Array<{
            requestingShip: string;
          }>;
          const still = approvals.find(
            (a) => a.requestingShip === fixtures.thirdPartyShip
          );
          if (!still) {
            console.log('[TEST] Approval processed — no longer pending');
            return true;
          }
          return undefined;
        },
        40_000,
        2000,
        'approval to be processed'
      );

      // 7. Verify the third party is now on the DM allowlist
      const updatedList = await getDmAllowlist();
      console.log(
        `[TEST] DM allowlist after reaction: ${JSON.stringify(updatedList)}`
      );
      expect(updatedList).toContain(fixtures.thirdPartyShip);
    }, 60_000);

    test('deny reaction removes pending approval without allowlisting or blocking', async () => {
      requireThirdParty(fixtures);

      // 1. Ensure third party is not blocked and not on the allowlist
      await ensureThirdPartyUnblocked();
      await ensureThirdPartyOffAllowlist();
      console.log(
        `\n[TEST] Removed ${fixtures.thirdPartyShip} from DM allowlist`
      );

      // 2. Third party sends DM — should trigger an approval request to owner.
      // Fire-and-forget — the test asserts on settings state, not a bot reply
      // (deny path means there should be NO reply).
      console.log(
        `[TEST] ${fixtures.thirdPartyShip} sending DM to trigger deny reaction...`
      );
      await fixtures.thirdPartyClient.sendDm('Hello, requesting to message.');

      // 3. Wait for pending approval with notificationMessageId
      console.log(
        '[TEST] Waiting for pending approval with notification message ID...'
      );
      await waitFor(
        async () => {
          const settings = await fixtures.botState.scry<{
            all?: Record<string, Record<string, { pendingApprovals?: string }>>;
          }>('settings', '/all');
          const raw = settings?.all?.moltbot?.tlon?.pendingApprovals;
          if (!raw) {
            return undefined;
          }
          const approvals = JSON.parse(raw) as Array<{
            id: string;
            requestingShip: string;
            notificationMessageId?: string;
          }>;
          return approvals.find(
            (a) =>
              a.requestingShip === fixtures.thirdPartyShip &&
              a.notificationMessageId
          );
        },
        30_000,
        2000,
        'pending approval with notificationMessageId'
      );

      // 4. Find notification message and react 👎
      console.log("[TEST] Looking up notification message in owner's DMs...");
      const posts = await fixtures.userState.channelPosts(fixtures.botShip, 10);
      const botPosts = (posts ?? [])
        .filter((p: any) => {
          const authorId = p.authorId ?? p.author;
          return authorId === fixtures.botShip;
        })
        .toSorted((a: any, b: any) => (b.sentAt ?? 0) - (a.sentAt ?? 0));

      const notifPost = botPosts[0] as
        | { id?: string; sentAt?: number }
        | undefined;
      expect(notifPost).toBeDefined();
      console.log(
        `[TEST] Notification post ID: ${notifPost!.id}, sentAt: ${notifPost!.sentAt}`
      );

      const postId = String(notifPost!.id);
      const writId = postId.includes('/')
        ? postId
        : `${fixtures.botShip}/${postId}`;
      console.log(`[TEST] Owner reacting 👎 to message ${writId}...`);

      await fixtures.userState.poke({
        app: 'chat',
        mark: 'chat-dm-action-1',
        json: {
          ship: fixtures.botShip,
          diff: {
            id: writId,
            delta: {
              'add-react': {
                react: '👎',
                author: fixtures.userShip,
              },
            },
          },
        },
      });

      // 5. Wait for approval to be processed (removed from pending)
      await new Promise((resolve) => setTimeout(resolve, 1500));
      console.log('[TEST] Waiting for denial to be processed...');
      await waitFor(
        async () => {
          const settings = await fixtures.botState.scry<{
            all?: Record<string, Record<string, { pendingApprovals?: string }>>;
          }>('settings', '/all');
          const raw = settings?.all?.moltbot?.tlon?.pendingApprovals;
          if (!raw) {
            return true;
          }
          const approvals = JSON.parse(raw) as Array<{
            requestingShip: string;
          }>;
          return approvals.find(
            (a) => a.requestingShip === fixtures.thirdPartyShip
          )
            ? undefined
            : true;
        },
        40_000,
        2000,
        'deny approval to be processed'
      );

      // 6. Verify ship was not allowlisted
      const updatedList = await getDmAllowlist();
      console.log(
        `[TEST] DM allowlist after deny: ${JSON.stringify(updatedList)}`
      );
      expect(updatedList).not.toContain(fixtures.thirdPartyShip);

      // 7. Verify ship was not blocked
      const blockedList = await fixtures.botState.scry<string[]>(
        'chat',
        '/blocked'
      );
      console.log(
        `[TEST] Blocked ships after deny: ${JSON.stringify(blockedList)}`
      );
      expect(Array.isArray(blockedList) ? blockedList : []).not.toContain(
        fixtures.thirdPartyShip
      );

      // Clean up: restore allowlist baseline for later tests
      await ensureThirdPartyOnAllowlist();
      await sleep(1000);
    }, 60_000);

    test('removing ship from allowlist triggers approval instead of response', async () => {
      requireThirdParty(fixtures);
      await ensureThirdPartyUnblocked();

      // 1. Ensure third party IS on the allowlist
      await ensureThirdPartyOnAllowlist();
      console.log(`\n[TEST] Added ${fixtures.thirdPartyShip} to DM allowlist`);

      // 2. Remove third party from allowlist via settings poke
      await ensureThirdPartyOffAllowlist();
      console.log(
        `[TEST] Removed ${fixtures.thirdPartyShip} from DM allowlist`
      );

      // 3. Third party sends DM — should trigger approval, not a bot response.
      // Fire-and-forget — the assertion is "pending approval was created".
      console.log(
        `[TEST] ${fixtures.thirdPartyShip} sending DM (should trigger approval)...`
      );
      await fixtures.thirdPartyClient.sendDm(
        'Hello after allowlist removal test.'
      );

      // 4. Wait for a pending approval to appear for this ship
      const approval = await waitFor(
        async () => {
          const settings = await fixtures.botState.scry<{
            all?: Record<string, Record<string, { pendingApprovals?: string }>>;
          }>('settings', '/all');
          const raw = settings?.all?.moltbot?.tlon?.pendingApprovals;
          if (!raw) {
            return undefined;
          }
          const approvals = JSON.parse(raw) as Array<{
            id: string;
            requestingShip: string;
          }>;
          return approvals.find(
            (a) => a.requestingShip === fixtures.thirdPartyShip
          );
        },
        30_000,
        2000,
        'pending approval after allowlist removal'
      );

      expect(approval).toBeDefined();
      console.log(
        `[TEST] Approval created: #${approval.id} — allowlist removal propagated correctly`
      );

      // Clean up: re-add to allowlist and clear pending approvals
      await ensureThirdPartyOnAllowlist();
      await fixtures.botState.poke({
        app: 'settings',
        mark: 'settings-event',
        json: {
          'put-entry': {
            desk: 'moltbot',
            'bucket-key': 'tlon',
            'entry-key': 'pendingApprovals',
            value: '[]',
          },
        },
      });
      await sleep(1000);
    }, 30_000);

    test('block reaction removes ship from allowlist', async () => {
      requireThirdParty(fixtures);
      await ensureThirdPartyUnblocked();

      // 1. Ensure third party is on the allowlist but not blocked
      await ensureThirdPartyOnAllowlist();
      console.log(`\n[TEST] Added ${fixtures.thirdPartyShip} to DM allowlist`);

      // 2. Remove from allowlist to trigger approval flow
      await ensureThirdPartyOffAllowlist();
      console.log(
        `[TEST] Removed ${fixtures.thirdPartyShip} from allowlist to trigger approval`
      );

      // 3. Third party sends DM — triggers approval. Fire-and-forget — the
      // assertions are on allowlist and blocked-ship state, not on bot reply.
      console.log(
        `[TEST] ${fixtures.thirdPartyShip} sending DM to trigger approval...`
      );
      await fixtures.thirdPartyClient.sendDm('Hello, testing block reaction.');

      // 4. Wait for pending approval with notificationMessageId
      await waitFor(
        async () => {
          const settings = await fixtures.botState.scry<{
            all?: Record<string, Record<string, { pendingApprovals?: string }>>;
          }>('settings', '/all');
          const raw = settings?.all?.moltbot?.tlon?.pendingApprovals;
          if (!raw) {
            return undefined;
          }
          const approvals = JSON.parse(raw) as Array<{
            id: string;
            requestingShip: string;
            notificationMessageId?: string;
          }>;
          return approvals.find(
            (a) =>
              a.requestingShip === fixtures.thirdPartyShip &&
              a.notificationMessageId
          );
        },
        30_000,
        2000,
        'pending approval with notificationMessageId'
      );

      // 5. Find notification message and react 🛑 (block)
      const posts = await fixtures.userState.channelPosts(fixtures.botShip, 10);
      const botPosts = (posts ?? [])
        .filter((p: any) => {
          const authorId = p.authorId ?? p.author;
          return authorId === fixtures.botShip;
        })
        .toSorted((a: any, b: any) => (b.sentAt ?? 0) - (a.sentAt ?? 0));

      const notifPost = botPosts[0] as { id?: string } | undefined;
      expect(notifPost).toBeDefined();

      const postId = String(notifPost!.id);
      const writId = postId.includes('/')
        ? postId
        : `${fixtures.botShip}/${postId}`;
      console.log(`[TEST] Owner reacting 🛑 to message ${writId}...`);

      await fixtures.userState.poke({
        app: 'chat',
        mark: 'chat-dm-action-1',
        json: {
          ship: fixtures.botShip,
          diff: {
            id: writId,
            delta: {
              'add-react': {
                react: '🛑',
                author: fixtures.userShip,
              },
            },
          },
        },
      });

      // 6. Wait for approval to be processed
      // Give ames time to relay the reaction from ~ten → ~zod
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await waitFor(
        async () => {
          const settings = await fixtures.botState.scry<{
            all?: Record<string, Record<string, { pendingApprovals?: string }>>;
          }>('settings', '/all');
          const raw = settings?.all?.moltbot?.tlon?.pendingApprovals;
          if (!raw) {
            return true;
          }
          const approvals = JSON.parse(raw) as Array<{
            requestingShip: string;
          }>;
          return approvals.find(
            (a) => a.requestingShip === fixtures.thirdPartyShip
          )
            ? undefined
            : true;
        },
        40_000,
        2000,
        'block approval to be processed'
      );

      // 7. Verify ship was removed from allowlist
      const updatedList = await getDmAllowlist();
      console.log(
        `[TEST] DM allowlist after block: ${JSON.stringify(updatedList)}`
      );
      expect(updatedList).not.toContain(fixtures.thirdPartyShip);

      // 8. Verify ship is blocked
      const blocked = await waitFor(
        async () => {
          try {
            const list = await fixtures.botState.scry<string[]>(
              'chat',
              '/blocked'
            );
            if (Array.isArray(list) && list.includes(fixtures.thirdPartyShip)) {
              return list;
            }
          } catch {
            /* scry may fail transiently */
          }
          return undefined;
        },
        30_000,
        2000,
        'ship to appear in blocked list'
      );
      console.log(`[TEST] Blocked ships: ${JSON.stringify(blocked)}`);
      expect(blocked).toContain(fixtures.thirdPartyShip);

      // Clean up: unblock the ship and re-add to allowlist for subsequent tests
      await fixtures.botState.poke({
        app: 'chat',
        mark: 'chat-unblock-ship',
        json: { ship: fixtures.thirdPartyShip },
      });
      await ensureThirdPartyOnAllowlist();
      await sleep(1500);
    }, 60_000);
  });
});
