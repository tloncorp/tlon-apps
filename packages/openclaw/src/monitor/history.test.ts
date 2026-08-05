import { describe, expect, it, vi } from 'vitest';

import {
  type TlonHistoryEntry,
  buildThreadContextMessage,
  cacheMessage,
  fetchParentPostAuthor,
  fetchParentPostHistoryEntry,
  getChannelHistory,
  lookupCachedMessage,
  lookupOrFetchCachedChannelMessage,
  parsePostPayload,
  renderHistoryContent,
  retainThreadContextMessages,
} from './history.js';

function makeEntry(
  overrides: Partial<TlonHistoryEntry> = {}
): TlonHistoryEntry {
  return {
    author: '~zod',
    content: 'message',
    timestamp: 1,
    id: '1',
    ...overrides,
  };
}

describe('renderHistoryContent', () => {
  it('returns text content when no blob', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: 'Hello world',
      timestamp: Date.now(),
    };
    expect(renderHistoryContent(entry)).toBe('Hello world');
  });

  it('returns blob annotation when no text content', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: '',
      timestamp: Date.now(),
      blob: JSON.stringify([
        {
          type: 'voicememo',
          version: 1,
          fileUri: 'https://storage.example.com/memo.m4a',
          size: 51200,
          duration: 10,
          transcription: 'Hey there',
        },
      ]),
    };
    expect(renderHistoryContent(entry)).toBe('[🎙️ voice memo: "Hey there"]');
  });

  it('combines blob annotation with text content', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: 'Check this out',
      timestamp: Date.now(),
      blob: JSON.stringify([
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/notes.pdf',
          mimeType: 'application/pdf',
          name: 'notes.pdf',
          size: 245760,
        },
      ]),
    };
    const result = renderHistoryContent(entry);
    expect(result).toBe('[📎 notes.pdf]\nCheck this out');
  });

  it('surfaces voice memo transcript prominently in history', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: '',
      timestamp: Date.now(),
      blob: JSON.stringify([
        {
          type: 'voicememo',
          version: 1,
          fileUri: 'https://storage.example.com/deploy-issue.m4a',
          size: 76800,
          duration: 30,
          transcription: 'Can you look into the deploy issue from yesterday',
        },
      ]),
    };
    const result = renderHistoryContent(entry);
    expect(result).toContain(
      'Can you look into the deploy issue from yesterday'
    );
    expect(result).toContain('🎙️');
  });

  it('memoizes parsed blob data on the history entry', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: '',
      timestamp: Date.now(),
      blob: JSON.stringify([
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/notes.pdf',
          mimeType: 'application/pdf',
          name: 'notes.pdf',
          size: 245760,
        },
      ]),
    };

    expect(entry.parsedBlobData).toBeUndefined();
    expect(renderHistoryContent(entry)).toBe('[📎 notes.pdf]');
    expect(entry.parsedBlobData).toEqual([
      {
        type: 'file',
        version: 1,
        fileUri: 'https://storage.example.com/notes.pdf',
        mimeType: 'application/pdf',
        name: 'notes.pdf',
        size: 245760,
      },
    ]);

    const memoized = entry.parsedBlobData;
    expect(renderHistoryContent(entry)).toBe('[📎 notes.pdf]');
    expect(entry.parsedBlobData).toBe(memoized);
  });

  it('handles null/undefined blob gracefully', () => {
    expect(
      renderHistoryContent({
        author: '~zod',
        content: 'hi',
        timestamp: 0,
        blob: null,
      })
    ).toBe('hi');
    expect(
      renderHistoryContent({
        author: '~zod',
        content: 'hi',
        timestamp: 0,
        blob: undefined,
      })
    ).toBe('hi');
  });

  it('handles invalid blob JSON gracefully', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: 'text',
      timestamp: Date.now(),
      blob: 'not-valid-json',
    };
    expect(renderHistoryContent(entry)).toBe('text');
  });

  it('handles blob with only unknown types', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: '',
      timestamp: Date.now(),
      blob: JSON.stringify([{ type: 'unknown_future', version: 99 }]),
    };
    // Unknown types produce no output, and content is empty
    expect(renderHistoryContent(entry)).toBe('');
  });

  it('renders multiple blob entries with text', () => {
    const entry: TlonHistoryEntry = {
      author: '~zod',
      content: 'Here are the files',
      timestamp: Date.now(),
      blob: JSON.stringify([
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/a.pdf',
          mimeType: 'application/pdf',
          name: 'a.pdf',
          size: 1024,
        },
        {
          type: 'file',
          version: 1,
          fileUri: 'https://storage.example.com/b.txt',
          mimeType: 'text/plain',
          name: 'b.txt',
          size: 2048,
        },
      ]),
    };
    const result = renderHistoryContent(entry);
    expect(result).toBe('[📎 a.pdf]\n[📎 b.txt]\nHere are the files');
  });
});

