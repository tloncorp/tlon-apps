import { describe, expect, it } from 'bun:test';

import { renderPostJsonLine, renderPostListJsonLines } from './message-content';

describe('renderPostJsonLine', () => {
  const base = {
    id: 'post-1',
    authorId: '~zod',
    sentAt: 1724200000000,
    parentId: null,
    blob: null,
  };
  const post = (extra: Record<string, unknown>) =>
    ({ ...base, ...extra }) as never;

  it('emits one compact record with the story content parsed', () => {
    expect(
      renderPostJsonLine(
        post({
          parentId: 'parent-1',
          content: JSON.stringify([{ inline: ['hi'] }]),
        })
      )
    ).toBe(
      '{"id":"post-1","authorId":"~zod","sentAt":1724200000000,' +
        '"receivedAt":null,"annotated":false,' +
        '"parentId":"parent-1","blob":null,"content":[{"inline":["hi"]}]}'
    );
  });

  it('carries content it cannot parse through verbatim', () => {
    expect(
      JSON.parse(renderPostJsonLine(post({ content: 'not json at all' })))
    ).toEqual({
      ...base,
      receivedAt: null,
      annotated: false,
      content: 'not json at all',
    });
  });

  it('keeps a group reference verse intact', () => {
    const content = [
      { type: 'reference', referenceType: 'group', groupId: '~host/slug' },
      { inline: ['see this'] },
    ];
    const record = JSON.parse(
      renderPostJsonLine(post({ content: JSON.stringify(content) }))
    );

    expect(record.content).toEqual(content);
  });

  it('carries a non-story JSON value through verbatim', () => {
    expect(
      JSON.parse(renderPostJsonLine(post({ content: '{"a":1}' }))).content
    ).toBe('{"a":1}');
  });

  it('passes a file blob through and nulls an absent blob', () => {
    const blob = JSON.stringify([
      { type: 'file', version: 1, name: 'a.pdf', mimeType: 'application/pdf' },
    ]);
    expect(
      JSON.parse(
        renderPostJsonLine(post({ blob, content: JSON.stringify([]) }))
      ).blob
    ).toBe(blob);

    const line = renderPostJsonLine({
      id: 'post-2',
      authorId: '~zod',
      sentAt: 1724200000000,
      parentId: null,
      content: JSON.stringify([]),
    } as never);
    expect(line).toContain('"blob":null');

    expect(
      JSON.parse(
        renderPostJsonLine(post({ blob: '', content: JSON.stringify([]) }))
      ).blob
    ).toBe('');
  });

  it('redacts browser capabilities from the blob', () => {
    const viewerUrl =
      'https://browser-session.tlon.network/s/private.signature';
    const fillUrl =
      'https://browser-session.tlon.network/credential-fills/private-handle';
    const blob = JSON.stringify([
      {
        type: 'a2ui',
        version: 1,
        messages: [
          {
            version: 'v0.9',
            updateComponents: {
              surfaceId: 'login',
              root: 'open',
              components: [
                {
                  id: 'open',
                  component: 'Button',
                  action: {
                    event: {
                      name: 'tlon.navigate',
                      context: {
                        target: {
                          type: 'screen',
                          screen: 'browserCredentialHandoff',
                          viewerUrl,
                        },
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
        future: [{ fillUrl }],
      },
    ]);

    const line = renderPostJsonLine(
      post({ blob, content: JSON.stringify([]) })
    );

    expect(line).not.toContain('private.signature');
    expect(line).not.toContain('private-handle');
    const [entry] = JSON.parse(JSON.parse(line).blob);
    expect(
      entry.messages[0].updateComponents.components[0].action.event.context
        .target
    ).toEqual({
      type: 'screen',
      screen: 'browserCredentialHandoff',
      viewerUrl: '[REDACTED]',
    });
    expect(entry.future).toEqual([{ fillUrl: '[REDACTED]' }]);
  });

  it('nulls a blob that is not valid JSON', () => {
    const blob = 'not json {"viewerUrl":"https://x.test/s/private.signature"';
    expect(
      JSON.parse(
        renderPostJsonLine(post({ blob, content: JSON.stringify([]) }))
      ).blob
    ).toBeNull();
  });

  it('nulls an absent parentId so the record shape stays stable', () => {
    // `toPostData` leaves parentId undefined on top-level posts, and
    // JSON.stringify would silently drop the key without normalization.
    const line = renderPostJsonLine({
      id: 'post-3',
      authorId: '~zod',
      sentAt: 1724200000000,
      content: JSON.stringify([]),
    } as never);
    expect(line).toContain('"parentId":null');
  });

  it('nulls tombstone content so the record shape stays stable', () => {
    // Deleted posts reach history pages as tombstones with content undefined.
    const line = renderPostJsonLine({
      id: 'post-4',
      authorId: '~zod',
      sentAt: 1724200000000,
      parentId: null,
    } as never);
    expect(line).toContain('"content":null');
    expect(Object.keys(JSON.parse(line))).toEqual([
      'id',
      'authorId',
      'sentAt',
      'receivedAt',
      'annotated',
      'parentId',
      'blob',
      'content',
    ]);
  });

  it('escapes unicode line separators so a record stays one line', () => {
    // JSON.stringify leaves U+0085/U+2028/U+2029 literal; a splitlines()-style
    // reader would split the record. The escape round-trips through JSON.parse.
    const line = renderPostJsonLine(
      post({
        content: JSON.stringify([{ inline: ['a\u2028b\u0085c\u2029d'] }]),
      })
    );
    expect(line).not.toMatch(/[\u0085\u2028\u2029]/);
    expect(line).toContain('\\u2028');
    expect(JSON.parse(line).content).toEqual([
      { inline: ['a\u2028b\u0085c\u2029d'] },
    ]);
  });
});

describe('renderPostListJsonLines', () => {
  const jsonPosts = () =>
    [4, 3, 2, 1].map(
      (n) =>
        ({
          id: `post-${n}`,
          authorId: '~zod',
          sentAt: 1724200000000 + n,
          parentId: null,
          blob: null,
          content: JSON.stringify([{ inline: [`body ${n}`] }]),
        }) as never
    );

  it('emits one line per post in sentAt order', () => {
    const lines = renderPostListJsonLines(jsonPosts());

    expect(lines.map((line) => JSON.parse(line).id)).toEqual([
      'post-1',
      'post-2',
      'post-3',
      'post-4',
    ]);
    expect(lines.some((line) => line.includes('\n'))).toBe(false);
  });

  it('emits nothing for an empty batch and leaves the input order alone', () => {
    expect(renderPostListJsonLines([])).toEqual([]);

    const posts = jsonPosts();
    renderPostListJsonLines(posts);
    expect(posts.map((entry: never) => (entry as { id: string }).id)).toEqual([
      'post-4',
      'post-3',
      'post-2',
      'post-1',
    ]);
  });
});

describe('window analysis integration', () => {
  const LIMIT_WARNING =
    '\u26a0 receipt order \u2260 sent order in this window: messages sent within this span may be missing \u2014 increase --limit to verify.';

  const DA_SECOND = BigInt('18446744073709551616');
  const DA_UNIX_EPOCH = BigInt('170141184475152167957503069145530368000');
  /** Inverse of the runtime's @da conversion, as in messages-runtime.test.ts. */
  const unixMsToUd = (unixMs: number): string => {
    const offset = DA_SECOND / BigInt(2000);
    const daNum =
      DA_UNIX_EPOCH - offset + (BigInt(unixMs) * DA_SECOND) / BigInt(1000);
    return daNum.toString(10).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const T0 = 1_750_000_000_000;
  const HOUR = 60 * 60 * 1000;

  const windowPost = (
    id: string,
    seq: number,
    sentAt: number,
    receivedAt: number
  ) =>
    ({
      id,
      authorId: '~zod',
      sentAt,
      sequenceNum: seq,
      backendTime: unixMsToUd(receivedAt),
      parentId: null,
      blob: null,
      content: JSON.stringify([{ inline: [id] }]),
    }) as never;

  /** Probe (prompt, receipt-oldest) + three writs delivered ~10h late. */
  const skewedPage = () => [
    windowPost('probe-10', 10, T0, T0 + 400),
    windowPost('late-11', 11, T0 - 12 * HOUR, T0 + 600_000),
    windowPost('late-12', 12, T0 - 11 * HOUR, T0 + 600_100),
    windowPost('late-13', 13, T0 - 10 * HOUR, T0 + 600_200),
  ];

  const cleanPage = () => [
    windowPost('writ-1', 1, T0, T0 + 200),
    windowPost('writ-2', 2, T0 + 60_000, T0 + 60_300),
  ];

  it('emits a window prelude record and per-post divergence fields in JSON', () => {
    const lines = renderPostListJsonLines(skewedPage(), {
      window: { truncated: true },
      displayLimit: 3,
    });

    const prelude = JSON.parse(lines[0]);
    expect(Object.keys(prelude)).toEqual([
      'type',
      'warning',
      'inversions',
      'sequenceGaps',
      'truncated',
    ]);
    expect(prelude).toEqual({
      type: 'window',
      warning: LIMIT_WARNING,
      inversions: 3,
      sequenceGaps: 0,
      truncated: true,
    });

    const posts = lines.slice(1).map((line) => JSON.parse(line));
    // Probe trimmed here too, and ordering matches plaintext (receipt order).
    expect(posts.map((record) => record.id)).toEqual([
      'late-11',
      'late-12',
      'late-13',
    ]);
    for (const record of posts) {
      expect(record.annotated).toBe(true);
      expect(typeof record.receivedAt).toBe('number');
    }
  });

  it('keeps a clean window quiet: null warning with, no prelude without', () => {
    const withWindow = renderPostListJsonLines(cleanPage(), {
      window: { truncated: false },
    });
    expect(JSON.parse(withWindow[0])).toEqual({
      type: 'window',
      warning: null,
      inversions: 0,
      sequenceGaps: 0,
      truncated: false,
    });
    expect(
      withWindow.slice(1).map((line) => JSON.parse(line).annotated)
    ).toEqual([false, false]);

    const withoutWindow = renderPostListJsonLines(cleanPage());
    expect(withoutWindow).toHaveLength(2);
    for (const line of withoutWindow) {
      expect(JSON.parse(line).type).toBeUndefined();
    }
  });

  it('emits a target-absent notice record when the target is not displayed', () => {
    const lines = renderPostListJsonLines(cleanPage(), {
      window: { truncated: true },
      highlightId: 'not-here',
    });
    expect(JSON.parse(lines[1])).toEqual({
      type: 'notice',
      notice: 'target-absent',
    });
    expect(lines).toHaveLength(4);
  });
});
