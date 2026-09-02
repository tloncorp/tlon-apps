import { describe, expect, test } from 'vitest';

import { PostDataDraft } from '../types/post';

describe('PostDataDraft typed blobs', () => {
  const draft = {
    channelId: 'chat/~zod/test',
    channelType: 'chat' as const,
    content: ['hello'],
    attachments: [],
    blob: JSON.stringify([
      {
        type: 'tlon-agent-provision',
        version: 1,
        provisionId: 'provision-1',
      },
    ]),
    replyToPostId: null,
    isEdit: false as const,
  };

  test('survives serialization for an outbox retry', () => {
    expect(PostDataDraft.isValid(draft)).toBe(true);
    expect(PostDataDraft.serialize(draft).blob).toBe(draft.blob);
  });

  test('rejects a non-string blob', () => {
    expect(PostDataDraft.isValid({ ...draft, blob: {} })).toBe(false);
  });
});