describe('cacheMessage', () => {
  it('normalizes DM writ ids at the cache boundary and deduplicates the echo', async () => {
    const channel = `dm/~owner-${Date.now().toString(36)}`;
    const dottedTimestamp = '170.141.184.507.123';
    const bareTimestamp = '170141184507123';
    const sendTimeEntry = makeEntry({
      author: '~bot',
      content: 'send-time reply',
      id: `~bot/${dottedTimestamp}`,
    });

    cacheMessage(channel, sendTimeEntry);

    expect(lookupCachedMessage(channel, bareTimestamp)).toEqual(sendTimeEntry);
    expect(lookupCachedMessage(channel, `bot/${dottedTimestamp}`)).toEqual(
      sendTimeEntry
    );

    const echoEntry = makeEntry({
      author: '~bot',
      content: 'echoed reply',
      timestamp: 2,
      id: bareTimestamp,
    });
    cacheMessage(channel, echoEntry);

    expect(lookupCachedMessage(channel, `~bot/${dottedTimestamp}`)).toEqual(
      echoEntry
    );

    const scry = vi.fn(async () => []);
    await getChannelHistory({ scry }, channel, 2);
    expect(scry).toHaveBeenCalledOnce();
  });

  it('resolves a reaction before the echo and upserts the host-assigned post id', async () => {
    const channel = `chat/~zod/cache-upsert-${Date.now().toString(36)}`;
    const clientSentId = '~zod/170.141.184.507.123';
    const hostPostId = '170141184507999';
    const hostPostIdWithDots = '170.141.184.507.999';
    const scry = vi.fn(async () => ({
      essay: {
        author: '~zod',
        sent: 1,
        content: [{ inline: ['reaction-target content'] }],
      },
      seal: { id: hostPostIdWithDots },
    }));

    // Channel hosts assign a different id than the client's send timestamp,
    // so no fabricated send-time entry can satisfy this reaction lookup.
    expect(lookupCachedMessage(channel, clientSentId)).toBeUndefined();
    const reactionTarget = await lookupOrFetchCachedChannelMessage(
      { scry },
      channel,
      hostPostId
    );
    expect(reactionTarget).toMatchObject({
      author: '~zod',
      content: 'reaction-target content',
      id: hostPostIdWithDots,
    });
    expect(scry).toHaveBeenCalledWith(
      `/channels/v4/${channel}/posts/post/${hostPostIdWithDots}.json`
    );

    cacheMessage(channel, {
      author: '~zod',
      content: 'echo-fresh content',
      timestamp: 2,
      id: hostPostIdWithDots,
    });

    expect(lookupCachedMessage(channel, hostPostId)).toMatchObject({
      content: 'echo-fresh content',
      timestamp: 2,
    });
    await expect(
      getChannelHistory({ scry: async () => ({}) }, channel, 1)
    ).resolves.toEqual([
      expect.objectContaining({
        id: hostPostIdWithDots,
        content: 'echo-fresh content',
      }),
    ]);
  });

  it('uses an echo that arrives during a target fetch without retaining a stale target', async () => {
    const channel = `chat/~zod/reaction-fetch-race-${Date.now().toString(36)}`;
    const oldPostId = '170141184507111';
    const oldPostIdWithDots = '170.141.184.507.111';
    let resolveScry: ((value: unknown) => void) | undefined;
    const scry = vi.fn(
      () =>
        new Promise<unknown>((resolve) => {
          resolveScry = resolve;
        })
    );

    const targetLookup = lookupOrFetchCachedChannelMessage(
      { scry },
      channel,
      oldPostId
    );
    expect(scry).toHaveBeenCalledOnce();

    const echoEntry = makeEntry({
      author: '~nec',
      content: 'echoed old reaction target',
      timestamp: 1,
      id: oldPostIdWithDots,
    });
    cacheMessage(channel, echoEntry);

    if (!resolveScry) {
      throw new Error('reaction target scry did not start');
    }
    resolveScry({
      essay: {
        author: '~nec',
        sent: 1,
        content: [{ inline: ['stale fetched reaction target'] }],
      },
      seal: { id: oldPostIdWithDots },
    });

    await expect(targetLookup).resolves.toBe(echoEntry);
    expect(lookupCachedMessage(channel, oldPostId)).toBe(echoEntry);

    for (let index = 0; index < 100; index++) {
      cacheMessage(
        channel,
        makeEntry({ id: `newer-message-${index}`, timestamp: index + 2 })
      );
    }

    expect(lookupCachedMessage(channel, oldPostId)).toBeUndefined();
  });

  it('bounds fetched reaction targets to 20 entries per channel', async () => {
    const channel = `chat/~zod/reaction-target-bound-${Date.now().toString(36)}`;
    const targetIds = Array.from(
      { length: 21 },
      (_, index) => `170141184507${String(index).padStart(3, '0')}`
    );
    const scry = vi.fn(async (path: string) => {
      const id = path.match(/posts\/post\/(.+)\.json$/)?.[1] ?? '';
      return {
        essay: {
          author: '~nec',
          sent: 1,
          content: [{ inline: [`reaction target ${id}`] }],
        },
        seal: { id },
      };
    });

    for (const targetId of targetIds) {
      await lookupOrFetchCachedChannelMessage({ scry }, channel, targetId);
    }

    expect(scry).toHaveBeenCalledTimes(21);
    expect(lookupCachedMessage(channel, targetIds[0]!)).toBeUndefined();
    expect(
      targetIds
        .slice(1)
        .map((targetId) => lookupCachedMessage(channel, targetId))
        .filter(Boolean)
    ).toHaveLength(20);
  });

  it('retries a rejected reaction-target lookup, then leaves it unresolved', async () => {
    const scry = vi.fn(async () => {
      throw new Error('scry unavailable');
    });

    await expect(
      lookupOrFetchCachedChannelMessage(
        { scry },
        `chat/~zod/reaction-rejected-${Date.now().toString(36)}`,
        '170141184507999'
      )
    ).resolves.toBeUndefined();

    expect(scry).toHaveBeenCalledTimes(3);
  });

  it('retries a not-found reaction target, then leaves it unresolved', async () => {
    const scry = vi.fn(async () => ({}));

    await expect(
      lookupOrFetchCachedChannelMessage(
        { scry },
        `chat/~zod/reaction-not-found-${Date.now().toString(36)}`,
        '170141184507999'
      )
    ).resolves.toBeUndefined();

    expect(scry).toHaveBeenCalledTimes(3);
  });

  it('preserves an author for a textless reaction target', async () => {
    const scry = vi.fn(async () => ({
      essay: {
        author: '~zod',
        sent: 1,
        content: [],
      },
      seal: { id: '170.141.184.507.999' },
    }));

    await expect(
      lookupOrFetchCachedChannelMessage(
        { scry },
        `chat/~zod/reaction-textless-${Date.now().toString(36)}`,
        '170141184507999'
      )
    ).resolves.toMatchObject({
      author: '~zod',
      content: '',
      id: '170.141.184.507.999',
    });

    expect(scry).toHaveBeenCalledTimes(1);
  });

  it('resolves a reply reaction before its echo through the exact reply route', async () => {
    const channel = `chat/~zod/reply-reaction-${Date.now().toString(36)}`;
    const rootPostId = '170141184507111';
    const replyId = '170141184507222';
    const rootPostIdWithDots = '170.141.184.507.111';
    const replyIdWithDots = '170.141.184.507.222';
    const scry = vi.fn(async () => ({
      seal: { id: replyIdWithDots, 'parent-id': rootPostIdWithDots },
      revision: '1',
      memo: {
        author: '~zod',
        sent: 1,
        content: [{ inline: ['reply reaction target content'] }],
      },
    }));

    expect(lookupCachedMessage(channel, replyId)).toBeUndefined();
    await expect(
      lookupOrFetchCachedChannelMessage({ scry }, channel, replyId, rootPostId)
    ).resolves.toMatchObject({
      author: '~zod',
      content: 'reply reaction target content',
      id: replyIdWithDots,
    });

    expect(scry).toHaveBeenCalledWith(
      `/channels/v4/${channel}/posts/post/id/${rootPostIdWithDots}/replies/reply/id/${replyIdWithDots}.json`
    );
  });

  it('preserves an author for a textless reply reaction target', async () => {
    const channel = `chat/~zod/textless-reply-reaction-${Date.now().toString(36)}`;
    const rootPostId = '170141184507111';
    const replyId = '170141184507222';
    const scry = vi.fn(async () => ({
      seal: { id: '170.141.184.507.222' },
      memo: {
        author: { ship: '~nec', nickname: 'Nec' },
        sent: 1,
        content: [],
      },
    }));

    await expect(
      lookupOrFetchCachedChannelMessage({ scry }, channel, replyId, rootPostId)
    ).resolves.toMatchObject({
      author: '~nec',
      content: '',
      id: '170.141.184.507.222',
    });

    expect(scry).toHaveBeenCalledTimes(1);
  });
});

