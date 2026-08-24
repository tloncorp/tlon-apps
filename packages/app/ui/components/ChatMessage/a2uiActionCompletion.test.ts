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
          post({
            authorId: ownerId,
            textContent: 'failed',
            deliveryStatus: 'failed',
          }),
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

  it('preserves every later owner reply for exact action matching', () => {
    expect(
      getA2UIActionCompletion(
        [
          post({ authorId: ownerId, textContent: 'Unrelated text' }),
          post({ authorId: ownerId, textContent: 'Yes' }),
        ],
        ownerId
      ).sentMessageTextIndex
    ).toMatchObject({
      lastIndexByText: new Map([
        ['Unrelated text', 0],
        ['Yes', 1],
      ]),
      start: 0,
    });
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
      post({
        id: 'failed-choice',
        authorId: ownerId,
        textContent: 'Failed',
        deliveryStatus: 'failed',
      }),
      post({ id: 'choice', authorId: ownerId, textContent: 'Research' }),
      post({ id: 'follow-up' }),
      post({ id: 'topics', authorId: ownerId, textContent: 'Mycology' }),
    ];
    const completions = getA2UIActionCompletions(posts, ownerId);
    const materialize = (completion: (typeof completions)[number]) => ({
      ...completion,
      sentMessageTextIndex: completion.sentMessageTextIndex
        ? [...completion.sentMessageTextIndex.lastIndexByText]
            .filter(
              ([, index]) => index >= completion.sentMessageTextIndex!.start
            )
            .map(([text]) => text)
            .sort()
        : undefined,
    });
    expect(completions.map(materialize)).toEqual(
      posts.map((_, index) =>
        materialize(getA2UIActionCompletion(posts.slice(index + 1), ownerId))
      )
    );

    expect(completions[0]?.sentMessageTextIndex?.lastIndexByText).toBe(
      completions[1]?.sentMessageTextIndex?.lastIndexByText
    );
  });
});
