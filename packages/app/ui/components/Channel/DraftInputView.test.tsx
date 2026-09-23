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
  style: (() => ({ transform: [{ translateY: 0 }] })) as () => {
    transform?: { translateY: number }[];
    paddingBottom?: number;
  },
  styles: [] as (() => {
    transform?: { translateY: number }[];
    paddingBottom?: number;
  })[],
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
}));
vi.mock('react-native-keyboard-controller/src/hooks', () => ({
  useReanimatedKeyboardAnimation: () => ({
    height: keyboard.providerHeight,
    progress: keyboard.providerProgress,
  }),
}));
vi.mock('react-native-reanimated', async () => {
  const { useRef } = await import('react');
  return {
    default: { View: 'AnimatedView' },
    useSharedValue: <T,>(value: T) => useRef({ value }).current,
    useAnimatedStyle: (style: typeof keyboard.style) => {
      keyboard.style = style;
      keyboard.styles.push(style);
      return style();
    },
    useDerivedValue: <T,>(compute: () => T) => ({
      get value() {
        return compute();
      },
    }),
    interpolate: (value: number, input: number[], output: number[]) =>
      output[0] +
      ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
  };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 34 }),
}));
vi.mock('tamagui', () => ({
  View: 'View',
  YStack: 'YStack',
  useTheme: () => ({ background: '#fff' }),
  getVariableValue: (value: unknown) => value,
}));
vi.mock('../../contexts/componentsKits', () => ({}));
vi.mock('../../contexts/scroll', () => ({
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
let ConversationLayout: typeof import('./ConversationLayout').ConversationLayout;
let useConversationComposerLayout: typeof import('./ConversationLayout').useConversationComposerLayout;
let ConversationComposerPlacement: typeof import('./DraftInputView').ConversationComposerPlacement;

beforeEach(async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  keyboard.visible = false;
  keyboard.height = 0;
  keyboard.providerHeight.value = 0;
  keyboard.providerProgress.value = 0;
  keyboard.handlers = {};
  keyboard.style = () => ({ transform: [{ translateY: 0 }] });
  keyboard.styles = [];
  // The platform-specific wrapper is selected when the module is loaded.
  vi.resetModules();
  ({ ConversationLayout, useConversationComposerLayout } =
    await vi.importActual<typeof import('./ConversationLayout')>(
      './ConversationLayout'
    ));
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

const offset = () => keyboard.style().transform![0].translateY;
const latestStyle = (key: 'paddingBottom' | 'transform') =>
  keyboard.styles.findLast((style) => key in style())!();
// iOS keeps the conversation frame fixed and translates its composer instead.
const containerPadding = () => latestStyle('paddingBottom').paddingBottom;
const composerLift = () => -latestStyle('transform').transform![0].translateY;
const expectKeyboardClearance = (overlap: number) => {
  const ios = keyboard.platform === 'ios';
  expect(containerPadding()).toBe(ios ? 0 : overlap);
  expect(composerLift()).toBe(ios ? overlap : 0);
};
const findComposer = () =>
  renderer!.root.find(
    (node) =>
      (node.type as unknown) === 'AnimatedView' &&
      Array.isArray(node.props.style) &&
      node.props.style[0]?.flexShrink === 0
  );
const composerStyle = () =>
  Object.assign({}, ...findComposer().props.style.filter(Boolean));

describe.each(['ios', 'android'] as const)('%s', (platform) => {
  beforeAll(() => {
    keyboard.platform = platform;
  });

  it('preserves the input instance and draft while docking and floating above the keyboard', () => {
    let layout: ReturnType<typeof useConversationComposerLayout>;
    let changeDraft: React.Dispatch<React.SetStateAction<string>>;
    let mounts = 0;
    function Draft() {
      layout = useConversationComposerLayout();
      const [draft, setDraft] = React.useState('');
      changeDraft = setDraft;
      React.useEffect(() => {
        mounts += 1;
      }, []);
      return <input value={draft} />;
    }
    act(() => {
      renderer = create(
        <ConversationLayout enabled>
          <section />
          <ConversationComposerPlacement enabled>
            <Draft />
          </ConversationComposerPlacement>
        </ConversationLayout>
      );
    });
    act(() => changeDraft('Keep this draft'));
    emit('onEnd', 300);
    act(() => layout.setFloating(true));
    expect(composerStyle().position).toBe('absolute');
    expect(composerStyle().bottom).toBe(0);
    expect(
      findComposer().findByType('View' as never).props.backgroundColor
    ).toBe('transparent');
    expectKeyboardClearance(266);
    act(() => layout.setFloating(false));
    expect(renderer!.root.findByType('input').props.value).toBe(
      'Keep this draft'
    );
    expect(mounts).toBe(1);
  });

  it('gives the list and composer a shared resizing keyboard container', () => {
    act(() => {
      renderer = create(
        <ConversationLayout enabled>
          <section />
          <ConversationComposerPlacement enabled>
            <input />
          </ConversationComposerPlacement>
        </ConversationLayout>
      );
    });
    expectKeyboardClearance(0);
    emit('onStart', 300);
    expectKeyboardClearance(0);
    emit('onMove', 150);
    expectKeyboardClearance(133);
    emit('onEnd', 300);
    expectKeyboardClearance(266);
    emit('onInteractive', 150);
    expectKeyboardClearance(133);
    emit('onEnd', 0);
    expectKeyboardClearance(0);
    expect(findComposer().findByType('View' as never).props.paddingBottom).toBe(
      34
    );
    expect(composerStyle().position).toBeUndefined();
  });

  it('reserves the current keyboard overlap when a docked conversation mounts with it open', () => {
    keyboard.visible = true;
    keyboard.height = 300;
    act(() => {
      renderer = create(
        <ConversationLayout enabled>
          <section />
          <ConversationComposerPlacement enabled>
            <input />
          </ConversationComposerPlacement>
        </ConversationLayout>
      );
    });
    expectKeyboardClearance(266);
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
