/**
 * Test Client — sends DMs to the bot, optionally waits for the bot to
 * post any reply back.
 *
 * The model layer is fully scripted via `fakeModel` (test/support/fake-model),
 * so the bot's reply text is whatever we pre-registered. Tests that care
 * about plugin behavior should assert via:
 *
 *   - `fixtures.botState.scry(...)` — durable state on the bot ship
 *   - `fakeModel.received(key)`     — model-call counts for a given tag
 *
 * Reply text is exposed by `prompt()` only as a smoke signal ("the bot
 * responded with *something*"); meaningful assertions belong on state.
 */

import { Urbit } from "@tloncorp/api";
import { scot, da } from "@urbit/aura";
import { markdownToStory, type Story } from "../../src/urbit/story.js";
import { startLiveToolTrace, type LiveToolTraceHandle } from "./docker-logs.js";
import { createStateClient, type StateClient } from "./state.js";

function liveToolTraceEnabled(): boolean {
  const raw = process.env.TEST_LIVE_TOOL_TRACE ?? process.env.CI_LIVE_TOOL_TRACE ?? "";
  return /^(1|true|yes|on)$/i.test(raw);
}

/** Ship connection credentials */
export interface ShipCredentials {
  shipUrl: string;
  shipName: string;
  code: string;
}

export interface AgentResponse {
  /** The bot's most recent reply text (whatever it posted back in DM). */
  text?: string;
  /** Whether the bot posted any new DM in response. */
  success: boolean;
  /** Error message if the prompt couldn't be sent or no reply arrived. */
  error?: string;
}

export interface TestClient {
  /**
   * Send a DM to the bot and wait for the bot to post any new DM back.
   *
   * Returns `{ success: true, text }` when a new bot post appears in the
   * DM channel after baseline. Returns `{ success: false, error }` if
   * sending fails or the timeout elapses with no new post.
   *
   * The reply text is informational only — tests should assert on state
   * (scry / fakeModel.received), not on this text.
   */
  prompt(text: string, opts?: { timeoutMs?: number }): Promise<AgentResponse>;
  /** Send a DM without waiting for a bot response. */
  sendDm(text: string): Promise<void>;
  /** Ship state client for assertions (checks BOT state). */
  state: StateClient;
}

// ── Tlon Mode (the only mode) ───────────────────────────────────────────

export interface TlonClientConfig {
  /** Test user credentials (sends prompts via DM). */
  testUser: ShipCredentials;
  /** Bot credentials (state assertions). */
  bot: ShipCredentials;
}

