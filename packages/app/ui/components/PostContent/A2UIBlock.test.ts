import { type A2UIBlockData } from '@tloncorp/shared/logic';
import { describe, expect, it } from 'vitest';

import {
  hasRenderableA2UIStoryFallback,
  isA2UIBlockRenderable,
} from './a2uiRenderability';

function block(components: unknown[], root = 'root', storyMode?: 'fallback') {
  return {
    type: 'a2ui',
    a2ui: {
      type: 'a2ui',
      version: 1,
      storyMode,
      messages: [
        {
          version: 'v0.9',
          createSurface: {
            surfaceId: 'surface',
            catalogId: 'tlon.a2ui.basic.v2',
          },
        },
        {
          version: 'v0.9',
          updateComponents: { surfaceId: 'surface', root, components },
        },
      ],
    },
  } as A2UIBlockData;
}

const mcpConnect = {
  id: 'mcp',
  component: 'McpConnect',
  maxVisible: 4,
  seeAllLabel: 'See all connectors',
  submitLabel: 'Done',
  action: {
    event: {
      name: 'navigate',
      context: { target: { type: 'screen', screen: 'botMcpSettings' } },
    },
  },
  configureAction: {
    event: {
      name: 'configureAgentProviders',
      context: {
        groupId: '~ten/group',
        provisionId: 'provision-1',
        providerIds: [],
      },
    },
  },
};

describe('isA2UIBlockRenderable', () => {
  it('rejects a missing root', () => {
    expect(isA2UIBlockRenderable(block([], 'missing'), true)).toBe(false);
  });

  it('rejects an unauthorized provider-only surface', () => {
    expect(isA2UIBlockRenderable(block([mcpConnect], 'mcp'), false)).toBe(
      false
    );
  });

  it('accepts a surface with another renderable child', () => {
    expect(
      isA2UIBlockRenderable(
        block([
          { id: 'root', component: 'Column', children: ['mcp', 'copy'] },
          mcpConnect,
          { id: 'copy', component: 'Text', text: 'Connect your services' },
        ]),
        false
      )
    ).toBe(true);
  });
});

describe('hasRenderableA2UIStoryFallback', () => {
  it('matches fallback mode and renderability on the same entry', () => {
    const unrenderableFallback = block([mcpConnect], 'mcp', 'fallback');
    const renderableNonFallback = block([
      { id: 'root', component: 'Text', text: 'Visible surface' },
    ]);

    expect(
      hasRenderableA2UIStoryFallback(
        [unrenderableFallback, renderableNonFallback],
        false
      )
    ).toBe(false);
  });

  it('finds a later renderable fallback entry', () => {
    const renderableNonFallback = block([
      { id: 'root', component: 'Text', text: 'First surface' },
    ]);
    const renderableFallback = block(
      [{ id: 'root', component: 'Text', text: 'Second surface' }],
      'root',
      'fallback'
    );

    expect(
      hasRenderableA2UIStoryFallback(
        [renderableNonFallback, renderableFallback],
        false
      )
    ).toBe(true);
  });
});
