import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import { type TestFixtures, getFixtures, waitFor } from '../lib/index.js';
import {
  extractPostText,
  getLatestSequenceForAuthor,
  isPostNewerThanSequence,
} from '../lib/post-baseline.js';
import { fakeModel } from '../support/fake-model/client.js';

const SOURCE_IMAGE_URL =
  'https://storage.googleapis.com/tlon-test-ci-shared/test-images/openclaw-image.png';

const LOCAL_MEDIA_ERROR_TEXT =
  "Local file paths are not supported on this channel — upload the file first (e.g. `tlon upload <path>` using your owner ship's credentials), then resend with the returned https URL.";

// Poke mark verified against fakezod — see plan §1b.
// JSON keys must be kebab-case (storage-json/hoon), not camelCase.
const STORAGE_POKE_MARK = 'storage-action';

const storageEnv = {
  endpoint: process.env.TEST_STORAGE_ENDPOINT,
  bucket: process.env.TEST_STORAGE_BUCKET,
  accessKey: process.env.TEST_STORAGE_ACCESS_KEY,
  secretKey: process.env.TEST_STORAGE_SECRET_KEY,
  region: process.env.TEST_STORAGE_REGION ?? 'auto',
};

const hasStorageEnv = Boolean(
  storageEnv.endpoint &&
    storageEnv.bucket &&
    storageEnv.accessKey &&
    storageEnv.secretKey
);