describe('fetchParentPostHistoryEntry', () => {
  it('extracts an author from a media-only parent post', async () => {
    const api = {
      scry: async () => ({
        essay: {
          author: { ship: '~nec', nickname: 'Nec' },
          sent: 123,
          content: [],
          blob: '[{"type":"file","version":1}]',
        },
        seal: { id: '170.141.184.507' },
      }),
    };

    const author = await fetchParentPostAuthor(
      api,
      'chat/~ship/general',
      '170141184507'
    );

    expect(author).toBe('~nec');
  });

  it('extracts parent post text from memo-shaped post payloads', async () => {
    const api = {
      scry: async () => ({
        memo: {
          author: '~nec',
          sent: 123,
          content: [{ inline: ['Parent post from memo'] }],
        },
        seal: { id: '170.141.184.507.939.843.704.966.283.402.546.249.728' },
      }),
    };

    const entry = await fetchParentPostHistoryEntry(
      api,
      'diary/~ship/plans',
      '170141184507939843704966283402546249728'
    );

    expect(entry).toEqual({
      author: '~nec',
      content: 'Parent post from memo',
      timestamp: 123,
      id: '170.141.184.507.939.843.704.966.283.402.546.249.728',
    });
  });

  it('scries the channels-app post path with @ud-formatted id and .json mark', async () => {
    const calls: string[] = [];
    const api = {
      scry: async (path: string) => {
        calls.push(path);
        return {
          essay: {
            author: '~nec',
            sent: 42,
            content: [{ inline: ['hi'] }],
          },
          seal: { id: '170.141.184.507.939.843.704.966.283.402.546.249.728' },
        };
      },
    };

    await fetchParentPostHistoryEntry(
      api,
      'diary/~dirmec-dolbes-finned-palmer/tf4e505c',
      '170141184507939843704966283402546249728'
    );

    expect(calls).toEqual([
      '/channels/v4/diary/~dirmec-dolbes-finned-palmer/tf4e505c/posts/post/170.141.184.507.939.843.704.966.283.402.546.249.728.json',
    ]);
  });

  it('parses the channel-post JSON shape (essay + seal at root)', async () => {
    const api = {
      scry: async () => ({
        seal: {
          id: '170.141.184.507.939.843.704.966.283.402.546.249.728',
          seq: 1,
        },
        revision: '0',
        essay: {
          author: '~nec',
          sent: 999,
          content: [{ inline: ['Heartbeat'] }],
        },
        type: 'post',
      }),
    };

    const entry = await fetchParentPostHistoryEntry(
      api,
      'diary/~ship/plans',
      '170141184507939843704966283402546249728'
    );

    expect(entry).toEqual({
      author: '~nec',
      content: 'Heartbeat',
      timestamp: 999,
      id: '170.141.184.507.939.843.704.966.283.402.546.249.728',
    });
  });

  it('extracts a parent author from a bot profile', async () => {
    const api = {
      scry: async () => ({
        essay: {
          author: { ship: '~nec', nickname: 'Nec' },
          sent: 123,
          content: [{ inline: ['Parent post'] }],
        },
        seal: { id: '170.141.184.507' },
      }),
    };

    const entry = await fetchParentPostHistoryEntry(
      api,
      'chat/~ship/general',
      '170141184507'
    );

    expect(entry?.author).toBe('~nec');
  });
});

