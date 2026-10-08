import type { Post } from '@tloncorp/shared/db';
import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { PostContentRenderer, createContentRenderer } from './ContentRenderer';
import { BlockRenderer } from './BlockRenderer';

const { platform } = vi.hoisted(() => ({ platform: { isWeb: false } }));
vi.mock('@tloncorp/shared/logic', async () => ({
  convertContent: (await import('@tloncorp/api/client/postContent'))
    .convertContent,
}));
vi.mock('tamagui', () => ({
  get isWeb() {
    return platform.isWeb;
  },
  YStack: 'YStack',
  styled: () => 'ContentRendererFrame',
}));
vi.mock('../../contexts/channel', () => ({
  useOptionalChannelContext: () => null,
}));
vi.mock('./contentUtils', () => ({
  ContentContext: { Provider: 'ContentContext' },
}));
vi.mock('./BlockRenderer', () => ({
  BlockRendererProvider: 'BlockRendererProvider',
  BlockRenderer: 'BlockRenderer',
}));
vi.mock('./InlineRenderer', () => ({
  InlineRendererProvider: 'InlineRendererProvider',
}));

const url = 'https://browser-session.tlon.network/s/payload.signature';
const meta = { siteName: 'Browser session', title: 'Open browser' };
const link = { type: 'link', url, ...meta } as const;

describe('browser session card rendering scope', () => {
  beforeEach(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    platform.isWeb = false;
  });
  afterEach(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it('keeps quoted/reference content as a visible link block', () => {
    const post = {
      content: JSON.stringify([{ block: { link: { url, meta } } }]),
      blob: null,
      groupId: null,
    } as Post;
    let renderer!: ReturnType<typeof create>;
    act(() => {
      renderer = create(<PostContentRenderer post={post} />);
    });
    expect(renderer.root.findByType(BlockRenderer).props.block).toMatchObject(
      link
    );
    act(() => renderer.unmount());
  });

  it.each([
    { enabled: false, web: false, type: 'link' },
    { enabled: true, web: false, type: 'a2ui' },
    { enabled: true, web: true, type: 'link' },
  ])(
    'only opts native chat into the viewer card: %j',
    ({ enabled, web, type }) => {
      platform.isWeb = web;
      const Renderer = createContentRenderer({
        renderBrowserSessionCards: enabled,
      });
      let renderer!: ReturnType<typeof create>;
      act(() => {
        renderer = create(<Renderer content={[link]} />);
      });
      expect(renderer.root.findByType(BlockRenderer).props.block.type).toBe(
        type
      );
      act(() => renderer.unmount());
    }
  );
});
