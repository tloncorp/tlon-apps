import * as db from '@tloncorp/shared/db';
import { describe, expect, it } from 'vitest';

import {
  getA2UIActionCompletion,
  getA2UIActionCompletions,
} from './a2uiActionCompletion';

const ownerId = '~owner';

function post(overrides: Partial<db.Post>): db.Post {
  return {
    id: overrides.id ?? 'post',
    authorId: overrides.authorId ?? '~agent',
    ...overrides,
  } as db.Post;
}

describe('getA2UIActionCompletion', () => {
  it('consumes a message action only after a later owner text post', () => {
    expect(
      getA2UIActionCompletion(
        [
          post({ authorId: '~agent', textContent: 'bot follow-up' }),
          post({ authorId: ownerId, textContent: 'ignored', isDeleted: true }),
        ],
        ownerId
      ).sendMessage
    ).toBe(false);

    expect(
      getA2UIActionCompletion(
        [post({ authorId: ownerId, textContent: 'AI, climate' })],
        ownerId
      )
    ).toMatchObject({ sendMessage: true, sentMessageText: 'AI, climate' });
  });

  it('consumes a provisioning action only after its typed owner post', () => {
    const blob = JSON.stringify([
      {
        type: 'tlon-agent-provision',
        version: 1,
        provisionId: 'provision-1',
        groupId: '~owner/group',
        purposeId: 'agent-daily-digest',
        purpose: 'A daily digest',
        topics: ['AI'],
        timezone: 'America/New_York',
        scheduleHour: 8,
        scheduleMinute: 30,
        notebookNest: 'notes/~owner/updates',
      },
    ]);

    expect(
      getA2UIActionCompletion(
        [post({ authorId: ownerId, textContent: 'plain reply' })],
        ownerId
      ).provisionAgent
    ).toBe(false);
    expect(
      getA2UIActionCompletion([post({ authorId: ownerId, blob })], ownerId)
    ).toMatchObject({
      provisionAgent: true,
      provisionedTopics: ['AI'],
    });
  });

  it('recovers the latest durable provider selection', () => {
    const config = (providerIds: string[]) =>
      JSON.stringify([
        {
          type: 'tlon-agent-provider-config',
          version: 1,
          provisionId: 'provision-1',
          groupId: '~owner/group',
          providerIds,
        },
      ]);
    expect(
      getA2UIActionCompletion(
        [
          post({ authorId: ownerId, blob: config(['gmail']) }),
          post({ authorId: ownerId, blob: config(['notion', 'gmail']) }),
        ],
        ownerId
      ).configuredProviderIds
    ).toEqual(['notion', 'gmail']);
  });

  it('matches the per-row suffix scan in one reverse pass', () => {
    const posts = [
      post({ id: 'surface' }),
      post({ id: 'choice', authorId: ownerId, textContent: 'Research' }),
      post({ id: 'follow-up' }),
      post({ id: 'topics', authorId: ownerId, textContent: 'Mycology' }),
    ];
    expect(getA2UIActionCompletions(posts, ownerId)).toEqual(
      posts.map((_, index) =>
        getA2UIActionCompletion(posts.slice(index + 1), ownerId)
      )
    );
  });
});
