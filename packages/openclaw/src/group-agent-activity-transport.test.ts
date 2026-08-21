import { editPost, getChannelPosts, getPostWithReplies } from '@tloncorp/api';
import type { ParticipantAgentActivityProjectionV1 } from '@tloncorp/api/client/participantAgentActivity';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createTlonGroupAgentActivityTransport } from './group-agent-activity-transport.js';
import { allocateChannelSentAt, sendChannelPost } from './urbit/send.js';

vi.mock('@tloncorp/api', () => ({
  editPost: vi.fn(),
  getChannelPosts: vi.fn(),
  getPostWithReplies: vi.fn(),
}));

vi.mock('./urbit/send.js', () => ({
  allocateChannelSentAt: vi.fn(() => 1_000),
  sendChannelPost: vi.fn(),
}));

function projection(
  publicRunId = 'run_public_1',
  revision = 1
): ParticipantAgentActivityProjectionV1 {
  return {
    schemaVersion: 1,
    surface: 'carrier',
    publicRunId,
    revision,
    triggerPostId: 'request-1',
    state: 'working',
    createdAt: 900,
    updatedAt: 1_000 + revision,
    steps: [
      {
        id: 'step_public_1',
        title: 'Check the records',
        status: 'running',
      },
    ],
  };
}

function projectionBlob(activity: ParticipantAgentActivityProjectionV1) {
  return JSON.stringify([
    {
      type: 'tlon-context-lens',
      version: 1,
      lensId: 'private-lens-id',
      botShip: '~bot',
      delivery: 'intermediate',
      participantActivity: activity,
    },
  ]);
}

function draft(activity = projection()) {
  return {
    conversationId: 'chat/~host/general',
    authorId: '~bot',
    story: [{ inline: ['Working…'] }],
    blob: projectionBlob(activity),
    participantActivity: activity,
  };
}