describe('media', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await getFixtures();
  });

  beforeEach(async () => {
    await fakeModel.reset();
  });

  const mediaTest = hasStorageEnv ? test : test.skip;

  mediaTest('uploads and sends an image via DM', async () => {
    // ── Seed S3 storage config on bot ship (idempotent) ────────────────
    const rawConfig = await fixtures.botState.scry<{
      'storage-update': {
        configuration: {
          buckets: string[];
          currentBucket: string;
          region: string;
        };
      };
    }>('storage', '/configuration');
    const config = rawConfig['storage-update'].configuration;

    const rawCreds = await fixtures.botState.scry<{
      'storage-update': {
        credentials: {
          endpoint: string;
          accessKeyId: string;
          secretAccessKey: string;
        };
      };
    }>('storage', '/credentials');
    const creds = rawCreds['storage-update'].credentials;

    const pokes: Record<string, unknown>[] = [];
    if (creds.endpoint !== storageEnv.endpoint) {
      pokes.push({ 'set-endpoint': storageEnv.endpoint });
    }
    if (creds.accessKeyId !== storageEnv.accessKey) {
      pokes.push({ 'set-access-key-id': storageEnv.accessKey });
    }
    if (creds.secretAccessKey !== storageEnv.secretKey) {
      pokes.push({ 'set-secret-access-key': storageEnv.secretKey });
    }
    if (config.region !== storageEnv.region) {
      pokes.push({ 'set-region': storageEnv.region });
    }
    if (!config.buckets.includes(storageEnv.bucket!)) {
      pokes.push({ 'add-bucket': storageEnv.bucket });
    }
    if (config.currentBucket !== storageEnv.bucket) {
      pokes.push({ 'set-current-bucket': storageEnv.bucket });
    }

    for (const json of pokes) {
      await fixtures.botState.poke({
        app: 'storage',
        mark: STORAGE_POKE_MARK,
        json,
      });
    }
    if (pokes.length > 0) {
      console.log(
        `[TEST] Seeded ${pokes.length} storage config poke(s), waiting for propagation...`
      );
      await waitFor(
        async () => {
          const cfg = (
            await fixtures.botState.scry<{
              'storage-update': {
                configuration: { currentBucket: string; region: string };
              };
            }>('storage', '/configuration')
          )['storage-update'].configuration;

          const crd = (
            await fixtures.botState.scry<{
              'storage-update': {
                credentials: {
                  endpoint: string;
                  accessKeyId: string;
                  secretAccessKey: string;
                };
              };
            }>('storage', '/credentials')
          )['storage-update'].credentials;

          const ready =
            cfg.currentBucket === storageEnv.bucket &&
            cfg.region === storageEnv.region &&
            crd.endpoint === storageEnv.endpoint &&
            crd.accessKeyId === storageEnv.accessKey &&
            crd.secretAccessKey === storageEnv.secretKey;
          return ready ? true : undefined;
        },
        15_000,
        undefined,
        'storage config propagation'
      );
      console.log('[TEST] Storage config confirmed');
    }

    // ── Capture DM baseline before prompting ─────────────────────────
    const baselineSequence = await getLatestSequenceForAuthor(
      fixtures.userState,
      fixtures.botShip,
      fixtures.botShip,
      30
    );
    console.log(`[TEST] DM baseline sequence: ${baselineSequence}`);

    // ── Prompt bot to send image in this DM ──────────────────────────
    const token = `it-media-${Date.now().toString(36)}`;
    const key = 'media-dm-image';
    await fakeModel.script(key, [
      {
        kind: 'tool_call',
        name: 'message',
        args: {
          action: 'send',
          // DM back to the prompt sender (~ten) — that's the channel the
          // test polls for the image post.
          target: fixtures.userShip,
          message: token,
          media: SOURCE_IMAGE_URL,
        },
      },
      { kind: 'text', content: 'Image sent.' },
      { kind: 'text', content: 'Image sent.' },
    ]);

    const response = await fixtures.client.prompt(
      `[tlon-test:${key}] Send an image (media=${SOURCE_IMAGE_URL}) with text "${token}".`
    );

    if (!response.success) {
      throw new Error(response.error ?? 'Prompt failed');
    }

    // ── Assert: bot sent an image in the DM with rewritten URL ───────
    console.log(`[TEST] Waiting for image DM with token "${token}"...`);
    const result = await waitFor(
      async () => {
        const posts = await fixtures.userState.channelPosts(
          fixtures.botShip,
          30
        );
        for (const post of posts ?? []) {
          const p = post as {
            authorId?: string;
            sentAt?: number;
            sequenceNum?: number | null;
            textContent?: string | null;
            images?: Array<{ src?: string | null }>;
          };
          if (p.authorId !== fixtures.botShip) {
            continue;
          }
          if (!isPostNewerThanSequence(p, baselineSequence)) {
            continue;
          }
          const text = (p.textContent ?? '').toLowerCase();
          if (!text.includes(token.toLowerCase())) {
            continue;
          }
          if (!p.images?.length || !p.images[0]?.src) {
            continue;
          }
          return { src: p.images[0].src };
        }
        return undefined;
      },
      30_000,
      undefined,
      'image DM from bot'
    );

    console.log(`[TEST] Found image DM with src: ${result.src}`);

    // The image URL must have been rewritten by uploadFile.
    // If upload failed, the function falls back to the canonical source URL,
    // so equality here means the upload did NOT happen.
    expect(result.src).toBeDefined();
    expect(result.src).not.toBe(SOURCE_IMAGE_URL);
  });

  test('local path fails loudly and posts nothing (storage-independent)', async () => {
    const token = `it-localmedia-${Date.now().toString(36)}`;
    const key = 'media-local-path-reject';
    const localPath = `/pier/secret-${token}.png`;

    const baselineSequence = await getLatestSequenceForAuthor(
      fixtures.userState,
      fixtures.botShip,
      fixtures.botShip,
      30
    );

    await fakeModel.script(
      key,
      [
        {
          kind: 'tool_call',
          name: 'message',
          args: {
            action: 'send',
            target: fixtures.userShip,
            message: token,
            media: localPath,
          },
        },
        { kind: 'text', content: 'Done.' },
      ],
      { allowExtraCalls: 2 }
    );

    const response = await fixtures.client.prompt(
      `[tlon-test:${key}] Send an image (media=${localPath}) with text "${token}".`
    );

    if (!response.success) {
      throw new Error(response.error ?? 'Prompt failed');
    }

    // ── Assert (a): follow-up model request carries the failed tool-result ──
    const calls = await fakeModel.received(key);
    const followUpWithToolResult = calls.find((call) =>
      call.messages?.some(
        (msg) =>
          msg.role === 'tool' &&
          msg.content?.text?.includes(LOCAL_MEDIA_ERROR_TEXT)
      )
    );
    expect(followUpWithToolResult).toBeDefined();

    // ── Assert (b): the media was never delivered, and the plugin posted
    // nothing of its own.
    //
    // OpenClaw core renders a failed tool call back into the conversation
    // ("⚠️ ✉️ Message: <media> failed" — its `message` display config lists
    // `media` among the detail keys), so a post mentioning the path is expected
    // and outside this plugin's control. What must NOT happen is the media
    // being delivered as an image block, or the plugin posting the caption on
    // its own before rethrowing.
    const isCoreFailureNotice = (text: string) =>
      /^\s*⚠️/.test(text) && /failed/i.test(text);

    const posts = await fixtures.userState.channelPosts(fixtures.botShip, 30);
    const newBotPosts = (posts ?? [])
      .map(
        (post) =>
          post as {
            authorId?: string;
            sequenceNum?: number | null;
            textContent?: string | null;
            content?: unknown;
            images?: Array<{ src?: string | null }>;
          }
      )
      .filter(
        (p) =>
          p.authorId === fixtures.botShip &&
          isPostNewerThanSequence(p, baselineSequence)
      );

    // No image block anywhere carries the token — the media never landed.
    const deliveredImage = newBotPosts.find(
      (p) => p.images?.some((img) => img.src?.includes(token)) ?? false
    );
    expect(deliveredImage).toBeUndefined();

    // No post other than core's failure notice mentions the token — the plugin
    // did not post the caption as a side effect.
    const pluginPost = newBotPosts.find((p) => {
      const text = extractPostText(p);
      return text.includes(token) && !isCoreFailureNotice(text);
    });
    expect(pluginPost).toBeUndefined();
  });
});