export function createTlonClient(config: TlonClientConfig): TestClient {
  const state = createStateClient(config.bot);
  const testUserState = createStateClient(config.testUser);

  const { testUser, bot } = config;

  const testUserShipClean = testUser.shipName.replace(/^~/, "");
  const testUserShipNorm = testUser.shipName.startsWith("~") ? testUser.shipName : `~${testUser.shipName}`;
  const urbit = new Urbit(testUser.shipUrl, testUser.code);
  urbit.ship = testUserShipClean;

  let connected = false;

  const ensureConnected = async (): Promise<void> => {
    if (!connected) {
      await urbit.connect();
      connected = true;
    }
  };

  /**
   * Send a DM via direct poke to the chat app. Can't go through the plugin's
   * sendDm because that uses the @tloncorp/api global client configured for
   * the BOT, not the test user.
   */
  const sendTestUserDm = async (toShip: string, message: string): Promise<void> => {
    await ensureConnected();
    const story: Story = markdownToStory(message);
    const targetShip = toShip.startsWith("~") ? toShip : `~${toShip}`;
    const sentAt = Date.now();
    const idUd = scot("ud", da.fromUnix(sentAt));
    const id = `${testUserShipNorm}/${idUd}`;

    const action = {
      ship: targetShip,
      diff: {
        id,
        delta: {
          add: {
            memo: {
              content: story,
              author: testUserShipNorm,
              sent: sentAt,
            },
            kind: null,
            time: null,
          },
        },
      },
    };

    await urbit.poke({ app: "chat", mark: "chat-dm-action", json: action });
  };

  const sendDmWithRetry = async (text: string): Promise<void> => {
    let lastSendError = "";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await sendTestUserDm(bot.shipName, text);
        return;
      } catch (err) {
        lastSendError = String(err);
        console.log(`Send DM attempt ${attempt}/3 failed: ${lastSendError}`);
        connected = false;
        if (attempt < 3) {
          await sleep(1000);
        }
      }
    }
    throw new Error(`Failed to send DM after 3 attempts: ${lastSendError}`);
  };

  /** Best-effort `/stop` to drain the bot after a timeout. */
  const bestEffortStopAfterTimeout = async (): Promise<void> => {
    try {
      console.log(`[timeout cleanup] sending /stop to ${bot.shipName}`);
      await sendDmWithRetry("/stop");
      await sleep(3000);
      console.log(`[timeout cleanup] /stop sent; gave it 3s to drain`);
    } catch (err) {
      console.log(`[timeout cleanup] failed to send /stop: ${String(err)}`);
    }
  };

  return {
    async sendDm(text) {
      await sendDmWithRetry(text);
    },

    async prompt(text, opts = {}) {
      const timeoutMs = opts.timeoutMs ?? 90_000;
      const botShipNorm = bot.shipName.startsWith("~") ? bot.shipName : `~${bot.shipName}`;

      console.log(`\n[TEST] Sending prompt: ${JSON.stringify(text)}`);

      // Snapshot the latest bot sequenceNum BEFORE sending so we can match
      // "any new bot post" without false positives from earlier traffic.
      // Baseline capture MUST succeed: a -1 baseline accepts any prior bot
      // post as a match, producing false greens. Fail the prompt loudly so
      // tests don't silently mis-pass on a transient scry failure.
      let baselineSequence: number;
      try {
        const before = await testUserState.channelPosts(botShipNorm, 30);
        baselineSequence = (before ?? [])
          .map((post) => {
            const p = post as { authorId?: string; sequenceNum?: number | null };
            return p.authorId === botShipNorm && typeof p.sequenceNum === "number"
              ? p.sequenceNum
              : -1;
          })
          .reduce((max, seq) => Math.max(max, seq), -1);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const fail = `Failed to capture DM baseline sequence: ${errMsg}`;
        console.log(`[TEST] Response success: false`);
        console.log(`[TEST] Response text: ${JSON.stringify(fail.slice(0, 500))}`);
        return { success: false, error: fail };
      }

      const composeFile = process.env.TEST_COMPOSE_FILE;
      const liveToolTrace: LiveToolTraceHandle | null =
        composeFile && liveToolTraceEnabled()
          ? startLiveToolTrace({
              composeFile,
              sinceIso: new Date().toISOString(),
              label: "prompt",
            })
          : null;
      if (liveToolTrace) {
        console.log(`[tooltrace prompt] live tool tracing enabled`);
      }

      try {
        try {
          await sendDmWithRetry(text);
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          const fail = `Failed to send DM after 3 attempts: ${errMsg}`;
          console.log(`[TEST] Response success: false`);
          console.log(`[TEST] Response text: ${JSON.stringify(fail.slice(0, 500))}`);
          return { success: false, error: fail };
        }

        const startTime = Date.now();
        let lastPollError = "";
        let attempts = 0;

        while (Date.now() - startTime < timeoutMs) {
          attempts += 1;
          // Poll interval — local docker ships return scrys in <100ms, so 500ms
          // keeps cost low without busy-looping.
          await sleep(500);

          try {
            const dmPosts = await testUserState.channelPosts(botShipNorm, 30);
            const allBotPosts = (dmPosts ?? [])
              .map((post) => {
                const p = post as {
                  authorId?: string;
                  sentAt?: number;
                  sequenceNum?: number | null;
                  textContent?: string | null;
                };
                return {
                  authorId: p.authorId,
                  sentAt: p.sentAt,
                  sequenceNum: p.sequenceNum,
                  text: (p.textContent ?? "").trim(),
                };
              })
              .filter((post) => post.authorId === botShipNorm)
              .filter((post) => post.text.length > 0);

            const candidates = allBotPosts.filter(
              (p) => typeof p.sequenceNum === "number" && p.sequenceNum > baselineSequence,
            );

            // Log on first attempt and roughly every 10s (poll = 500ms × 20).
            if (attempts === 1 || attempts % 20 === 0) {
              console.log(
                `[poll #${attempts}] baselineSequence=${baselineSequence} candidates=${candidates.length} botPosts=${allBotPosts.length}`,
              );
              if (allBotPosts.length > 0) {
                console.log(
                  `[poll #${attempts}] last 3 bot posts: ${JSON.stringify(
                    allBotPosts.slice(-3).map((p) => ({
                      sequenceNum: p.sequenceNum,
                      sentAt: p.sentAt,
                      text: p.text.slice(0, 40),
                    })),
                  )}`,
                );
              }
            }

            if (candidates.length > 0) {
              const latest = candidates.toSorted(
                (a, b) => (b.sequenceNum ?? -1) - (a.sequenceNum ?? -1),
              )[0];
              console.log(`[TEST] Response success: true`);
              console.log(`[TEST] Response text: ${JSON.stringify(latest.text.slice(0, 500))}`);
              return { success: true, text: latest.text };
            }
          } catch (err) {
            lastPollError = String(err);
            console.log(`DM poll failed: ${lastPollError}`);
          }
        }

        await bestEffortStopAfterTimeout();
        const timeoutError =
          `Timeout waiting for bot response after ${timeoutMs}ms ` +
          `(attempts=${attempts}, baselineSequence=${baselineSequence}` +
          (lastPollError ? `, lastPollError=${lastPollError}` : "") +
          `; sent /stop for cleanup)`;
        console.log(`[TEST] Response success: false`);
        console.log(`[TEST] Response text: ${JSON.stringify(timeoutError.slice(0, 500))}`);
        return { success: false, error: timeoutError };
      } finally {
        if (liveToolTrace) {
          const lines = await liveToolTrace.stop();
          console.log(`[tooltrace prompt] stopped (${lines.length} tool line(s))`);
        }
      }
    },

    state,
  };
}

// ── Factory ─────────────────────────────────────────────────────────────

export interface TestClientConfig {
  testUser: ShipCredentials;
  bot: ShipCredentials;
  /** Optional third-party (non-owner) credentials for security tests. */
  thirdParty?: ShipCredentials;
}

/** Create a test client (always Tlon mode — direct mode was never implemented). */
export function createTestClient(config: TestClientConfig): TestClient {
  return createTlonClient({ testUser: config.testUser, bot: config.bot });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
