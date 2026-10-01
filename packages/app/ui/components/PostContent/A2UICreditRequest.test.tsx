import { A2UI } from '@tloncorp/api';
import type { A2UIBlockData } from '@tloncorp/shared/logic';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { A2UIBlock } from './A2UIBlock';

const mocks = vi.hoisted(() => ({
  action: vi.fn(),
  consumed: false,
}));
vi.mock('@tloncorp/shared/logic', async () => ({
  A2UI: (await import('@tloncorp/api')).A2UI,
}));
vi.mock('@tloncorp/ui', () => ({
  Button: { Frame: 'ButtonFrame', Text: 'ButtonText' },
  Icon: 'Icon',
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
  useContentContext: () => ({
    onA2UIAction: mocks.action,
    isA2UIActionConsumed: () => mocks.consumed,
  }),
}));

const action = {
  event: {
    name: A2UI.action.requestCreditIncrease,
    context: { requestId: '697e119d-26da-4df7-a131-89f8a816a7dd' },
  },
};
const block: A2UIBlockData = {
  type: 'a2ui',
  a2ui: {
    type: 'a2ui',
    version: 1,
    messages: [
      {
        version: 'v0.9',
        createSurface: { surfaceId: 'credit', catalogId: 'tlon.a2ui.basic.v1' },
      },
      {
        version: 'v0.9',
        updateComponents: {
          surfaceId: 'credit',
          root: 'button',
          components: [
            {
              id: 'button',
              component: 'Button',
              child: 'label',
              action,
              consumedLabel: 'Credit Increase Requested',
            },
            { id: 'label', component: 'Text', text: 'Request credit increase' },
          ],
        },
      },
    ],
  },
};

let renderer: ReactTestRenderer;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  mocks.consumed = false;
  mocks.action.mockReset();
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
function button() {
  return renderer.root.findByType('ButtonFrame' as never);
}
function label() {
  return renderer.root.findByType('ButtonText' as never).children.join('');
}

it('locks while submitting, then relabels and disables without a chat selection', async () => {
  let finish!: () => void;
  mocks.action.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  await render();
  let pending!: Promise<void>;
  await act(async () => {
    pending = button().props.onPress();
  });
  expect(button().props.disabled).toBe(true);
  expect(label()).toBe('Request credit increase');
  expect(mocks.action).toHaveBeenCalledWith(action, undefined);
  await act(async () => {
    finish();
    await pending;
  });
  expect(label()).toBe('Credit Increase Requested');
  expect(button().props.disabled).toBe(true);
  expect(button().props.onPress).toBeUndefined();
});

it('keeps a failed request enabled for retry', async () => {
  mocks.action.mockRejectedValueOnce(new Error('offline'));
  await render();
  await act(async () => {
    await button().props.onPress();
  });
  expect(button().props.disabled).toBe(false);
  expect(label()).toBe('Request credit increase');
  await act(async () => {
    await button().props.onPress();
  });
  expect(label()).toBe('Credit Increase Requested');
});

it('renders a persisted completion as disabled immediately after remount', async () => {
  mocks.consumed = true;
  await render();
  expect(label()).toBe('Credit Increase Requested');
  expect(button().props.disabled).toBe(true);
  expect(mocks.action).not.toHaveBeenCalled();
});
