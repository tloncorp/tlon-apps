import type * as db from '@tloncorp/shared/db';
import { describe, expect, it, vi } from 'vitest';

import { selectSurfacePost } from './PinnedSurfaceCollectionView';

// The module under test renders the real list view and post path; the
// selection logic is what these tests pin, so the heavy render dependencies
// are stubbed the same way PostCollectionView.test.tsx stubs them.
vi.mock('./ListPostCollectionView', () => ({
  ListPostCollection: 'ListPostCollection',
}));
vi.mock('./shared', () => ({ ConnectedPostView: 'ConnectedPostView' }));
vi.mock('../../contexts/postCollection', () => ({
  PostCollectionContext: { Provider: 'Provider' },
  usePostCollectionContext: () => {
    throw new Error('not rendered in these tests');
  },
}));

const SURFACE_BLOB = JSON.stringify([
  {
    type: 'interactive-surface',
    version: 1,
    surfaceId: 'weekly-plan-1',
    revision: 0,
    state: {},
    processedActionIds: [],
  },
]);

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

  it('picks the newest post carrying an interactive surface', () => {
    const older = post({ id: 'old', blob: SURFACE_BLOB, receivedAt: 10 });
    const newer = post({ id: 'new', blob: SURFACE_BLOB, receivedAt: 20 });
    const plain = post({ id: 'plain', receivedAt: 30 });
    expect(selectSurfacePost([older, plain, newer], channel())?.id).toBe('new');
  });

  it('prefers the channel-pinned post when it carries a surface', () => {
    const pinned = post({ id: 'pinned', blob: SURFACE_BLOB, receivedAt: 10 });
    const newer = post({ id: 'newer', blob: SURFACE_BLOB, receivedAt: 20 });
    expect(selectSurfacePost([pinned, newer], channel(['pinned']))?.id).toBe(
      'pinned'
    );
  });

  it('falls past a pinned post without a surface to the heuristic', () => {
    const pinnedPlain = post({ id: 'pinned', receivedAt: 30 });
    const card = post({ id: 'card', blob: SURFACE_BLOB, receivedAt: 10 });
    expect(
      selectSurfacePost([pinnedPlain, card], channel(['pinned']))?.id
    ).toBe('card');
  });

  it('skips deleted posts and unparseable blobs', () => {
    const deleted = post({
      id: 'deleted',
      blob: SURFACE_BLOB,
      isDeleted: true,
      receivedAt: 30,
    });
    const garbage = post({ id: 'garbage', blob: '{not json', receivedAt: 20 });
    const card = post({ id: 'card', blob: SURFACE_BLOB, receivedAt: 10 });
    expect(selectSurfacePost([deleted, garbage, card], channel())?.id).toBe(
      'card'
    );
  });
});
