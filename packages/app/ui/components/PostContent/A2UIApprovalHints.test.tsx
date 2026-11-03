import type { A2UIBlockData } from '@tloncorp/shared/logic';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { A2UIBlock } from './A2UIBlock';

const mocks = vi.hoisted(() => ({
  consumedText: undefined as string | undefined,
}));
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
  useContentContext: () => ({
    onA2UIAction: vi.fn(),
    isA2UIActionConsumed: (action: {
      event: { name: string; context: { text?: string } };
    }) => action.event.context.text === mocks.consumedText,
  }),
}));

const send = (text: string) => ({
  event: { name: 'tlon.sendMessage' as const, context: { text } },
});

// A DM approval with rendering hints (docs/tlon-apps/post-blobs.md).
const block: A2UIBlockData = {
  type: 'a2ui',
  a2ui: {
    type: 'a2ui',
    version: 1,
    storyMode: 'fallback',
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'dm', catalogId: 'tlon.a2ui.basic.v1' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'dm',
          root: 'root',
          components: [
            { id: 'root', component: 'Card', child: 'body' },
            {
              id: 'body',
              component: 'Column',
              children: ['kicker', 'title', 'subject', 'actions'],
            },
            {
              id: 'kicker',
              component: 'Text',
              role: 'kicker',
              icon: 'AddPerson',
              text: 'DM access',
            },
            {
              id: 'title',
              component: 'Text',
              variant: 'h3',
              text: 'Allow Sam Palnet to DM the bot?',
            },
            { id: 'subject', component: 'Card', child: 'subjectBody' },
            {
              id: 'subjectBody',
              component: 'Column',
              children: ['requester', 'message'],
            },
            {
              id: 'requester',
              component: 'Text',
              text: 'Sam Palnet (~sampel-palnet)',
              entity: {
                type: 'ship',
                id: '~sampel-palnet',
                name: 'Sam Palnet',
              },
            },
            { id: 'message', component: 'Text', text: 'Hello there.' },
            {
              id: 'actions',
              component: 'Row',
              children: ['ban', 'reject', 'allow'],
            },
            {
              id: 'ban',
              component: 'Button',
              variant: 'borderless',
              tone: 'destructive',
              resultLabel: 'You blocked Sam Palnet.',
              statusLabel: 'Blocked',
              child: 'banLabel',
              action: send('/ban 1'),
            },
            { id: 'banLabel', component: 'Text', text: 'Block' },
            {
              id: 'reject',
              component: 'Button',
              resultLabel: "You rejected Sam Palnet's request.",
              statusLabel: 'Rejected',
              child: 'rejectLabel',
              action: send('/reject 1'),
            },
            { id: 'rejectLabel', component: 'Text', text: 'Reject' },
            {
              id: 'allow',
              component: 'Button',
              variant: 'primary',
              resultLabel: 'You allowed Sam Palnet to DM the bot.',
              statusLabel: 'Allowed',
              child: 'allowLabel',
              action: send('/allow 1'),
            },
            { id: 'allowLabel', component: 'Text', text: 'Allow' },
          ],
        },
      },
    ],
  },
};

let renderer: ReactTestRenderer;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.consumedText = undefined;
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
function texts() {
  return renderer.root
    .findAllByType('Text' as never)
    .map((node) => ({ text: node.children.join(''), props: node.props }));
}

it('draws the kicker icon, the person row and a red Block', async () => {
  await render();
  expect(
    renderer.root.findAllByType('Icon' as never).map((icon) => icon.props.type)
  ).toContain('AddPerson');
  const entity = renderer.root.findByType('A2UIEntityRow' as never);
  expect(entity.props).toMatchObject({
    entity: { type: 'ship', id: '~sampel-palnet', name: 'Sam Palnet' },
    fallbackText: 'Sam Palnet (~sampel-palnet)',
  });
  expect(
    texts().find((node) => node.text === 'Hello there.')?.props.marginLeft
  ).toBe(46);
  const buttonTexts = renderer.root.findAllByType('ButtonText' as never);
  expect(buttonTexts.map((node) => node.children.join(''))).toEqual([
    'Block',
    'Reject',
    'Allow',
  ]);
  expect(buttonTexts[0].props.color).toBe('$negativeActionText');
  expect(buttonTexts[1].props.color).toBeUndefined();
});

it('replaces the buttons with the result and shows the status once answered', async () => {
  mocks.consumedText = '/allow 1';
  await render();
  expect(renderer.root.findAllByType('ButtonFrame' as never)).toHaveLength(0);
  const result = texts().find(
    (node) => node.text === 'You allowed Sam Palnet to DM the bot.'
  );
  expect(result?.props.color).toBe('$positiveActionText');
  const status = texts().find((node) => node.text === 'Allowed');
  expect(status?.props.color).toBe('$positiveActionText');
});

