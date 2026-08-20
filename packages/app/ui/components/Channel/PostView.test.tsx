import type * as db from '@tloncorp/shared/db';
import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PostView } from './PostView';

// React 19 warns unless the environment opts into `act`.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let channel: Partial<db.Channel>;

// Mocked rather than `importActual`: the real barrel pulls expo-modules-core,
// which needs a React Native `__DEV__` global this environment has no reason to
// provide. PostView only uses these two.
vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ log: () => {} }),
  JSONValue: {
    asBoolean: (value: unknown, defaultValue: unknown) =>
      typeof value === 'boolean' ? value : defaultValue,
  },
}));

vi.mock('../../contexts/channel', () => ({
  useChannelContext: () => channel,
}));

vi.mock('../ChatMessage', () => ({ ChatMessage: 'ChatMessage' }));
vi.mock('../GalleryPost', () => ({ GalleryPost: 'GalleryPost' }));
vi.mock('../NotebookPost', () => ({ NotebookPost: 'NotebookPost' }));

const renderers: Record<string, unknown> = {};

vi.mock('../../contexts/componentsKits/componentsKits', () => ({
  useComponentsKitContext: () => ({ renderers }),
}));

const post = { id: 'post-1' } as db.Post;

function renderPost() {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<PostView post={post} onPressDelete={vi.fn()} />);
  });
  return renderer;
}

function renderedTypes(renderer: ReactTestRenderer) {
  return renderer.root
    .findAll(() => true, { deep: true })
    .map((node) => node.type);
}

describe('PostView', () => {
  beforeEach(() => {
    for (const key of Object.keys(renderers)) {
      delete renderers[key];
    }
    channel = { id: 'chat/~zod/general', type: 'chat' };
  });

  it('renders the built-in for the channel type when nothing is declared', () => {
    channel = { id: 'diary/~zod/blog', type: 'notebook' };
    expect(renderedTypes(renderPost())).toContain('NotebookPost');
  });

  it('renders a registered view the channel declares', () => {
    renderers['tlon.r0.view.mealPlan'] = 'MealPlanPost';
    channel = {
      id: 'chat/~zod/meals',
      type: 'chat',
      contentConfiguration: {
        draftInput: 'tlon.r0.view.mealPlan',
        defaultPostContentRenderer: 'tlon.r0.view.mealPlan',
        defaultPostCollectionRenderer: 'tlon.r0.view.mealPlan',
      },
    };
    expect(renderedTypes(renderPost())).toContain('MealPlanPost');
  });

  it('falls back to the channel-type built-in for an unregistered view', () => {
    channel = {
      id: 'diary/~zod/blog',
      type: 'notebook',
      contentConfiguration: {
        draftInput: 'tlon.r0.view.mealPlan',
        defaultPostContentRenderer: 'tlon.r0.view.mealPlan',
        defaultPostCollectionRenderer: 'tlon.r0.view.mealPlan',
      },
    };
    const types = renderedTypes(renderPost());
    expect(types).toContain('NotebookPost');
    expect(types).not.toContain('MealPlanPost');
  });

  // Guards the crash the switch used to allow: with no `default` an
  // out-of-union type produced `undefined`, and React throws on `<undefined>`.
  it('does not throw for a channel type this build does not know', () => {
    channel = {
      id: 'mealplan/~zod/dinners',
      type: 'mealplan' as db.Channel['type'],
    };
    expect(() => renderedTypes(renderPost())).not.toThrow();
    expect(renderedTypes(renderPost())).toContain('ChatMessage');
  });
});
