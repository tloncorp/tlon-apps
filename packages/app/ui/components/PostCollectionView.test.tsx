import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostCollectionView } from './PostCollectionView';

// React 19 warns unless the environment opts into `act`.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// See PostView.test.tsx: the real barrel pulls expo-modules-core, which wants a
// React Native `__DEV__` global.
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ log: () => {} }),
}));

vi.mock('./postCollectionViews/ListPostCollectionView', () => ({
  ListPostCollection: 'ListPostCollection',
}));

vi.mock('./postCollectionViews/shared', () => ({}));

const collectionRenderers: Record<string, unknown> = {};

vi.mock('../contexts/componentsKits', async () => {
  const actual = await vi.importActual<
    typeof import('../contexts/componentsKits/channelViews')
  >('../contexts/componentsKits/channelViews');
  return {
    resolveChannelView: actual.resolveChannelView,
    useComponentsKitContext: () => ({ collectionRenderers }),
  };
});

function configurationNaming(id: string) {
  return {
    draftInput: id,
    defaultPostContentRenderer: id,
    defaultPostCollectionRenderer: id,
  };
}

function renderCollection(channel: Partial<db.Channel>) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <PostCollectionView
        channel={channel as db.Channel}
        collectionRef={null}
      />
    );
  });
  return renderer.root
    .findAll(() => true, { deep: true })
    .map((node) => node.type);
}

describe('PostCollectionView', () => {
  beforeEach(() => {
    for (const key of Object.keys(collectionRenderers)) {
      delete collectionRenderers[key];
    }
    collectionRenderers['tlon.r0.collection.notes'] = 'NotesPostCollection';
  });

  it('renders the post list when nothing is declared', () => {
    expect(
      renderCollection({ id: 'chat/~zod/general', type: 'chat' })
    ).toContain('ListPostCollection');
  });

  it('renders a registered collection view the channel declares', () => {
    collectionRenderers['tlon.r0.view.mealPlan'] = 'MealPlanCollection';
    expect(
      renderCollection({
        id: 'chat/~zod/meals',
        type: 'chat',
        contentConfiguration: configurationNaming('tlon.r0.view.mealPlan'),
      })
    ).toContain('MealPlanCollection');
  });

  // The posts staying readable *is* the degradation for this slot; the
  // user-facing notice lives at the composer, where rendering nothing is not
  // survivable.
  it('falls back to the post list for an unregistered collection view', () => {
    const types = renderCollection({
      id: 'chat/~zod/meals',
      type: 'chat',
      contentConfiguration: configurationNaming('tlon.r0.view.mealPlan'),
    });
    expect(types).toContain('ListPostCollection');
    expect(types).not.toContain('MealPlanCollection');
  });

  it('keeps the channel-type fallback ahead of the post list for notes', () => {
    const types = renderCollection({
      id: 'notes/~zod/artifacts',
      type: 'notes',
      contentConfiguration: configurationNaming('tlon.r0.view.mealPlan'),
    });
    expect(types).toContain('NotesPostCollection');
    expect(types).not.toContain('ListPostCollection');
  });
});