it('uses the destructive tone when Block was the answer', async () => {
  mocks.consumedText = '/ban 1';
  await render();
  const result = texts().find(
    (node) => node.text === 'You blocked Sam Palnet.'
  );
  expect(result?.props.color).toBe('$negativeActionText');
  expect(texts().find((node) => node.text === 'Blocked')).toBeDefined();
});

function requestBlock(subjectChildren: string[]): A2UIBlockData {
  return {
    type: 'a2ui',
    a2ui: {
      type: 'a2ui',
      version: 1,
      messages: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'req', catalogId: 'tlon.a2ui.basic.v1' },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'req',
            root: 'root',
            components: [
              { id: 'root', component: 'Card', child: 'body' },
              { id: 'body', component: 'Column', children: ['subject'] },
              { id: 'subject', component: 'Card', child: 'subjectBody' },
              {
                id: 'subjectBody',
                component: 'Column',
                children: subjectChildren,
              },
              {
                id: 'requester',
                component: 'Text',
                text: 'Nocsyx (~nocsyx-lassul)',
                entity: { type: 'ship', id: '~nocsyx-lassul' },
              },
              {
                id: 'reason',
                component: 'Text',
                variant: 'caption',
                text: 'wants to DM the bot',
              },
              { id: 'message', component: 'Text', text: 'Hi there.' },
              {
                id: 'meta',
                component: 'Row',
                children: ['metaText'],
              },
              {
                id: 'metaText',
                component: 'Text',
                variant: 'caption',
                text: 'Design · Garden Club',
              },
              { id: 'actions', component: 'Row', children: ['no', 'yes'] },
              {
                id: 'no',
                component: 'Button',
                child: 'noLabel',
                action: send('/reject 2'),
              },
              {
                id: 'yes',
                component: 'Button',
                variant: 'primary',
                child: 'yesLabel',
                action: send('/allow 2'),
              },
              { id: 'noLabel', component: 'Text', text: 'Reject' },
              { id: 'yesLabel', component: 'Text', text: 'Allow' },
            ],
          },
        },
      ],
    },
  };
}

it('joins a caption after a person row to its handle line', async () => {
  await act(async () => {
    renderer = create(
      <A2UIBlock
        block={requestBlock(['requester', 'reason', 'message', 'actions'])}
      />
    );
  });
  expect(
    renderer.root.findByType('A2UIEntityRow' as never).props
  ).toMatchObject({ compact: true, detail: 'wants to DM the bot' });
  expect(texts().map((node) => node.text)).not.toContain('wants to DM the bot');
  const message = texts().find((node) => node.text === 'Hi there.');
  expect(message?.props.marginTop).toBe(6);
});

it('draws the last row of an inner card as a footer line', async () => {
  await act(async () => {
    renderer = create(
      <A2UIBlock block={requestBlock(['requester', 'message', 'meta'])} />
    );
  });
  const footer = renderer.root
    .findAllByType('XStack' as never)
    .find((node) => node.props.borderTopWidth === 1);
  expect(footer?.props).toMatchObject({
    marginTop: 12,
    marginHorizontal: -14,
    paddingTop: 10,
  });
  expect(renderer.root.findByType('A2UIEntityRow' as never).props.compact).toBe(
    false
  );
});

it("centres text by a column's align but not by a row's", async () => {
  const centered: A2UIBlockData = {
    type: 'a2ui',
    a2ui: {
      type: 'a2ui',
      version: 1,
      messages: [
        {
          version: 'v0.9',
          createSurface: { surfaceId: 'al', catalogId: 'tlon.a2ui.basic.v1' },
        },
        {
          version: 'v0.9',
          updateComponents: {
            surfaceId: 'al',
            root: 'root',
            components: [
              { id: 'root', component: 'Card', child: 'body' },
              {
                id: 'body',
                component: 'Column',
                align: 'center',
                children: ['heading', 'row'],
              },
              { id: 'heading', component: 'Text', text: 'In a column' },
              {
                id: 'row',
                component: 'Row',
                align: 'center',
                justify: 'spaceBetween',
                children: ['rowText'],
              },
              { id: 'rowText', component: 'Text', text: 'In a row' },
            ],
          },
        },
      ],
    },
  };
  await act(async () => {
    renderer = create(<A2UIBlock block={centered} />);
  });
  const textAlign = (text: string) =>
    texts().find((node) => node.text === text)?.props.textAlign;
  expect(textAlign('In a column')).toBe('center');
  expect(textAlign('In a row')).toBeUndefined();
});
