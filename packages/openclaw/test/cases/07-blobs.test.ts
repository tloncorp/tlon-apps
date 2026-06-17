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
 *
 * @tlon-e2e openclaw: blob.dm_voice_context, blob.dm_file_context, blob.dm_thread_voice_context, blob.channel_voice_context, blob.channel_thread_file_context
 */
import type { Story } from '@tloncorp/api';
import { beforeAll, beforeEach, describe, expect, test } from 'vitest';

import {
  type TestFixtures,
  getFixtures,
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
    bodySubstring: string
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
    }, 10_000);
  }

  // ── DM tests ─────────────────────────────────────────────────────────

  test('voice memo blob in a DM reaches the model with transcription', async () => {
    const key = 'blob-dm-voice';
    const transcriptionToken = `${key}-${Date.now().toString(36)}`;
    await fakeModel.script(key, [
      { kind: 'text', content: 'got the voice memo' },
    ]);

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
    await fakeModel.script(key, [{ kind: 'text', content: 'got the file' }]);

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
    await fakeModel.script(key, [{ kind: 'text', content: 'got the reply' }]);

    // Parent post is a thread anchor only — UNTAGGED and NO blob. The
    // bot will still process it (owner DMs always engage) but that call
    // hits the fake-model without a [tlon-test:KEY] tag and is recorded
    // under key=null, so it can't satisfy fakeModel.received(key) below.
    // This guarantees the assertion is about the REPLY path, not the
    // parent path.
    await fixtures.userState.sendPost({
      channelId: fixtures.botShip,
      content: storyText(parentMarker),
    });
    const parent = await findParentPost(
      fixtures.userState,
      fixtures.botShip,
      fixtures.userShip,
      parentMarker
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
    await fakeModel.script(key, [
      { kind: 'text', content: 'got the channel voice memo' },
    ]);

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
    await fakeModel.script(key, [
      { kind: 'text', content: 'got the channel reply' },
    ]);

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
