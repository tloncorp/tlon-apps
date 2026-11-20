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
vi.mock('./A2UIEntityRow', () => ({
  A2UIEntityRow: 'A2UIEntityRow',
  getA2UIEntityIndent: () => 46,
}));
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

it('pairs up a row of four buttons instead of squeezing them onto one line', async () => {
  // The pending-approvals card adds View message to the same row.
  const four = structuredClone(block);
  const update = four.a2ui.messages[1];
  if (!('updateComponents' in update)) throw new Error('no components');
  const components = update.updateComponents.components;
  const actions = components.find((c) => c.id === 'actions');
  if (actions?.component !== 'Row') throw new Error('no actions row');
  actions.children.push('view');
  components.push(
    {
      id: 'view',
      component: 'Button',
      variant: 'secondary',
      child: 'viewLabel',
      action: send('/view 1'),
    },
    { id: 'viewLabel', component: 'Text', text: 'View message' }
  );
  await act(async () => {
    renderer = create(<A2UIBlock block={four} />);
  });
  const frames = buttons();
  expect(frames.map(buttonLabel)).toEqual([
    'Reject',
    'Block',
    'View message',
    'Allow',
  ]);
  for (const frame of frames) {
    expect(frame.props).toMatchObject({ flexGrow: 1, flexBasis: '40%' });
    expect(frame.props.flex).toBeUndefined();
  }
  const row = renderer.root
    .findAllByType('XStack' as never)
    .find((node) => node.props.gap === 8);
  expect(row?.props.flexWrap).toBe('wrap');
});

it('draws icon text and its caption as one list row', async () => {
  // A workspace card's planned channels: each is a list item with a subtitle.
  const listed = structuredClone(block);
  const update = listed.a2ui.messages[1];
  if (!('updateComponents' in update)) throw new Error('no components');
  const components = update.updateComponents.components;
  const body = components.find((c) => c.id === 'body');
  if (body?.component !== 'Column') throw new Error('no body');
  body.children.splice(1, 0, 'chat', 'chatDetail', 'notes', 'notesDetail');
  components.push(
    { id: 'chat', component: 'Text', icon: 'ChannelTalk', text: 'Build chat' },
    {
      id: 'chatDetail',
      component: 'Text',
      variant: 'caption',
      text: 'Decisions and questions',
    },
    { id: 'notes', component: 'Text', icon: 'ChannelNotebooks', text: 'Notes' },
    {
      id: 'notesDetail',
      component: 'Text',
      variant: 'caption',
      text: 'Your spec sheet',
    }
  );
  await act(async () => {
    renderer = create(<A2UIBlock block={listed} />);
  });
  const rows = renderer.root.findAllByType('A2UIMenuRow' as never);
  expect(
    rows.map((row) => [
      row.props.label,
      row.props.subtitle,
      row.props.dividerAfter,
    ])
  ).toEqual([
    ['Build chat', 'Decisions and questions', true],
    ['Notes', 'Your spec sheet', true],
  ]);
  // Captions joined to a row are not drawn again as text.
  const texts = renderer.root
    .findAllByType('Text' as never)
    .map((node) => node.children.join(''));
  expect(texts).not.toContain('Your spec sheet');
  // Only the first row draws the hairline above the list.
  const wrappers = rows.map((row) => row.parent!);
  expect(wrappers.map((node) => node.props.borderTopWidth)).toEqual([1, 0]);
});

it('draws an item whose icon it does not know as plain text', async () => {
  // How an app that predates an icon reads a newer card: words, no row.
  const listed = structuredClone(block);
  const update = listed.a2ui.messages[1];
  if (!('updateComponents' in update)) throw new Error('no components');
  const components = update.updateComponents.components;
  const body = components.find((c) => c.id === 'body');
  if (body?.component !== 'Column') throw new Error('no body');
  body.children.splice(1, 0, 'item', 'itemDetail');
  components.push(
    // Unknown on purpose, as a later bot might send.
    { id: 'item', component: 'Text', icon: 'Rocket' as never, text: 'Launch' },
    {
      id: 'itemDetail',
      component: 'Text',
      variant: 'caption',
      text: 'Countdown notes',
    }
  );
  await act(async () => {
    renderer = create(<A2UIBlock block={listed} />);
  });
  expect(renderer.root.findAllByType('A2UIMenuRow' as never)).toEqual([]);
  const texts = renderer.root
    .findAllByType('Text' as never)
    .map((node) => node.children.join(''));
  expect(texts).toEqual(expect.arrayContaining(['Launch', 'Countdown notes']));
});
