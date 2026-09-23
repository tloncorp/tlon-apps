import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

type KeyboardEvent = { height: number; progress: number };
const keyboard = vi.hoisted(() => ({
  platform: 'ios' as 'ios' | 'android' | 'web',
  visible: false,
  height: 0,
  providerHeight: { value: 0 },
  providerProgress: { value: 0 },
  handlers: {} as Record<string, (event: KeyboardEvent) => void>,
  style: () => ({ transform: [{ translateY: 0 }] }),
}));

const composer = vi.hoisted(() => ({
  reports: [] as Array<[number, number]>,
}));

vi.mock('@tloncorp/api', () => ({ DraftInputId: { chat: 'chat' } }));
vi.mock('react-native', () => ({
  Platform: {
    get OS() {
      return keyboard.platform;
    },
  },
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
  useKeyboardState: <T,>(selector: (state: { isVisible: boolean }) => T) =>
    selector({ isVisible: keyboard.visible }),
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
  useTheme: () => ({ background: '#fff' }),
  getVariableValue: (value: unknown) => value,
}));
vi.mock('../../contexts/componentsKits', () => ({}));
vi.mock('../../contexts/scroll', () => ({
  useConversationScrollViewNativeID: () => undefined,
  useConversationScrollToBottomControl: () => undefined,
  useConversationComposerHeight: () => ({
    report: (height: number, collapsibleInset: number) => {
      composer.reports.push([height, collapsibleInset]);
    },
  }),
}));
vi.mock('../ScrollEdgeElementContainer', () => ({
  ScrollEdgeElementContainer: 'ScrollEdgeElementContainer',
}));
vi.mock('../conversationScrollChrome', () => ({
  floatingScrollControlClearance: 0,
  unobscuredConversationBottomGap: 8,
}));
vi.mock('../draftInputs/shared', () => ({}));

let renderer: ReactTestRenderer | undefined;
let ConversationComposerPlacement: typeof import('./DraftInputView').ConversationComposerPlacement;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  keyboard.visible = false;
  keyboard.height = 0;
  keyboard.providerHeight.value = 0;
  keyboard.providerProgress.value = 0;
  keyboard.handlers = {};
  keyboard.style = () => ({ transform: [{ translateY: 0 }] });
  // The platform-specific wrapper is selected when the module is loaded.
  vi.resetModules();
  ({ ConversationComposerPlacement } =
    await vi.importActual<typeof import('./DraftInputView')>(
      './DraftInputView'
    ));
});

afterEach(() => {
  act(() => renderer?.unmount());
  renderer = undefined;
  delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
    .IS_REACT_ACT_ENVIRONMENT;
});

function emit(name: string, height: number) {
  const event = { height, progress: height / 300 };
  // Match KeyboardProvider: iOS publishes the target on start; Android updates
  // its shared values on each move/end. Both publish interactive frames.
  if (
    name === 'onInteractive' ||
    (keyboard.platform === 'ios' && name === 'onStart') ||
    (keyboard.platform === 'android' && (name === 'onMove' || name === 'onEnd'))
  ) {
    keyboard.providerHeight.value = -height;
    keyboard.providerProgress.value = event.progress;
  }
  keyboard.handlers[name]?.(event);
}

const offset = () => keyboard.style().transform[0].translateY;

describe.each(['ios', 'android'] as const)('%s', (platform) => {
  beforeAll(() => {
    keyboard.platform = platform;
  });

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
});

describe('web inline replies', () => {
  beforeAll(() => {
    keyboard.platform = 'web';
  });

  it('does not add native keyboard tracking', () => {
    act(() => {
      renderer = create(
        <ConversationComposerPlacement enabled={false} avoidKeyboard>
          <input />
        </ConversationComposerPlacement>
      );
    });
    expect(renderer!.root.findAllByType('input')).toHaveLength(1);
    expect(
      renderer!.root.findAll(
        (node) => (node.type as unknown) === 'AnimatedView'
      )
    ).toHaveLength(0);
    expect(keyboard.handlers).toEqual({});
  });
});

describe('floating composer bottom clearance', () => {
  beforeAll(() => {
    keyboard.platform = 'ios';
  });

  function paddingBottomFor(bottomChromeClearance?: number) {
    act(() => {
      renderer = create(
        <ConversationComposerPlacement
          enabled
          bottomChromeClearance={bottomChromeClearance}
        >
          <input />
        </ConversationComposerPlacement>
      );
    });
    const style = renderer!.root.findByType(
      'ScrollEdgeElementContainer' as never
    ).props.style as { paddingBottom: number }[];
    return style[0].paddingBottom;
  }

  it('clears only the home indicator when no chrome sits below', () => {
    expect(paddingBottomFor()).toBe(34);
  });

  it('clears the tab bar and its gap when one does', () => {
    expect(paddingBottomFor(84)).toBe(92);
  });

  it('keeps its padding while the keyboard is open', () => {
    // Padding and the sticky view's offset must agree, so neither may change on
    // keyboard visibility — doing so jumps the composer mid-animation.
    keyboard.visible = true;
    try {
      expect(paddingBottomFor(84)).toBe(92);
    } finally {
      keyboard.visible = false;
    }
  });

  it('reports the part of its height the keyboard collapses', () => {
    composer.reports.length = 0;
    act(() => {
      renderer = create(
        <ConversationComposerPlacement enabled bottomChromeClearance={84}>
          <input />
        </ConversationComposerPlacement>
      );
    });
    act(() => {
      renderer!.root
        .findByType('ScrollEdgeElementContainer' as never)
        .props.onLayout({ nativeEvent: { layout: { height: 140 } } });
    });

    // 92pt of padding, of which the 34pt home indicator still counts.
    expect(composer.reports.at(-1)).toEqual([140, 58]);
  });

  it('does not stack the safe area on top of the clearance', () => {
    // The tab bar's band already covers the home indicator, so a bar shorter
    // than the safe area must not push the composer past it.
    expect(paddingBottomFor(10)).toBe(34);
  });
});
