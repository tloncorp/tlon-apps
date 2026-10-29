import type { A2UIBlockData } from '@tloncorp/shared/logic';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { A2UIBlock } from './A2UIBlock';

vi.mock('@tloncorp/shared/logic', async () => ({
  A2UI: (await import('@tloncorp/api')).A2UI,
}));
vi.mock('@tloncorp/ui', () => ({
  Button: { Frame: 'ButtonFrame', Text: 'ButtonText' },
  Icon: 'Icon',
  LoadingSpinner: 'LoadingSpinner',
  Pressable: 'Pressable',
  Text: 'Text',
}));
vi.mock('tamagui', () => ({
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  isWeb: false,
}));
vi.mock('react-native-keyboard-controller', () => ({ KeyboardController: {} }));
vi.mock('../../contexts/scroll', () => ({
  useConversationScrollEndAnchor: () => null,
}));
vi.mock('../ActionSheet', () => ({ ActionSheet: 'ActionSheet' }));
vi.mock('../Form', () => ({ TextInput: 'TextInput' }));
vi.mock('./A2UIMenuRow', () => ({ A2UIMenuRow: 'A2UIMenuRow' }));
vi.mock('./McpConnectControl', () => ({
  McpConnectControl: 'McpConnectControl',
}));
vi.mock('./contentUtils', () => ({
  useContentContext: () => ({ onA2UIAction: vi.fn() }),
}));

const send = (text: string) => ({
  event: { name: 'tlon.sendMessage' as const, context: { text } },
});

// The approval card's footer as the bot sends it: Allow first and primary,
// Reject with no variant, Block borderless.
const block: A2UIBlockData = {
  type: 'a2ui',
  a2ui: {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: {
          surfaceId: 'approval',
          catalogId: 'tlon.a2ui.basic.v1',
        },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'approval',
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'body' },
            {
              id: 'body',
              component: 'Column',
              children: ['title', 'actions'],
            },
            {
              id: 'title',
              component: 'Text',
              variant: 'h3',
              text: 'Allow Sam Palnet to DM the bot?',
            },
            {
              id: 'actions',
              component: 'Row',
              children: ['allow', 'reject', 'ban'],
            },
            {
              id: 'allow',
              component: 'Button',
              variant: 'primary',
              child: 'allowLabel',
              action: send('/allow 1'),
            },
            { id: 'allowLabel', component: 'Text', text: 'Allow' },
            {
              id: 'reject',
              component: 'Button',
              child: 'rejectLabel',
              action: send('/reject 1'),
            },
            { id: 'rejectLabel', component: 'Text', text: 'Reject' },
            {
              id: 'ban',
              component: 'Button',
              variant: 'borderless',
              child: 'banLabel',
              action: send('/ban 1'),
            },
            { id: 'banLabel', component: 'Text', text: 'Block' },
          ],
        },
      },
    ],
  },
};

let renderer: ReactTestRenderer;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});
async function render() {
  await act(async () => {
    renderer = create(<A2UIBlock block={block} />);
  });
}
function buttons() {
  return renderer.root.findAllByType('ButtonFrame' as never);
}
function buttonLabel(frame: ReturnType<typeof buttons>[number]) {
  return frame.findByType('ButtonText' as never).children.join('');
}

it('puts the primary button last and gives every row button a surface', async () => {
  await render();
  const frames = buttons();
  expect(frames.map(buttonLabel)).toEqual(['Reject', 'Block', 'Allow']);
  const [reject, block, allow] = frames;
  expect(allow.props).toMatchObject({ fill: 'solid', intent: 'primary' });
  for (const frame of [reject, block]) {
    expect(frame.props).toMatchObject({
      fill: 'ghost',
      backgroundColor: '$secondaryBackground',
      flex: 1,
    });
  }
  expect(allow.props.flex).toBe(1);
});
