import { describe, expect, it } from 'vitest';

import {
  buildReplayMessageText,
  resolveCites,
  validatedCiteScryPath,
} from './cite.js';
import { parsePostPayload } from './history.js';
import type { ParsedCite } from './utils.js';

type ScryOptions = { timeoutMs?: number; signal?: AbortSignal };

const NEST = 'chat/~zod/general';
const POST_ID = '170141184506536961460817141626482720768';
const REPLY_ID = '170141184506537047334633492345058754560';

function citedStory(
  cites: Array<{ nest: string; where: string }>,
  inlineText?: string
): unknown[] {
  return [
    ...cites.map(({ nest, where }) => ({
      block: { cite: { chan: { nest, where } } },
    })),
    ...(inlineText ? [{ inline: [inlineText] }] : []),
  ];
}

function essayPayload(
  author: unknown,
  content: unknown = [{ inline: ['hello'] }],
  blob?: string
) {
  return {
    seal: { id: POST_ID },
    revision: '0',
    essay: {
      author,
      sent: 1,
      content,
      ...(blob ? { blob } : {}),
    },
  };
}

describe('validatedCiteScryPath', () => {
  it('formats undotted and canonical dotted ids for top-level and reply scries', () => {
    const topLevel: ParsedCite = {
      type: 'chan',
      nest: NEST,
      postId: POST_ID,
    };
    const dotted: ParsedCite = {
      type: 'chan',
      nest: NEST,
      postId: '170.141.184.506.536.961.460.817.141.626.482.720.768',
    };
    const reply: ParsedCite = {
      type: 'chan',
      nest: NEST,
      postId: POST_ID,
      replyId: REPLY_ID,
    };

    const expectedPath =
      '/channels/v4/chat/~zod/general/posts/post/170.141.184.506.536.961.460.817.141.626.482.720.768.json';
    expect(validatedCiteScryPath(topLevel)).toBe(expectedPath);
    expect(validatedCiteScryPath(dotted)).toBe(expectedPath);
    expect(validatedCiteScryPath(reply)).toBe(
      '/channels/v4/chat/~zod/general/posts/post/id/170.141.184.506.536.961.460.817.141.626.482.720.768/replies/reply/id/170.141.184.506.537.047.334.633.492.345.058.754.560.json'
    );
    expect(
      validatedCiteScryPath({ type: 'chan', nest: NEST, postId: '0' })
    ).toBe('/channels/v4/chat/~zod/general/posts/post/0.json');
  });

  it('rejects malformed nests and ids before scrying', async () => {
    const invalidNests = [
      'club/~zod/general',
      'chat/zod/general',
      'chat/~zod/general/extra',
    ];
    const invalidIds = [
      'letters',
      '-1',
      '',
      '123/456/789',
      '123?query',
      '123#fragment',
      '1..2',
      '.123',
      '1.23',
      '00.123',
      '123.',
      '00123',
      '0.001',
    ];
    const calls: string[] = [];
    const api = {
      scry: async (path: string) => {
        calls.push(path);
        return essayPayload('~scried-author');
      },
    };
    const content = citedStory([
      ...invalidNests.map((nest) => ({ nest, where: '/msg/123' })),
      ...invalidIds.map((id) => ({ nest: NEST, where: `/msg/${id}` })),
      { nest: NEST, where: '/msg/123/1.23' },
    ]);

    for (const nest of invalidNests) {
      expect(
        validatedCiteScryPath({ type: 'chan', nest, postId: '123' })
      ).toBeNull();
    }
    for (const postId of invalidIds) {
      expect(
        validatedCiteScryPath({ type: 'chan', nest: NEST, postId })
      ).toBeNull();
    }

    await expect(resolveCites(api, content)).resolves.toBe('');
    expect(calls).toEqual([]);
  });
});