describe('parsePostPayload', () => {
  it('returns a text-less essay node with its source author', () => {
    expect(
      parsePostPayload({
        seal: { id: '1' },
        essay: { author: '~nec', content: [] },
      })
    ).toEqual({
      sourceAuthor: '~nec',
      entry: {
        author: '~nec',
        content: '',
        timestamp: expect.any(Number),
        id: '1',
        blob: null,
      },
    });
  });

  it('uses unknown only for history entry author when source author is absent', () => {
    const parsed = parsePostPayload({
      seal: { id: '1' },
      essay: { content: [{ inline: ['anonymous'] }] },
    });

    expect(parsed?.sourceAuthor).toBeNull();
    expect(parsed?.entry.author).toBe('unknown');
  });

  it('preserves parent-author and text-only history behavior', async () => {
    const authorlessApi = {
      scry: async () => ({
        seal: { id: '1' },
        essay: { content: [{ inline: ['anonymous'] }] },
      }),
    };
    const blobOnlyApi = {
      scry: async () => ({
        seal: { id: '1' },
        essay: {
          author: '~nec',
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
      fetchParentPostAuthor(authorlessApi, 'chat/~zod/general', '1')
    ).resolves.toBeNull();
    await expect(
      fetchParentPostHistoryEntry(blobOnlyApi, 'chat/~zod/general', '1')
    ).resolves.toBeNull();
  });

  it('preserves essay.blob on a post payload', () => {
    const blob = JSON.stringify([{ type: 'file', version: 1 }]);
    expect(
      parsePostPayload({
        seal: { id: '1' },
        essay: { author: '~nec', sent: 5, content: [], blob },
      })?.entry.blob
    ).toBe(blob);
  });

  it('nulls blob on a reply payload even when a stray blob key is present', () => {
    expect(
      parsePostPayload({
        seal: { id: '2' },
        memo: {
          author: '~nec',
          sent: 5,
          content: [{ inline: ['reply'] }],
          blob: JSON.stringify([{ type: 'file', version: 1 }]),
        },
      })?.entry.blob
    ).toBeNull();
  });
});

describe('retainThreadContextMessages', () => {
  it('keeps parent plus last N-1 replies when truncating', () => {
    const history = [
      makeEntry({ id: 'parent', content: 'PARENT', timestamp: 0 }),
      ...Array.from({ length: 25 }, (_, index) =>
        makeEntry({
          id: `reply-${index + 1}`,
          content: `reply ${index + 1}`,
          timestamp: index + 1,
        })
      ),
    ];

    const retained = retainThreadContextMessages(history, 20);

    expect(retained).toHaveLength(20);
    expect(retained[0]?.content).toBe('PARENT');
    expect(retained.slice(1).map((entry) => entry.content)).toEqual(
      Array.from({ length: 19 }, (_, index) => `reply ${index + 7}`)
    );
  });
});

describe('buildThreadContextMessage', () => {
  it('includes the parent post body in the emitted previous-messages block', () => {
    const history = [
      makeEntry({
        author: '~nec',
        content: 'Heartbeat to System Cron Migration Plan',
        id: 'parent',
      }),
      makeEntry({
        author: '~zod',
        content: 'latest reply',
        id: 'reply-1',
        timestamp: 2,
      }),
    ];

    const result = buildThreadContextMessage(history, 'hello?', {
      formatAuthor: (author) => author,
      sanitizeContent: (content) => content,
    });

    expect(result).not.toBeNull();
    expect(result?.contextMessages).toEqual(history);
    expect(result?.messageText).toContain('[Previous messages]');
    expect(result?.messageText).toContain(
      '~nec: Heartbeat to System Cron Migration Plan'
    );
    expect(result?.messageText).toContain('~zod: latest reply');
    expect(result?.messageText).toContain('[Current message]\nhello?');
  });
});
