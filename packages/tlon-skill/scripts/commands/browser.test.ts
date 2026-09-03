import { describe, expect, it } from 'bun:test';

import type { PostSendInput, PostsApi } from './posts';
import { type BrowserDeps, run } from './browser';

function makeDeps(ownerShip = '~owner') {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const sent: PostSendInput[] = [];
  const postsApi: PostsApi = {
    addReaction: async () => {},
    removeReaction: async () => {},
    deletePost: async () => {},
    editPost: async () => {},
    sendPost: async (input) => {
      sent.push(input);
    },
    sendReply: async () => {},
    getChannelPosts: async () => ({ posts: [] }),
  };
  const deps: BrowserDeps = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
    authenticate: async () => {},
    getCurrentUserId: () => '~bot',
    now: () => 1234,
    postsApi,
    getOwnerShip: () => ownerShip,
  };
  return { deps, stdout, stderr, sent };
}

describe('browser handoff', () => {
  it('sends a native credential card to the configured owner', async () => {
    const context = makeDeps();
    const viewerUrl =
      'https://browser-session-ovh1.tlon.network/s/payload.signature';

    expect(await run(['handoff', viewerUrl], context.deps)).toBe(0);
    expect(context.stderr).toEqual([]);
    expect(context.stdout.join('')).toBe(
      '✓ Browser login handoff sent to ~owner\n'
    );
    expect(context.sent).toHaveLength(1);
    expect(context.sent[0]).toMatchObject({
      channelId: '~owner',
      authorId: '~bot',
      sentAt: 1234,
      botProfile: { nickname: null, avatar: null },
    });

    const [entry] = JSON.parse(context.sent[0].blob ?? '[]');
    expect(entry).toMatchObject({
      type: 'a2ui',
      version: 1,
      storyMode: 'fallback',
    });
    const components = entry.messages[1].updateComponents.components;
    expect(components).not.toContainEqual(
      expect.objectContaining({ text: 'SECURE BROWSER HANDOFF' })
    );
    expect(components).toContainEqual(
      expect.objectContaining({
        id: 'privacy-direct',
        text: 'Your credentials go directly to the live browser.',
      })
    );
    expect(components).toContainEqual(
      expect.objectContaining({
        id: 'privacy-context',
        text: 'They are never posted to chat or returned to the bot.',
      })
    );
  });

  it('refuses untrusted viewer URLs before authenticating', async () => {
    let authenticated = false;
    const context = makeDeps();
    context.deps.authenticate = async () => {
      authenticated = true;
    };

    expect(
      await run(
        ['handoff', 'https://attacker.example/s/payload.signature'],
        context.deps
      )
    ).toBe(1);
    expect(authenticated).toBe(false);
    expect(context.sent).toEqual([]);
  });

  it('refuses any attempt to override the owner recipient', async () => {
    const context = makeDeps();
    expect(
      await run(
        [
          'handoff',
          'https://browser-session-east5.tlon.network/s/payload.signature',
          '--to',
          '~requester',
        ],
        context.deps
      )
    ).toBe(1);
    expect(context.sent).toEqual([]);
  });
});
