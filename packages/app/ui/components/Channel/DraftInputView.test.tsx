import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { DraftInputView } from './DraftInputView';

// React 19 warns unless the environment opts into `act`.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaView: 'SafeAreaView',
}));

vi.mock('react-native-keyboard-controller', () => ({
  KeyboardStickyView: 'KeyboardStickyView',
}));

vi.mock('tamagui', () => ({
  View: 'View',
}));

vi.mock('../../contexts/scroll', () => ({
  useConversationScrollToBottomControl: () => null,
  useConversationScrollViewNativeID: () => null,
}));

vi.mock('../ScrollEdgeElementContainer', () => ({
  ScrollEdgeElementContainer: 'ScrollEdgeElementContainer',
}));

vi.mock('../conversationScrollChrome', () => ({
  floatingScrollControlClearance: 0,
}));

vi.mock('../draftInputs', () => ({}));

vi.mock('../draftInputs/shared', () => ({
  DraftInputContextProvider: 'DraftInputContextProvider',
}));

vi.mock('./UnsupportedViewNotice', () => ({
  UnsupportedViewNotice: 'UnsupportedViewNotice',
}));

const inputs: Record<string, React.ComponentType<Record<string, unknown>>> = {};

vi.mock('../../contexts/componentsKits', async () => {
  const actual = await vi.importActual<
    typeof import('../../contexts/componentsKits/channelViews')
  >('../../contexts/componentsKits/channelViews');
  return {
    resolveChannelView: actual.resolveChannelView,
    useComponentsKitContext: () => ({ inputs }),
  };
});

const NOTICE = 'UnsupportedViewNotice' as unknown as React.ElementType;
const REGISTERED_INPUT = 'RegisteredInput' as unknown as React.ElementType;

function render(type: string) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(
      <DraftInputView draftInputContext={{} as never} type={type} />
    );
  });
  return renderer;
}

function findAll(renderer: ReactTestRenderer, type: React.ElementType) {
  return renderer.root.findAll((node) => node.type === type, { deep: true });
}

describe('DraftInputView', () => {
  it('renders the upgrade notice when the declared input is not registered', () => {
    const renderer = render('tlon.r0.view.mealPlan');

    const notices = findAll(renderer, NOTICE);
    expect(notices).toHaveLength(1);
    expect(notices[0]!.props).toMatchObject({
      slot: 'draft-input',
      viewId: 'tlon.r0.view.mealPlan',
    });
  });

  it('renders the input when the declared id is registered', () => {
    inputs['tlon.r0.input.chat'] = 'RegisteredInput' as never;
    try {
      const renderer = render('tlon.r0.input.chat');

      expect(findAll(renderer, NOTICE)).toHaveLength(0);
      expect(findAll(renderer, REGISTERED_INPUT)).toHaveLength(1);
    } finally {
      delete inputs['tlon.r0.input.chat'];
    }
  });
});