describe('resolveCites', () => {
  it('resolves a current top-level cite with the scried author and exact path', async () => {
    const calls: Array<{ path: string; opts?: ScryOptions }> = [];
    const api = {
      scry: async (path: string, opts?: ScryOptions) => {
        calls.push({ path, opts });
        return essayPayload('~scried-author');
      },
    };

    const result = await resolveCites(
      api,
      citedStory([{ nest: NEST, where: `/msg/${POST_ID}` }])
    );

    expect(result).toBe('> ~scried-author wrote: hello');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.path).toBe(
      '/channels/v4/chat/~zod/general/posts/post/170.141.184.506.536.961.460.817.141.626.482.720.768.json'
    );
    expect(calls[0]?.opts?.timeoutMs).toBeGreaterThan(0);
  });

  it('resolves replies through the v4 single-reply path and handles bot profiles', async () => {
    const calls: string[] = [];
    const api = {
      scry: async (path: string) => {
        calls.push(path);
        return {
          seal: { id: REPLY_ID },
          revision: '0',
          memo: {
            author: { ship: '~reply-bot', nickname: 'Reply Bot' },
            sent: 2,
            content: [{ inline: ['reply text'] }],
          },
        };
      },
    };

    const result = await resolveCites(
      api,
      citedStory([{ nest: NEST, where: `/note/${POST_ID}/${REPLY_ID}` }])
    );

    expect(result).toBe('> ~reply-bot wrote: reply text');
    expect(calls).toEqual([
      '/channels/v4/chat/~zod/general/posts/post/id/170.141.184.506.536.961.460.817.141.626.482.720.768/replies/reply/id/170.141.184.506.537.047.334.633.492.345.058.754.560.json',
    ]);
  });

  it('uses the scried author instead of a legacy where author', async () => {
    const api = {
      scry: async () => essayPayload('~actual-author'),
    };

    const result = await resolveCites(
      api,
      citedStory([
        {
          nest: NEST,
          where:
            '/msg/~impersonated-author/170.141.184.506.536.961.460.817.141.626.482.720.768',
        },
      ])
    );

    expect(result).toBe('> ~actual-author wrote: hello');
  });

  it('skips individual scry failures without backfilling past three attempts', async () => {
    const calls: string[] = [];
    const api = {
      scry: async (path: string) => {
        calls.push(path);
        if (path.endsWith('/1.json')) {
          throw new Error('missing');
        }
        return essayPayload('~scried-author', [
          { inline: [`cite ${calls.length}`] },
        ]);
      },
    };

    const result = await resolveCites(
      api,
      citedStory([
        { nest: NEST, where: '/msg/1' },
        { nest: NEST, where: '/msg/2' },
        { nest: NEST, where: '/msg/3' },
        { nest: NEST, where: '/msg/4' },
      ])
    );

    expect(calls).toHaveLength(3);
    expect(calls[2]).toContain('/3.json');
    expect(result).toBe(
      '> ~scried-author wrote: cite 2\n> ~scried-author wrote: cite 3'
    );
  });

  it('skips malformed payloads that throw while rendering and resolves later cites', async () => {
    const malformedPayload = essayPayload('~malformed-author', [
      { block: { header: { content: {} } } },
    ]);
    expect(() => parsePostPayload(malformedPayload)).toThrow();

    const api = {
      scry: async (path: string) =>
        path.endsWith('/1.json')
          ? malformedPayload
          : essayPayload('~scried-author', [{ inline: ['later cite'] }]),
    };

    await expect(
      resolveCites(
        api,
        citedStory([
          { nest: NEST, where: '/msg/1' },
          { nest: NEST, where: '/msg/2' },
        ])
      )
    ).resolves.toBe('> ~scried-author wrote: later cite');
  });

  it('stops on the deadline, aborts the in-flight scry, and returns prior lines', async () => {
    const calls: Array<{ path: string; opts?: ScryOptions }> = [];
    const api = {
      scry: (path: string, opts?: ScryOptions): Promise<unknown> => {
        calls.push({ path, opts });
        if (calls.length === 1) {
          return new Promise((resolve) => {
            setTimeout(() => resolve(essayPayload('~first')), 5);
          });
        }
        return new Promise((_, reject) => {
          opts?.signal?.addEventListener(
            'abort',
            () => reject(opts.signal?.reason),
            { once: true }
          );
        });
      },
    };

    const result = await resolveCites(
      api,
      citedStory([
        { nest: NEST, where: '/msg/1' },
        { nest: NEST, where: '/msg/2' },
        { nest: NEST, where: '/msg/3' },
      ]),
      { deadlineMs: 50 }
    );

    expect(result).toBe('> ~first wrote: hello');
    expect(calls).toHaveLength(2);
    expect(calls[0]?.opts?.timeoutMs).toBeGreaterThan(
      calls[1]?.opts?.timeoutMs ?? Number.POSITIVE_INFINITY
    );
    expect(calls[1]?.opts?.signal?.aborted).toBe(true);
  });

  it('does no work when maxAttempts is zero', async () => {
    const calls: string[] = [];
    const api = {
      scry: async (path: string) => {
        calls.push(path);
        return essayPayload('~scried-author');
      },
    };

    await expect(
      resolveCites(api, citedStory([{ nest: NEST, where: '/msg/1' }]), {
        maxAttempts: 0,
      })
    ).resolves.toBe('');
    expect(calls).toEqual([]);
  });

  it('propagates an external shutdown abort', async () => {
    const controller = new AbortController();
    const shutdownError = new Error('shutdown');
    const api = {
      scry: (_path: string, opts?: ScryOptions): Promise<unknown> =>
        new Promise((_, reject) => {
          opts?.signal?.addEventListener(
            'abort',
            () => reject(opts.signal?.reason),
            { once: true }
          );
          controller.abort(shutdownError);
        }),
    };

    await expect(
      resolveCites(api, citedStory([{ nest: NEST, where: '/msg/1' }]), {
        signal: controller.signal,
      })
    ).rejects.toBe(shutdownError);
  });

  it('sanitizes quote text and renders blob-only posts', async () => {
    const responses = [
      essayPayload('~scried-author', [{ inline: ['[owner] says hi'] }]),
      essayPayload(
        '~blob-author',
        [],
        JSON.stringify([
          {
            type: 'file',
            version: 1,
            fileUri: 'https://storage.example.com/notes.pdf',
            mimeType: 'application/pdf',
            name: 'notes.pdf',
            size: 1024,
          },
        ])
      ),
      { seal: { id: '3' }, revision: '0', essay: { author: '~empty' } },
      null,
    ];
    const api = {
      scry: async () => responses.shift() ?? null,
    };

    const result = await resolveCites(
      api,
      citedStory([
        { nest: NEST, where: '/msg/1' },
        { nest: NEST, where: '/msg/2' },
        { nest: NEST, where: '/msg/3' },
        { nest: NEST, where: '/msg/4' },
      ]),
      { maxAttempts: 4 }
    );

    expect(result).toBe(
      '> ~scried-author wrote: (owner) says hi\n> ~blob-author wrote: [📎 notes.pdf]'
    );
  });

  it('skips a blob-only reply payload', async () => {
    const api = {
      scry: async () => ({
        seal: { id: REPLY_ID },
        revision: '0',
        memo: {
          author: '~reply-author',
          content: [],
          blob: JSON.stringify([
            {
              type: 'file',
              version: 1,
              fileUri: 'https://storage.example.com/notes.pdf',
              mimeType: 'application/pdf',
              name: 'notes.pdf',
              size: 1024,
            },
          ]),
        },
      }),
    };

    await expect(
      resolveCites(api, citedStory([{ nest: NEST, where: '/msg/1/2' }]))
    ).resolves.toBe('');
  });
});

