import { Urbit } from '@tloncorp/api';
import type { Story } from '@tloncorp/api';
import { markdownToStory } from '@tloncorp/api/client/markdown';
import { da, scot } from '@urbit/aura';

import { type StateClient, createStateClient } from './state.js';

export interface ShipCredentials {
  shipUrl: string;
  shipName: string;
  code: string;
}

export interface AgentResponse {
  text?: string;
  success: boolean;
  error?: string;
}

export interface TestClient {
  prompt(text: string, opts?: { timeoutMs?: number }): Promise<AgentResponse>;
  sendDm(text: string): Promise<void>;
  state: StateClient;
}

export interface TlonClientConfig {
  testUser: ShipCredentials;
  bot: ShipCredentials;
}

export interface TestClientConfig {
  testUser: ShipCredentials;
  bot: ShipCredentials;
  thirdParty?: ShipCredentials;
}

export function createTlonClient(config: TlonClientConfig): TestClient {
  const state = createStateClient(config.bot);
  const testUserState = createStateClient(config.testUser);
  const { testUser, bot } = config;

  const testUserShipClean = testUser.shipName.replace(/^~/, '');
  const testUserShipNorm = testUser.shipName.startsWith('~')
    ? testUser.shipName
    : `~${testUser.shipName}`;
  const urbit = new Urbit(testUser.shipUrl, testUser.code);
  (urbit as unknown as { ship: string }).ship = testUserShipClean;

  let connected = false;

  const ensureConnected = async (): Promise<void> => {
    if (!connected) {
      await urbit.connect();
      connected = true;
    }
  };

  const sendTestUserDm = async (
    toShip: string,
    message: string
  ): Promise<void> => {
    await ensureConnected();
    const story: Story = markdownToStory(message);
    const targetShip = toShip.startsWith('~') ? toShip : `~${toShip}`;
    const sentAt = Date.now();
    const idUd = scot('ud', da.fromUnix(sentAt));
    const id = `${testUserShipNorm}/${idUd}`;

    await urbit.poke({
      app: 'chat',
      mark: 'chat-dm-action',
      json: {
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
      },
    });
  };

  const sendDmWithRetry = async (text: string): Promise<void> => {
    let lastSendError = '';
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await sendTestUserDm(bot.shipName, text);
        return;
      } catch (err) {
        lastSendError = String(err);
        connected = false;
        console.log(`Send DM attempt ${attempt}/3 failed: ${lastSendError}`);
        if (attempt < 3) {
          await sleep(1000);
        }
      }
    }
    throw new Error(`Failed to send DM after 3 attempts: ${lastSendError}`);
  };

  const bestEffortStopAfterTimeout = async (): Promise<void> => {
    try {
      console.log(`[timeout cleanup] sending /stop to ${bot.shipName}`);
      await sendDmWithRetry('/stop');
      await sleep(3000);
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
      const botShipNorm = bot.shipName.startsWith('~')
        ? bot.shipName
        : `~${bot.shipName}`;

      console.log(`\n[TEST] Sending prompt: ${JSON.stringify(text)}`);

      let baselineSequence: number;
      try {
        const before = await testUserState.channelPosts(botShipNorm, 30);
        baselineSequence = (before ?? [])
          .map((post) => {
            const p = post as {
              authorId?: string;
              sequenceNum?: number | null;
            };
            return p.authorId === botShipNorm &&
              typeof p.sequenceNum === 'number'
              ? p.sequenceNum
              : -1;
          })
          .reduce((max, seq) => Math.max(max, seq), -1);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const fail = `Failed to capture DM baseline sequence: ${errMsg}`;
        console.log(`[TEST] Response success: false`);
        console.log(
          `[TEST] Response text: ${JSON.stringify(fail.slice(0, 500))}`
        );
        return { success: false, error: fail };
      }

      try {
        await sendDmWithRetry(text);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const fail = `Failed to send DM after 3 attempts: ${errMsg}`;
        console.log(`[TEST] Response success: false`);
        console.log(
          `[TEST] Response text: ${JSON.stringify(fail.slice(0, 500))}`
        );
        return { success: false, error: fail };
      }

      const startTime = Date.now();
      let lastPollError = '';
      let attempts = 0;

      while (Date.now() - startTime < timeoutMs) {
        attempts += 1;
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
                text: (p.textContent ?? '').trim(),
              };
            })
            .filter((post) => post.authorId === botShipNorm)
            .filter((post) => post.text.length > 0);

          const candidates = allBotPosts.filter(
            (p) =>
              typeof p.sequenceNum === 'number' &&
              p.sequenceNum > baselineSequence
          );

          if (attempts === 1 || attempts % 20 === 0) {
            console.log(
              `[poll #${attempts}] baselineSequence=${baselineSequence} candidates=${candidates.length} botPosts=${allBotPosts.length}`
            );
          }

          if (candidates.length > 0) {
            const latest = [...candidates].sort(
              (a, b) => (b.sequenceNum ?? -1) - (a.sequenceNum ?? -1)
            )[0];
            console.log(`[TEST] Response success: true`);
            console.log(
              `[TEST] Response text: ${JSON.stringify(latest.text.slice(0, 500))}`
            );
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
        (lastPollError ? `, lastPollError=${lastPollError}` : '') +
        `; sent /stop for cleanup)`;
      console.log(`[TEST] Response success: false`);
      console.log(
        `[TEST] Response text: ${JSON.stringify(timeoutError.slice(0, 500))}`
      );
      return { success: false, error: timeoutError };
    },

    state,
  };
}

export function createTestClient(config: TestClientConfig): TestClient {
  return createTlonClient({ testUser: config.testUser, bot: config.bot });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