describe('Tlon group agent activity transport', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(allocateChannelSentAt).mockReturnValue(1_000);
    vi.mocked(sendChannelPost).mockResolvedValue({
      channel: 'tlon',
      messageId: '~bot/123',
      sentAt: 1_000,
    });
  });

  test('resolves a root carrier by timestamp and public correlation id', async () => {
    const expectedDraft = draft();
    vi.mocked(getChannelPosts).mockResolvedValue({
      posts: [
        {
          id: 'wrong-run',
          authorId: '~bot',
          channelId: expectedDraft.conversationId,
          sentAt: 1_000,
          blob: projectionBlob(projection('run_other')),
        },
        {
          id: 'host-seal-id',
          authorId: '~bot',
          channelId: expectedDraft.conversationId,
          sentAt: 1_000,
          blob: expectedDraft.blob,
        },
      ],
    } as Awaited<ReturnType<typeof getChannelPosts>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });

    await expect(transport.create(expectedDraft)).resolves.toEqual({
      postId: 'host-seal-id',
      sentAt: 1_000,
    });
    expect(sendChannelPost).toHaveBeenCalledWith(
      expect.objectContaining({
        nest: expectedDraft.conversationId,
        fromShip: '~bot',
        sentAt: 1_000,
      })
    );
  });

  test('continues root pagination until it finds the correlated carrier', async () => {
    const expectedDraft = draft();
    vi.mocked(getChannelPosts)
      .mockResolvedValueOnce({
        posts: [],
        older: 'older-page',
      } as Awaited<ReturnType<typeof getChannelPosts>>)
      .mockResolvedValueOnce({
        posts: [
          {
            id: 'host-seal-id',
            authorId: '~bot',
            channelId: expectedDraft.conversationId,
            sentAt: 1_000,
            blob: expectedDraft.blob,
          },
        ],
      } as Awaited<ReturnType<typeof getChannelPosts>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });

    await expect(transport.create(expectedDraft)).resolves.toEqual({
      postId: 'host-seal-id',
      sentAt: 1_000,
    });
    expect(getChannelPosts).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: 'older',
        cursor: 'older-page',
      })
    );
  });

  test('rejects ambiguous participant projection blobs during correlation', async () => {
    const expectedDraft = draft();
    const duplicateEntry = JSON.parse(expectedDraft.blob)[0];
    vi.mocked(getChannelPosts).mockResolvedValue({
      posts: [
        {
          id: 'ambiguous',
          authorId: '~bot',
          channelId: expectedDraft.conversationId,
          sentAt: 1_000,
          blob: JSON.stringify([duplicateEntry, duplicateEntry]),
        },
      ],
    } as Awaited<ReturnType<typeof getChannelPosts>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });

    await expect(transport.create(expectedDraft)).resolves.toEqual({
      postId: '',
      sentAt: 1_000,
    });
  });

  test('resolves and host-confirms an edit inside its exact thread', async () => {
    const initialDraft = { ...draft(), parentId: 'thread-root' };
    vi.mocked(getPostWithReplies).mockResolvedValue({
      id: 'thread-root',
      authorId: '~requester',
      channelId: initialDraft.conversationId,
      sentAt: 500,
      replies: [
        {
          id: 'reply-seal-id',
          authorId: '~bot',
          channelId: initialDraft.conversationId,
          parentId: 'thread-root',
          sentAt: 1_000,
          blob: initialDraft.blob,
        },
      ],
    } as Awaited<ReturnType<typeof getPostWithReplies>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });
    const post = await transport.create(initialDraft);

    expect(post).toEqual({
      postId: 'reply-seal-id',
      sentAt: 1_000,
      parentId: 'thread-root',
    });

    const updatedProjection = projection('run_public_1', 2);
    const updatedDraft = {
      ...initialDraft,
      blob: projectionBlob(updatedProjection),
      participantActivity: updatedProjection,
    };
    vi.mocked(getPostWithReplies).mockResolvedValue({
      id: 'thread-root',
      authorId: '~requester',
      channelId: initialDraft.conversationId,
      sentAt: 500,
      replies: [
        {
          id: 'reply-seal-id',
          authorId: '~bot',
          channelId: initialDraft.conversationId,
          parentId: 'thread-root',
          sentAt: 1_000,
          blob: updatedDraft.blob,
        },
      ],
    } as Awaited<ReturnType<typeof getPostWithReplies>>);

    await transport.update(post, updatedDraft);
    expect(editPost).toHaveBeenCalledWith(
      expect.objectContaining({
        channelId: initialDraft.conversationId,
        postId: 'reply-seal-id',
        parentId: 'thread-root',
        sentAt: 1_000,
        blob: updatedDraft.blob,
      })
    );
    expect(getPostWithReplies).toHaveBeenCalledTimes(2);
  });

  test('retains an unresolved carrier handle instead of duplicating the post', async () => {
    const expectedDraft = draft();
    vi.mocked(getChannelPosts).mockResolvedValue({ posts: [] } as Awaited<
      ReturnType<typeof getChannelPosts>
    >);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });

    await expect(transport.create(expectedDraft)).resolves.toEqual({
      postId: '',
      sentAt: 1_000,
    });
    expect(sendChannelPost).toHaveBeenCalledTimes(1);
  });

  test('resolves an older carrier revision before applying a newer update', async () => {
    const initialDraft = draft();
    const nextProjection = projection('run_public_1', 2);
    const nextDraft = {
      ...initialDraft,
      blob: projectionBlob(nextProjection),
      participantActivity: nextProjection,
    };
    vi.mocked(getChannelPosts)
      .mockResolvedValueOnce({ posts: [] } as Awaited<
        ReturnType<typeof getChannelPosts>
      >)
      .mockResolvedValueOnce({
        posts: [
          {
            id: 'host-seal-id',
            authorId: '~bot',
            channelId: initialDraft.conversationId,
            sentAt: 1_000,
            blob: initialDraft.blob,
          },
        ],
      } as Awaited<ReturnType<typeof getChannelPosts>>);
    vi.mocked(getPostWithReplies).mockResolvedValue({
      id: 'host-seal-id',
      authorId: '~bot',
      channelId: initialDraft.conversationId,
      sentAt: 1_000,
      blob: nextDraft.blob,
    } as Awaited<ReturnType<typeof getPostWithReplies>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });

    const carrier = await transport.create(initialDraft);
    expect(carrier.postId).toBe('');

    await transport.update(carrier, nextDraft);

    expect(carrier.postId).toBe('host-seal-id');
    expect(editPost).toHaveBeenCalledTimes(1);
    expect(editPost).toHaveBeenCalledWith(
      expect.objectContaining({
        postId: 'host-seal-id',
        blob: nextDraft.blob,
      })
    );
  });

  test('reuses the reserved timestamp when a create retry is uncertain', async () => {
    const expectedDraft = draft();
    vi.mocked(sendChannelPost)
      .mockRejectedValueOnce(new Error('connection closed after poke'))
      .mockResolvedValueOnce({
        channel: 'tlon',
        messageId: '~bot/123',
        sentAt: 1_000,
      });
    vi.mocked(getChannelPosts)
      .mockResolvedValueOnce({ posts: [] } as Awaited<
        ReturnType<typeof getChannelPosts>
      >)
      .mockResolvedValueOnce({
        posts: [
          {
            id: 'host-seal-id',
            authorId: '~bot',
            channelId: expectedDraft.conversationId,
            sentAt: 1_000,
            blob: expectedDraft.blob,
          },
        ],
      } as Awaited<ReturnType<typeof getChannelPosts>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });

    await expect(transport.create(expectedDraft)).rejects.toThrow(
      'connection closed after poke'
    );
    await expect(transport.create(expectedDraft)).resolves.toEqual({
      postId: 'host-seal-id',
      sentAt: 1_000,
    });
    expect(allocateChannelSentAt).toHaveBeenCalledTimes(1);
    expect(sendChannelPost).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ sentAt: 1_000 })
    );
    expect(sendChannelPost).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ sentAt: 1_000 })
    );
  });

  test('resolves a remotely accepted post after the send response is lost', async () => {
    const expectedDraft = draft();
    vi.mocked(sendChannelPost).mockRejectedValueOnce(
      new Error('connection closed after poke')
    );
    vi.mocked(getChannelPosts).mockResolvedValue({
      posts: [
        {
          id: 'host-seal-id',
          authorId: '~bot',
          channelId: expectedDraft.conversationId,
          sentAt: 1_000,
          blob: expectedDraft.blob,
        },
      ],
    } as Awaited<ReturnType<typeof getChannelPosts>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0],
    });

    await expect(transport.create(expectedDraft)).resolves.toEqual({
      postId: 'host-seal-id',
      sentAt: 1_000,
    });
    expect(sendChannelPost).toHaveBeenCalledTimes(1);
    expect(allocateChannelSentAt).toHaveBeenCalledTimes(1);
  });

  test('retries a transient scry failure before resolving', async () => {
    const expectedDraft = draft();
    vi.mocked(getChannelPosts)
      .mockRejectedValueOnce(new Error('temporary scry failure'))
      .mockResolvedValueOnce({
        posts: [
          {
            id: 'host-seal-id',
            authorId: '~bot',
            channelId: expectedDraft.conversationId,
            sentAt: 1_000,
            blob: expectedDraft.blob,
          },
        ],
      } as Awaited<ReturnType<typeof getChannelPosts>>);
    const transport = createTlonGroupAgentActivityTransport({
      resolveDelaysMs: [0, 0],
    });

    await expect(transport.create(expectedDraft)).resolves.toEqual({
      postId: 'host-seal-id',
      sentAt: 1_000,
    });
    expect(getChannelPosts).toHaveBeenCalledTimes(2);
  });
});
