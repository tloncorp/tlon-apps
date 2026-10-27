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
        '"parentId":"parent-1","blob":null,"content":[{"inline":["hi"]}]}'
    );
  });

  it('carries content it cannot parse through verbatim', () => {
    expect(
      JSON.parse(renderPostJsonLine(post({ content: 'not json at all' })))
    ).toEqual({ ...base, content: 'not json at all' });
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
