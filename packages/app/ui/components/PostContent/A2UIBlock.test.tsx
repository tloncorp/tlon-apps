import type { A2UI as A2UITypes } from '@tloncorp/shared/logic';
import React, { PropsWithChildren } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { A2UIBlock, getA2UISurfaceLayout } from './A2UIBlock';

vi.mock('@tloncorp/shared', () => ({
  createDevLogger: () => ({ trackError: vi.fn() }),
}));

vi.mock('@tloncorp/ui', () => ({
  Button: { Frame: 'ButtonFrame', Text: 'ButtonText' },
  Icon: 'Icon',
  Image: 'Image',
  Text: 'Text',
}));

vi.mock('tamagui', () => ({
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  isWeb: true,
}));

vi.mock('./contentUtils', () => ({
  useContentContext: () => ({}),
}));

const weatherCard: A2UITypes.BlobEntry = {
  type: 'a2ui',
  version: 1,
  messages: [
    {
      version: 'v0.9',
      createSurface: {
        surfaceId: 'weather-card',
        catalogId: 'tlon.a2ui.basic.v1',
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'weather-card',
        root: 'root',
        components: [
          { id: 'root', component: 'Card', child: 'body' },
          {
            id: 'body',
            component: 'Column',
            children: ['header', 'divider', 'forecast'],
          },
          {
            id: 'header',
            component: 'Row',
            align: 'center',
            children: ['location', 'title'],
          },
          { id: 'location', component: 'Icon', name: 'locationOn' },
          { id: 'title', component: 'Text', variant: 'h2', text: 'Brooklyn' },
          { id: 'divider', component: 'Divider' },
          {
            id: 'forecast',
            component: 'Image',
            url: 'https://example.com/forecast.png',
            description: 'Cloudy forecast',
            fit: 'cover',
            variant: 'header',
          },
        ],
      },
    },
  ],
};

function Theme({ name, children }: PropsWithChildren<{ name: string }>) {
  return React.createElement('Theme', { name }, children);
}

async function renderInTheme(name: 'light' | 'dark') {
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(
      <Theme name={name}>
        <A2UIBlock block={{ type: 'a2ui', a2ui: weatherCard }} />
      </Theme>
    );
  });
  return renderer!;
}

function findAllByMockType(renderer: ReactTestRenderer, type: string) {
  return renderer.root.findAll((node) => node.type === type);
}

function findByMockType(renderer: ReactTestRenderer, type: string) {
  return findAllByMockType(renderer, type)[0];
}

describe('A2UIBlock', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it.each(['light', 'dark'] as const)(
    'uses theme tokens in the %s theme',
    async (themeName) => {
      const renderer = await renderInTheme(themeName);
      expect(findByMockType(renderer, 'Theme').props.name).toBe(themeName);
      expect(
        findAllByMockType(renderer, 'YStack').some(
          (node) =>
            node.props.backgroundColor === '$secondaryBackground' &&
            node.props.borderColor === '$border'
        )
      ).toBe(true);
      expect(
        findAllByMockType(renderer, 'Text').some(
          (node) => node.props.color === '$primaryText'
        )
      ).toBe(true);
      act(() => renderer.unmount());
    }
  );

  it('renders the catalog icon and responsive image semantics', async () => {
    const renderer = await renderInTheme('light');
    const icon = findByMockType(renderer, 'Icon');
    expect(icon.props.type).toBe('Pin');
    expect(icon.props.accessibilityLabel).toBe('locationOn');
    const image = findByMockType(renderer, 'Image');
    expect(image.props.source).toEqual({
      uri: 'https://example.com/forecast.png',
    });
    expect(image.props.accessibilityLabel).toBe('Cloudy forecast');
    expect(image.props.contentFit).toBe('cover');
    expect(image.props.width).toBe('100%');
    expect(image.props.height).toBe(200);
    act(() => renderer.unmount());
  });

  it('keeps web surfaces bounded and mobile surfaces fluid', () => {
    expect(getA2UISurfaceLayout(true)).toEqual({
      width: '100%',
      maxWidth: 560,
    });
    expect(getA2UISurfaceLayout(false)).toEqual({
      width: '100%',
      maxWidth: '100%',
    });
  });
});
