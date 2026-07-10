import { describe, expect, it } from 'vitest';

import {
  type TlonHistoryEntry,
  buildThreadContextMessage,
  fetchParentPostAuthor,
  fetchParentPostHistoryEntry,
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

describe('fetchParentPostHistoryEntry', () => {
  it('extracts an author from a media-only parent post', async () => {
    const api = {
      scry: async () => ({
        post: {
          essay: {
            author: { ship: '~nec', nickname: 'Nec' },
            sent: 123,
            content: [],
            blob: '[{"type":"file","version":1}]',
          },
          seal: { id: '170.141.184.507' },
        },
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
        post: {
          memo: {
            author: '~nec',
            sent: 123,
            content: [{ inline: ['Parent post from memo'] }],
          },
          seal: { id: '170.141.184.507.939.843.704.966.283.402.546.249.728' },
        },
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
        post: {
          essay: {
            author: { ship: '~nec', nickname: 'Nec' },
            sent: 123,
            content: [{ inline: ['Parent post'] }],
          },
          seal: { id: '170.141.184.507' },
        },
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
