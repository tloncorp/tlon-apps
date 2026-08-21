import type * as db from '@tloncorp/shared/db';
import { describe, expect, it, vi } from 'vitest';

import {
  selectLatestChatPost,
  selectSurfacePost,
} from './PinnedSurfaceCollectionView';

// The module under test renders the real list view and post path; the
// selection logic is what these tests pin, so the heavy render dependencies
// are stubbed the same way PostCollectionView.test.tsx stubs them.
vi.mock('./ListPostCollectionView', () => ({
  ListPostCollection: 'ListPostCollection',
}));
vi.mock('./shared', () => ({}));
vi.mock('../../contexts/postCollection', () => ({
  PostCollectionContext: { Provider: 'Provider' },
  usePostCollectionContext: () => {
    throw new Error('not rendered in these tests');
  },
}));
vi.mock('../PostContent/A2UIBlock', () => ({ A2UIBlock: 'A2UIBlock' }));
vi.mock('../PostContent/contentUtils', () => ({
  ContentContext: { Provider: 'Provider' },
  usePostContent: () => [],
}));
vi.mock('../../hooks/usePostA2UIActions', () => ({
  usePostA2UIActions: () => ({}),
}));
vi.mock('../../../hooks/useLivePost', () => ({
  useLivePost: (post: unknown) => post,
}));
vi.mock('@tloncorp/ui', () => ({ Icon: 'Icon', Text: 'Text' }));
// Pulls expo-modules-core (which wants RN's __DEV__ global) transitively.
vi.mock('../Channel/useConversationComputingState', () => ({
  useConversationComputingState: () => null,
}));

const A2UI_ENTRY = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'weekly-plan-1',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'weekly-plan-1',
        root: 't',
        components: [{ id: 't', component: 'Text', text: 'hi' }],
      },
    },
  ],
};

const SURFACE_ENTRY = {
  type: 'interactive-surface',
  version: 1,
  surfaceId: 'weekly-plan-1',
  revision: 0,
  state: {},
  processedActionIds: [],
};

const CARD_BLOB = JSON.stringify([A2UI_ENTRY, SURFACE_ENTRY]);
const SURFACE_ONLY_BLOB = JSON.stringify([SURFACE_ENTRY]);

function post(overrides: Partial<db.Post>): db.Post {
  return {
    id: 'post-0',
    receivedAt: 0,
    blob: null,
    isDeleted: false,
    ...overrides,
  } as db.Post;
}

function channel(order?: string[]): db.Channel {
  return { id: 'chat/~zod/kitchen', order: order ?? null } as db.Channel;
}

describe('selectSurfacePost', () => {
  it('returns null with no posts or no surface posts', () => {
    expect(selectSurfacePost(undefined, channel())).toBeNull();
    expect(selectSurfacePost([], channel())).toBeNull();
    expect(
      selectSurfacePost([post({ id: 'a', blob: null })], channel())
    ).toBeNull();
  });

  it('picks the newest post carrying a drawable surface', () => {
    const older = post({ id: 'old', blob: CARD_BLOB, receivedAt: 10 });
    const newer = post({ id: 'new', blob: CARD_BLOB, receivedAt: 20 });
    const plain = post({ id: 'plain', receivedAt: 30 });
    expect(selectSurfacePost([older, plain, newer], channel())?.id).toBe('new');
  });

  it('ignores a surface entry with no a2ui view to draw', () => {
    const dataOnly = post({
      id: 'data',
      blob: SURFACE_ONLY_BLOB,
      receivedAt: 30,
    });
    const card = post({ id: 'card', blob: CARD_BLOB, receivedAt: 10 });
    expect(selectSurfacePost([dataOnly, card], channel())?.id).toBe('card');
  });

  it('prefers the channel-pinned post when it carries a surface', () => {
    const pinned = post({ id: 'pinned', blob: CARD_BLOB, receivedAt: 10 });
    const newer = post({ id: 'newer', blob: CARD_BLOB, receivedAt: 20 });
    expect(selectSurfacePost([pinned, newer], channel(['pinned']))?.id).toBe(
      'pinned'
    );
  });

  it('falls past a pinned post without a surface to the heuristic', () => {
    const pinnedPlain = post({ id: 'pinned', receivedAt: 30 });
    const card = post({ id: 'card', blob: CARD_BLOB, receivedAt: 10 });
    expect(
      selectSurfacePost([pinnedPlain, card], channel(['pinned']))?.id
    ).toBe('card');
  });

  it('skips deleted posts and unparseable blobs', () => {
    const deleted = post({
      id: 'deleted',
      blob: CARD_BLOB,
      isDeleted: true,
      receivedAt: 30,
    });
    const garbage = post({ id: 'garbage', blob: '{not json', receivedAt: 20 });
    const card = post({ id: 'card', blob: CARD_BLOB, receivedAt: 10 });
    expect(selectSurfacePost([deleted, garbage, card], channel())?.id).toBe(
      'card'
    );
  });
});

describe('selectLatestChatPost', () => {
  it('picks the newest conversation post, excluding the surface post', () => {
    const card = post({ id: 'card', blob: CARD_BLOB, receivedAt: 99 });
    const older = post({ id: 'older', receivedAt: 10 });
    const newer = post({ id: 'newer', receivedAt: 20 });
    const gone = post({ id: 'gone', receivedAt: 30, isDeleted: true });
    expect(selectLatestChatPost([card, older, newer, gone], card.id)?.id).toBe(
      'newer'
    );
    expect(selectLatestChatPost([card], card.id)).toBeNull();
    expect(selectLatestChatPost(undefined, card.id)).toBeNull();
  });
});