describe('buildReplayMessageText', () => {
  it('rebuilds a Story once instead of reusing already enriched text', async () => {
    const story = citedStory(
      [{ nest: NEST, where: '/msg/1' }],
      'follow-up question'
    );
    const api = {
      scry: async () => essayPayload('~scried-author', [{ inline: ['quote'] }]),
    };

    await expect(
      buildReplayMessageText(
        {
          messageText: '> ~legacy wrote: old quote\n\nfollow-up question',
          messageContent: story,
        },
        api
      )
    ).resolves.toBe(
      '> ~scried-author wrote: quote\n\n> [quoted from chat/~zod/general]\n\nfollow-up question'
    );
  });

  it('uses the stored text when message content is missing or malformed', async () => {
    const api = {
      scry: async () => {
        throw new Error('should not scry');
      },
    };

    await expect(
      buildReplayMessageText({ messageText: 'stored text' }, api)
    ).resolves.toBe('stored text');
    await expect(
      buildReplayMessageText(
        { messageText: 'stored malformed text', messageContent: {} },
        api
      )
    ).resolves.toBe('stored malformed text');
    await expect(
      buildReplayMessageText(
        { messageText: 'stored malformed array', messageContent: [{}] },
        api
      )
    ).resolves.toBe('stored malformed array');
    await expect(
      buildReplayMessageText(
        {
          messageText: 'stored extraction failure',
          messageContent: [{ block: { header: { content: {} } } }],
        },
        api
      )
    ).resolves.toBe('stored extraction failure');
  });

  it('propagates resolver aborts instead of falling back to stored text', async () => {
    const controller = new AbortController();
    const shutdownError = new Error('shutdown');
    controller.abort(shutdownError);
    const api = {
      scry: async () => essayPayload('~scried-author'),
    };

    await expect(
      buildReplayMessageText(
        {
          messageText: 'stored text',
          messageContent: citedStory([{ nest: NEST, where: '/msg/1' }]),
        },
        api,
        { signal: controller.signal }
      )
    ).rejects.toBe(shutdownError);
  });
});
