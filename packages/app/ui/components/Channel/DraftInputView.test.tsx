import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConversationComposerPlacement } from './DraftInputView';

type KeyboardEvent = { height: number; progress: number };
const keyboard = vi.hoisted(() => ({
  visible: false,
  height: 0,
  providerHeight: { value: 0 },
  providerProgress: { value: 0 },
  handlers: {} as Record<string, (event: KeyboardEvent) => void>,
  style: () => ({ transform: [{ translateY: 0 }] }),
}));

vi.mock('@tloncorp/api', () => ({ DraftInputId: { chat: 'chat' } }));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios' },
  StyleSheet: { create: (styles: unknown) => styles },
}));
vi.mock('react-native-keyboard-controller', async () => ({
  // Exercise the installed sticky view too: the pre-fix inline path must fail
  // because of its actual animated style, not because of a component-name check.
  KeyboardStickyView: (
    await vi.importActual<
      typeof import('react-native-keyboard-controller/src/components/KeyboardStickyView')
    >('react-native-keyboard-controller/src/components/KeyboardStickyView')
  ).default,
  KeyboardController: {
    isVisible: () => keyboard.visible,
    state: () => ({ height: keyboard.height }),
  },
  useKeyboardHandler: (handlers: typeof keyboard.handlers) => {
    keyboard.handlers = handlers;
  },
}));
vi.mock('react-native-keyboard-controller/src/hooks', () => ({
  useReanimatedKeyboardAnimation: () => ({
    height: keyboard.providerHeight,
    progress: keyboard.providerProgress,
  }),
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  useSharedValue: <T,>(value: T) => ({ value }),
  useAnimatedStyle: (style: typeof keyboard.style) => {
    keyboard.style = style;
    return style();
  },
  interpolate: (value: number, input: number[], output: number[]) =>
    output[0] +
    ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34 }),
}));
vi.mock('tamagui', () => ({
  View: 'View',
  useTheme: () => ({}),
}));
vi.mock('../../contexts/componentsKits', () => ({}));
vi.mock('../../contexts/scroll', () => ({
  useConversationScrollViewNativeID: () => undefined,
  useConversationScrollToBottomControl: () => undefined,
  useConversationComposerHeight: () => ({ report: () => {} }),
}));
vi.mock('../ScrollEdgeElementContainer', () => ({
  ScrollEdgeElementContainer: 'ScrollEdgeElementContainer',
}));
vi.mock('../conversationScrollChrome', () => ({
  floatingScrollControlClearance: 0,
}));
vi.mock('../draftInputs/shared', () => ({}));

let renderer: ReactTestRenderer | undefined;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  keyboard.visible = false;
  keyboard.height = 0;
  keyboard.providerHeight.value = 0;
  keyboard.providerProgress.value = 0;
  keyboard.handlers = {};
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

function emit(name: string, height: number) {
  const event = { height, progress: height / 300 };
  // KeyboardProvider updates its iOS shared values on start and interactive
  // events, while useKeyboardHandler also receives each native move/end frame.
  if (name === 'onStart' || name === 'onInteractive') {
    keyboard.providerHeight.value = -height;
    keyboard.providerProgress.value = event.progress;
  }
  keyboard.handlers[name]?.(event);
}

const offset = () => keyboard.style().transform[0].translateY;

describe.each([
  ['inline notebook/gallery reply', false],
  ['floating chat composer', true],
] as const)('%s keyboard tracking', (_name, floating) => {
  function mount() {
    act(() => {
      renderer = create(
        <ConversationComposerPlacement
          enabled={floating}
          avoidKeyboard={!floating}
        >
          <input />
        </ConversationComposerPlacement>
      );
    });
  }

  it('follows native opening and closing frames without jumping on start', () => {
    mount();
    expect(offset()).toBe(0);
    emit('onStart', 300);
    expect(offset()).toBe(0);
    emit('onMove', 150);
    expect(offset()).toBe(-133);
    emit('onEnd', 300);
    expect(offset()).toBe(-266);

    emit('onStart', 0);
    expect(offset()).toBe(-266);
    emit('onMove', 150);
    expect(offset()).toBe(-133);
    emit('onEnd', 0);
    expect(offset()).toBe(0);
  });

  it('tracks interactive dismissal and its cancellation', () => {
    mount();
    emit('onStart', 300);
    emit('onEnd', 300);
    emit('onInteractive', 150);
    expect(offset()).toBe(-133);
    emit('onInteractive', 300);
    expect(offset()).toBe(-266);
    emit('onInteractive', 0);
    expect(offset()).toBe(0);
  });

  it('starts at the current offset when mounted with the keyboard open', () => {
    keyboard.visible = true;
    keyboard.height = 300;
    keyboard.providerHeight.value = -300;
    keyboard.providerProgress.value = 1;
    mount();
    expect(offset()).toBe(-266);
  });
});
