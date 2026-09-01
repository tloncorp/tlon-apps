/**
 * Blob Attachment Integration Tests
 *
 * Verifies the plugin's blob-extraction path: when a DM or channel post
 * carries a blob (voice memo, file attachment), the plugin must extract
 * the blob metadata (transcription, filename, etc.) and include it in
 * the model context for the agent loop.
 *
 * Real assertion shape: we tag each prompt and register a script, then
 * query the fake-model's recorded user-message text via fakeModel.received
 * and confirm the expected blob substring (transcription / filename)
 * appears in the model request. A broken blob-to-context path would fail
 * here even though the bot still produces a reply.
 *
 * TEST ENVIRONMENT:
 *   ~zod = bot ship
 *   ~ten = test user (configured as ownerShip)
 */
import type { Story } from '@tloncorp/api';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  type TestFixtures,
  getFixtures,
  getGatewayRestartPreflight,
  registerEngagingTurn,
  requireFixtureGroup,
  waitFor,
} from '../lib/index.js';
import { type ReceivedCall, fakeModel } from '../support/fake-model/client.js';

describe('blobs', () => {
  let fixtures: TestFixtures;

  beforeAll(async () => {
    fixtures = await getFixtures();
  });

  beforeEach(async () => {
    // A test's trailing model call can still be in flight when its assertion
    // returns (awaitModelCall resolves on the FIRST recorded call). Resetting
    // the fake model then would clear the script and its allowExtraCalls
    // allowance out from under the active run, recreating the 400 error path
    // this file guards against (TLON-6287). Wait for the runtime to go idle
    // before resetting. Skipped in dev mode (run-dev.sh), which sets no
    // TEST_COMPOSE_FILE and never runs the gateway-status reload sequence.
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
          `Runtime not idle before fake-model reset — prior test's run still ` +
            `active: ${JSON.stringify(preflight.counts)} (${preflight.summary})`
        );
      }
    }
    await fakeModel.reset();
  });

  // ── Helpers ──────────────────────────────────────────────────────────

  function storyText(text: string): Story {
    return [{ inline: [text] }];
  }

  function storyTagged(key: string, text: string): Story {
    return [{ inline: [`[tlon-test:${key}] ${text}`] }];
  }

  function storyTaggedWithMention(
    ship: string,
    key: string,
    text: string
  ): Story {
    const normShip = ship.startsWith('~') ? ship : `~${ship}`;
    return [{ inline: [{ ship: normShip }, ` [tlon-test:${key}] ${text}`] }];
  }

  function voiceMemoBlob(transcriptionToken: string): string {
    return JSON.stringify([
      {
        type: 'voicememo',
        version: 1,
        fileUri:
          'https://storage.googleapis.com/tlon-test-ci-shared/test-audio/silence.m4a',
        size: 4096,
        duration: 3,
        transcription: `Test voice memo ${transcriptionToken}`,
      },
    ]);
  }

  function fileBlob(filenameToken: string): string {
    return JSON.stringify([
      {
        type: 'file',
        version: 1,
        fileUri:
          'https://storage.googleapis.com/tlon-test-ci-shared/test-images/openclaw-image.png',
        mimeType: 'image/png',
        name: `${filenameToken}.png`,
        size: 12345,
      },
    ]);
  }

  /** Wait for the fake model to record at least one call for `key`. */
  async function awaitModelCall(
    key: string,
    timeoutMs = 30_000
  ): Promise<ReceivedCall> {
    return waitFor(async () => {
      const calls = await fakeModel.received(key);
      return calls.length > 0 ? calls[0] : undefined;
    }, timeoutMs);
  }

  /** Find a parent post by author + matching text substring. */
  async function findParentPost(
    viewer: TestFixtures['userState'],
    channelId: string,
    authorId: string,
    bodySubstring: string,
    timeoutMs = 10_000
  ): Promise<{ id: string }> {
    return waitFor(async () => {
      const posts = await viewer.channelPosts(channelId, 10);
      const found = (posts ?? []).find((p) => {
        const pp = p as {
          id?: string;
          authorId?: string;
          textContent?: string | null;
        };
        return (
          pp.authorId === authorId &&
          (pp.textContent ?? '').includes(bodySubstring)
        );
      }) as { id?: string } | undefined;
      return found?.id ? { id: found.id } : undefined;
    }, timeoutMs);
  }

  // ── DM tests ─────────────────────────────────────────────────────────

  test('voice memo blob in a DM reaches the model with transcription', async () => {
    const key = 'blob-dm-voice';
    const transcriptionToken = `${key}-${Date.now().toString(36)}`;
    // All scripts in this file absorb one extra model call ({ allowExtraCalls: 1 }).
    // An exhausted-script 400 drives the runtime's error/abort path, which leaks
    // the reload-gate's reply/embedded-run accounting and starves the config
    // reload that 08-gateway-status depends on (TLON-6287). blob-ch-reply
    // deliberately produces two calls (parent mention + thread reply) against a
    // one-step script; the others can produce a trailing turn.
    await fakeModel.script(
      key,
      [{ kind: 'text', content: 'got the voice memo' }],
      { allowExtraCalls: 1 }
    );

    await fixtures.userState.sendPost({
      channelId: fixtures.botShip,
      content: storyTagged(key, 'voice memo attached'),
      blob: voiceMemoBlob(transcriptionToken),
    });

    const call = await awaitModelCall(key);
    expect(call.userText).toContain(transcriptionToken);
  });

  test('file blob in a DM reaches the model with filename', async () => {
    const key = 'blob-dm-file';
    const filenameToken = `${key}-${Date.now().toString(36)}`;
    await fakeModel.script(key, [{ kind: 'text', content: 'got the file' }], {
      allowExtraCalls: 1,
    });

    await fixtures.userState.sendPost({
      channelId: fixtures.botShip,
      content: storyTagged(key, 'what is in this file?'),
      blob: fileBlob(filenameToken),
    });

    const call = await awaitModelCall(key);
    expect(call.userText).toContain(`${filenameToken}.png`);
  });

  test('voice memo blob in a DM thread reply reaches the model', async () => {
    const key = 'blob-dm-reply';
    const transcriptionToken = `${key}-${Date.now().toString(36)}`;
    const parentMarker = `parent-${transcriptionToken}`;
    await fakeModel.script(key, [{ kind: 'text', content: 'got the reply' }], {
      allowExtraCalls: 1,
    });

    // Parent post is a thread anchor only (NO blob). Owner DMs always engage
    // the model, so the parent gets its OWN key — otherwise it would inherit
    // the last [tlon-test:KEY] still in the shared ~ten DM session history and
    // misroute. A distinct key keeps the assertion about the REPLY path
    // (`fakeModel.received(key)` below) while not bleeding a foreign key.
    const parentKey = 'blob-dm-reply-parent';
    // Unique reply text so we can wait for the bot to actually DELIVER the
    // parent reply (run completed), not merely start it.
    const parentAck = `blob-parent-ack-${Date.now().toString(36)}`;
    const parentTag = await registerEngagingTurn(parentKey, [
      { kind: 'text', content: parentAck },
    ]);
    await fixtures.userState.sendPost({
      channelId: fixtures.botShip,
      content: storyText(`${parentTag} ${parentMarker}`),
    });
    const parent = await findParentPost(
      fixtures.userState,
      fixtures.botShip,
      fixtures.userShip,
      parentMarker
    );
    // Wait for the parent RUN to fully settle (bot delivered its reply) before
    // sending the thread reply, so this stays a harness-correctness test rather
    // than an I2 concurrency test. Use a 30s budget (not findParentPost's 10s
    // default) — this is a full model round-trip delivery, matching the DM-thread
    // test's parent-settle wait, and 10s can be too tight under CI load.
    await findParentPost(
      fixtures.userState,
      fixtures.botShip,
      fixtures.botShip,
      parentAck,
      30_000
    );

    await fixtures.userState.sendReply({
      channelId: fixtures.botShip,
      parentId: parent.id,
      parentAuthor: fixtures.userShip,
      content: storyTagged(key, 'replying with voice'),
      blob: voiceMemoBlob(transcriptionToken),
    });

    // Any model call recorded under `key` must come from the reply path
    // (the parent was untagged). Assert the reply call's userText carries
    // the blob transcription — that's the actual plumbing under test.
    const call = await awaitModelCall(key);
    expect(call.userText).toContain(transcriptionToken);
  });

  // ── Channel tests ────────────────────────────────────────────────────

  test('voice memo blob in a channel post reaches the model', async () => {
    requireFixtureGroup(fixtures);
    const nest = fixtures.group.chatChannel;
    const key = 'blob-ch-voice';
    const transcriptionToken = `${key}-${Date.now().toString(36)}`;
    await fakeModel.script(
      key,
      [{ kind: 'text', content: 'got the channel voice memo' }],
      { allowExtraCalls: 1 }
    );

    await fixtures.userState.sendPost({
      channelId: nest,
      content: storyTaggedWithMention(
        fixtures.botShip,
        key,
        'voice memo attached'
      ),
      blob: voiceMemoBlob(transcriptionToken),
    });

    const call = await awaitModelCall(key);
    expect(call.userText).toContain(transcriptionToken);
  });

  test('file blob in a channel thread reply reaches the model', async () => {
    requireFixtureGroup(fixtures);
    const nest = fixtures.group.chatChannel;
    const key = 'blob-ch-reply';
    const filenameToken = `${key}-${Date.now().toString(36)}`;
    const parentMarker = `parent-${filenameToken}`;
    await fakeModel.script(
      key,
      [{ kind: 'text', content: 'got the channel reply' }],
      { allowExtraCalls: 1 }
    );

    await fixtures.userState.sendPost({
      channelId: nest,
      content: storyTaggedWithMention(fixtures.botShip, key, parentMarker),
    });
    const parent = await findParentPost(
      fixtures.botState,
      nest,
      fixtures.userShip,
      parentMarker
    );

    await fixtures.userState.sendReply({
      channelId: nest,
      parentId: parent.id,
      parentAuthor: fixtures.userShip,
      content: storyTaggedWithMention(fixtures.botShip, key, 'check this file'),
      blob: fileBlob(filenameToken),
    });

    // Both parent and reply produce calls under the same key. The parent's
    // call lands first and lacks the blob; if we waited for any call, we'd
    // race and assert against the parent's userText. Wait for the call
    // whose userText carries the reply's blob filename.
    const calls = await waitFor(async () => {
      const c = await fakeModel.received(key);
      const combined = c.map((x) => x.userText).join('\n');
      return combined.includes(`${filenameToken}.png`) ? c : undefined;
    }, 30_000);
    const combined = calls.map((c) => c.userText).join('\n');
    expect(combined).toContain(`${filenameToken}.png`);
  });
});
