import { browserWalletCard } from '@tloncorp/api/client/browserWallet';
import { convertContent } from '@tloncorp/api/client/postContent';

import { describe, expect, it } from 'bun:test';

import type { PostSendInput, PostsApi } from './posts';
import { type BrowserDeps, run as runCommand } from './browser';

function run(args: string[], deps: BrowserDeps) {
  return runCommand(
    ['handoff', 'approve-login'].includes(args[0])
      ? [...args, '--service-result']
      : args,
    deps
  );
}

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
    getPostWithReplies: async () => {
      throw new Error('not used by browser handoff');
    },
    deleteReply: async () => {},
    setOrder: async () => {},
  };
  const deps: BrowserDeps = {
    browserWalletCard,
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
  it.each(['handoff', 'approve-login'])(
    'refuses %s without service-managed result delivery',
    async (command) => {
      const context = makeDeps();
      expect(
        await runCommand(
          [command, 'https://browser-session.tlon.network/s/payload.signature'],
          context.deps
        )
      ).toBe(1);
      expect(context.sent).toEqual([]);
      expect(context.stderr.join('')).toContain(
        'requires service result delivery'
      );
    }
  );

  it.each([
    { args: ['--help'] },
    { args: ['handoff', '--help'] },
    { args: ['handoff', '-h'] },
  ])(
    'directs browser help to the handle-based OpenClaw tool (%j)',
    async ({ args }) => {
      const context = makeDeps();
      expect(await run([...args], context.deps)).toBe(0);
      const help = context.stdout.join('');
      expect(help).toContain('Tlon tool: browser handoff <session_id>');
      expect(help).toContain('--fields <JSON array>');
      expect(help).toContain('Both secure-entry commands require --fields');
      expect(help).toContain(String.raw`Owner\u0027s email address`);
      expect(help).toContain('session ID from browser_session_create');
      expect(help).not.toContain('<signed-viewer-url>');
      expect(help).not.toContain('https://');
      expect(context.sent).toEqual([]);
    }
  );

  it('shows a valid model tool JSON example with selected snapshot refs', async () => {
    const context = makeDeps();
    expect(await run(['--help'], context.deps)).toBe(0);
    const json = context.stdout
      .join('')
      .match(/Tlon tool call:\n\s*(\{.*\})/)?.[1];
    expect(json).toBeDefined();
    expect(JSON.parse(json!)).toEqual({
      command: 'browser handoff <session_id> --fields \'["@e12","@e13"]\'',
    });
    expect(context.sent).toEqual([]);
  });

  it('directs shell session handles to the model tool without authenticating', async () => {
    const context = makeDeps();
    let authenticated = false;
    context.deps.authenticate = async () => {
      authenticated = true;
    };
    expect(await run(['handoff', 'calm-blue-fox'], context.deps)).toBe(1);
    expect(context.stderr.join('')).toContain(
      'Tlon tool: browser handoff <session_id>'
    );
    expect(authenticated).toBe(false);
    expect(context.sent).toEqual([]);
  });

  it('sends a saved-login approval card with the requested account and no credential fields', async () => {
    const context = makeDeps();
    const choice = { id: '8e40b5f5-fd41-4851-8922-b9545e470d6e', revision: 3 };
    expect(
      await run(
        [
          'approve-login',
          'https://browser-session.tlon.network/s/payload.signature',
          '--record',
          JSON.stringify(choice),
        ],
        context.deps
      )
    ).toBe(0);
    const [entry] = JSON.parse(context.sent[0].blob!);
    expect(entry).toMatchObject({
      type: 'browser-secure-entry',
      loginApproval: { record: choice },
    });
    expect(JSON.stringify(context.sent[0])).not.toContain(
      'The browser needs information'
    );
    expect(
      JSON.stringify(
        convertContent(context.sent[0].content, context.sent[0].blob)
      )
    ).toContain('loginApproval');
  });

  it.each([2048, 2049])(
    'checks the renderer URL length limit (%s characters)',
    async (length) => {
      const context = makeDeps();
      let authenticated = false;
      context.deps.authenticate = async () => {
        authenticated = true;
      };
      const prefix = 'https://browser-session.tlon.network/s/';
      const viewerUrl = `${prefix}${'a'.repeat(length - prefix.length - 2)}.b`;
      expect(viewerUrl).toHaveLength(length);
      expect(await run(['handoff', viewerUrl], context.deps)).toBe(
        length === 2048 ? 0 : 1
      );
      expect(authenticated).toBe(length === 2048);
      expect(context.sent).toHaveLength(length === 2048 ? 1 : 0);
    }
  );

  it.each([
    'browser-session-us-east5-cluster1.tlon.network',
    'browser-session-ovh-test-1.test.tlon.systems',
    'browser-session.tlon.network',
    'session-viewer.tlon.network',
    'browser-session.test.tlon.systems',
    'session-viewer.test.tlon.systems',
  ])('accepts a trusted viewer host: %s', async (host) => {
    const context = makeDeps();
    expect(
      await run(
        ['handoff', `https://${host}/s/payload.signature`],
        context.deps
      )
    ).toBe(0);
    expect(context.sent).toHaveLength(1);
  });

  it.each([
    'browser-session.tlon.network.attacker.example',
    'session-viewer.attacker.tlon.network',
    'browser-session-ovh1.attacker.tlon.network',
  ])('rejects a misleading viewer host: %s', async (host) => {
    const context = makeDeps();
    expect(
      await run(
        ['handoff', `https://${host}/s/payload.signature`],
        context.deps
      )
    ).toBe(1);
    expect(context.sent).toHaveLength(0);
  });

  it.each(['login', 'otp', 'details'])(
    'includes %s presentation in the typed card',
    async (purpose) => {
      const context = makeDeps();
      const presentation = { purpose, site: 'wikipedia.org' };
      expect(
        await run(
          [
            'handoff',
            'https://browser-session.tlon.network/s/payload.signature',
            '--presentation',
            JSON.stringify(presentation),
          ],
          context.deps
        )
      ).toBe(0);
      expect(JSON.parse(context.sent[0].blob!)[0].presentation).toEqual(
        presentation
      );
    }
  );

  it('sends a native credential card to the configured owner', async () => {
    const context = makeDeps();
    const viewerUrl =
      'https://browser-session-ovh1.tlon.network/s/payload.signature';

    expect(await run(['handoff', viewerUrl], context.deps)).toBe(0);
    expect(context.stderr).toEqual([]);
    expect(context.stdout.join('')).toBe(
      '✓ Secure browser form sent to ~owner\n'
    );
    expect(context.sent).toHaveLength(1);
    expect(context.sent[0]).toMatchObject({
      channelId: '~owner',
      authorId: '~bot',
      sentAt: 1234,
      botProfile: { nickname: null, avatar: null },
    });

    const [entry] = JSON.parse(context.sent[0].blob ?? '[]');
    expect(entry).toEqual({
      type: 'browser-secure-entry',
      version: 1,
      viewerUrl,
    });
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

describe('browser share', () => {
  it('sends a typed session card to the owner without a raw inline link', async () => {
    const context = makeDeps();
    const viewerUrl =
      'https://browser-session.tlon.network/s/payload.signature';
    expect(await run(['share', viewerUrl], context.deps)).toBe(0);
    expect(context.sent).toHaveLength(1);
    const post = context.sent[0];
    expect(post.channelId).toBe('~owner');
    expect(post.authorId).toBe('~bot');
    expect(JSON.parse(post.blob!)).toEqual([
      { type: 'browser-session', version: 1, viewerUrl },
    ]);
    expect(JSON.stringify(post.content)).not.toContain(viewerUrl);
    expect(convertContent(post.content, post.blob)[0]).toMatchObject({
      type: 'browser-card',
    });
  });
  it.each([
    { args: ['share', 'https://attacker.example/s/payload.signature'] },
    { args: ['share', 'calm-blue-fox'] },
    {
      args: [
        'share',
        'https://browser-session.tlon.network/s/payload.signature',
        '~other',
      ],
    },
  ])('rejects invalid sharing arguments %j', async ({ args }) => {
    const context = makeDeps();
    expect(await run([...args], context.deps)).toBe(1);
    expect(context.sent).toHaveLength(0);
  });
});

describe('wallet card delivery', () => {
  it('sends an opaque request to the configured owner without consent URLs', async () => {
    const context = makeDeps('~ten');
    const id = '11111111-1111-4111-8111-111111111111';
    expect(await run(['wallet', id], context.deps)).toBe(0);
    expect(context.sent).toHaveLength(1);
    expect(context.sent[0].channelId).toBe('~ten');
    const content = JSON.stringify(
      convertContent(context.sent[0].content, context.sent[0].blob)
    );
    expect(content).toContain('browserWallet');
    expect(content).toContain(id);
    expect(content).not.toContain('https://');
    expect(content).not.toContain('viewerUrl');
  });
});
