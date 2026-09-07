import React from 'react';
import {
  ReactTestInstance,
  ReactTestRenderer,
  act,
  create,
} from 'react-test-renderer';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { ConversationScrollToBottomButton } from './conversationScrollChrome';

const mocks = vi.hoisted(() => ({
  liquidGlass: false,
  reducedMotion: false,
  withTiming: vi.fn((target: number, _options: unknown) => target),
  reducedMotionRead: vi.fn(),
  sharedValueRead: vi.fn(),
}));

vi.mock('@react-navigation/elements', async () => {
  const { createContext } =
    await vi.importActual<typeof import('react')>('react');
  return { HeaderHeightContext: createContext(0) };
});
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('../../navigation/nativeHeaderOptions', () => ({
  supportsNativeScrollEdgeChrome: () => false,
}));
vi.mock('./GlassSurface', () => ({
  supportsLiquidGlass: () => mocks.liquidGlass,
  GlassSurface: 'GlassSurface',
}));
vi.mock('react-native', () => ({
  Platform: { OS: 'ios', Version: '26.0' },
  Pressable: 'Pressable',
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock('@tloncorp/ui', async () => {
  const { createElement } =
    await vi.importActual<typeof import('react')>('react');
  return {
    // Preserve the real boundary's props and icon slot. Do not manufacture
    // accessibility semantics, dimensions or pointer-event behavior here.
    FloatingActionButton: (props: {
      icon: React.ReactNode;
      onPress: () => void;
    }) => createElement('FloatingActionButton', props, props.icon),
    Icon: 'Icon',
    LoadingSpinner: 'LoadingSpinner',
  };
});
vi.mock('react-native-reanimated', async () => {
  const { useRef } = await vi.importActual<typeof import('react')>('react');
  return {
    default: { View: 'AnimatedView' },
    Easing: {
      cubic: 'cubic',
      in: (easing: string) => `in(${easing})`,
      out: (easing: string) => `out(${easing})`,
    },
    useReducedMotion: () => {
      mocks.reducedMotionRead();
      return mocks.reducedMotion;
    },
    useSharedValue: (initialValue: number) => {
      mocks.sharedValueRead();
      return useRef({ value: initialValue }).current;
    },
    // Retain the production worklet for explicit inspection after effects.
    // withTiming commits its target synchronously: these tests prove React
    // lifecycle, transition requests and style endpoints, never native
    // animation progress, presented-frame smoothness or actual hit testing.
    useAnimatedStyle: (worklet: () => unknown) => worklet,
    withTiming: mocks.withTiming,
  };
});

type ButtonProps = React.ComponentProps<
  typeof ConversationScrollToBottomButton
>;

describe('ConversationScrollToBottomButton', () => {
  let renderer: ReactTestRenderer | undefined;
  let originalActEnvironment: unknown;
  const initialPress = vi.fn();

  beforeAll(() => {
    originalActEnvironment = (
      globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown }
    ).IS_REACT_ACT_ENVIRONMENT;
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    if (originalActEnvironment === undefined) {
      delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: unknown })
        .IS_REACT_ACT_ENVIRONMENT;
    } else {
      Object.assign(globalThis, {
        IS_REACT_ACT_ENVIRONMENT: originalActEnvironment,
      });
    }
  });

  beforeEach(() => {
    mocks.liquidGlass = false;
    mocks.reducedMotion = false;
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (renderer) act(() => renderer!.unmount());
    renderer = undefined;
  });

  async function render(props: Partial<ButtonProps> = {}) {
    await act(async () => {
      const element = (
        <ConversationScrollToBottomButton
          onPress={initialPress}
          visible={false}
          {...props}
        />
      );
      if (renderer) renderer.update(element);
      else renderer = create(element);
    });
  }

  function hosts(type: string) {
    return renderer!.root.findAll((node) => (node.type as unknown) === type);
  }

  function onlyHost(type: string) {
    const nodes = hosts(type);
    expect(nodes).toHaveLength(1);
    return nodes[0];
  }

  function expectOneControl() {
    // Restrict to host nodes so a component forwarding testID is not counted
    // twice. The ordinary testID belongs to its animated interaction wrapper.
    expect(
      renderer!.root.findAll(
        (node) =>
          typeof node.type === 'string' &&
          node.props.testID === 'ScrollToBottomButton'
      )
    ).toHaveLength(1);
  }

  function expectContent(loading: boolean) {
    expect(hosts('LoadingSpinner')).toHaveLength(loading ? 1 : 0);
    expect(hosts('Icon')).toHaveLength(loading ? 0 : 1);
    if (loading) expect(onlyHost('LoadingSpinner').props.size).toBe('small');
    else {
      expect(onlyHost('Icon').props).toMatchObject({
        type: 'ChevronDown',
        size: '$m',
      });
    }
  }

  function expectInteractionGate(wrapper: ReactTestInstance, visible: boolean) {
    expect(wrapper.props.pointerEvents).toBe(visible ? 'auto' : 'none');
    expect(wrapper.props.accessibilityElementsHidden).toBe(!visible);
    expect(wrapper.props.importantForAccessibility).toBe(
      visible ? 'auto' : 'no-hide-descendants'
    );
  }

  function expectEndpoint(wrapper: ReactTestInstance, visible: boolean) {
    expect(wrapper.props.style()).toEqual({
      opacity: visible ? 1 : 0,
      transform: [
        { translateY: visible ? 0 : 4 },
        { scale: visible ? 1 : 0.85 },
      ],
    });
  }

  describe('ordinary animated control', () => {
    it.each([false, true])(
      'gates the initially hidden control immediately (loading=%s)',
      async (loading) => {
        await render({ loading });

        const wrapper = onlyHost('AnimatedView');
        expectOneControl();
        onlyHost('FloatingActionButton');
        expect(hosts('Pressable')).toHaveLength(0);
        expect(hosts('GlassSurface')).toHaveLength(0);
        expectInteractionGate(wrapper, false);
        expectEndpoint(wrapper, false);
        expectContent(loading);
        expect(initialPress).not.toHaveBeenCalled();
      }
    );

    it.each([false, true])(
      'appears, reverses and disappears without duplicate controls (reduced motion=%s)',
      async (reducedMotion) => {
        mocks.reducedMotion = reducedMotion;
        await render();
        const wrapper = onlyHost('AnimatedView');
        const control = onlyHost('FloatingActionButton');
        mocks.withTiming.mockClear();

        for (const visible of [true, false, true, false]) {
          await render({ visible });
          expectOneControl();
          expect(onlyHost('AnimatedView')).toBe(wrapper);
          expect(onlyHost('FloatingActionButton')).toBe(control);
          expectInteractionGate(wrapper, visible);
          expectEndpoint(wrapper, visible);
          expect(mocks.withTiming).toHaveBeenLastCalledWith(visible ? 1 : 0, {
            duration: reducedMotion ? 0 : 200,
            easing: visible ? 'out(cubic)' : 'in(cubic)',
          });
        }

        expect(mocks.withTiming).toHaveBeenCalledTimes(4);
        expect(initialPress).not.toHaveBeenCalled();
      }
    );

    it.each([false, true])(
      'swaps loading content on rerenders without remounting or restarting the transition (visible=%s)',
      async (visible) => {
        await render({ visible });
        const wrapper = onlyHost('AnimatedView');
        const control = onlyHost('FloatingActionButton');
        expect(mocks.withTiming).toHaveBeenCalledOnce();
        mocks.withTiming.mockClear();

        for (const loading of [true, true, false, false, true, false]) {
          const onPress = vi.fn();
          await render({ visible, loading, onPress });
          expectOneControl();
          expect(onlyHost('AnimatedView')).toBe(wrapper);
          expect(onlyHost('FloatingActionButton')).toBe(control);
          expectInteractionGate(wrapper, visible);
          expectEndpoint(wrapper, visible);
          expectContent(loading);
          expect(control.props.onPress).toBe(onPress);
          if (visible) {
            act(() => control.props.onPress());
            expect(onPress).toHaveBeenCalledOnce();
          } else {
            // Test renderer does not implement native pointer dispatch. The
            // hidden wrapper's gating props, not a fabricated tap, are tested.
            expect(onPress).not.toHaveBeenCalled();
          }
        }

        expect(mocks.withTiming).not.toHaveBeenCalled();
        expect(initialPress).not.toHaveBeenCalled();
      }
    );

    it('uses zero duration when reduced motion is enabled on the mounted control', async () => {
      await render({ visible: true });
      const wrapper = onlyHost('AnimatedView');
      mocks.withTiming.mockClear();

      mocks.reducedMotion = true;
      await render({ visible: true });
      expect(onlyHost('AnimatedView')).toBe(wrapper);
      expect(mocks.withTiming).toHaveBeenCalledOnce();
      expect(mocks.withTiming).toHaveBeenCalledWith(1, {
        duration: 0,
        easing: 'out(cubic)',
      });
      expectEndpoint(wrapper, true);

      await render({ visible: false });
      expect(mocks.withTiming).toHaveBeenLastCalledWith(0, {
        duration: 0,
        easing: 'in(cubic)',
      });
      expectInteractionGate(wrapper, false);
      expectEndpoint(wrapper, false);
    });
  });

  describe('Liquid Glass control', () => {
    beforeEach(() => {
      mocks.liquidGlass = true;
    });

    function expectNoAnimation() {
      expect(hosts('AnimatedView')).toHaveLength(0);
      expect(hosts('FloatingActionButton')).toHaveLength(0);
      expect(mocks.reducedMotionRead).not.toHaveBeenCalled();
      expect(mocks.sharedValueRead).not.toHaveBeenCalled();
      expect(mocks.withTiming).not.toHaveBeenCalled();
    }

    it.each([false, true])(
      'does not mount a hidden control or spinner (loading=%s)',
      async (loading) => {
        await render({ loading });
        expect(renderer!.toJSON()).toBeNull();
        expectNoAnimation();
        expect(hosts('Pressable')).toHaveLength(0);
        expect(hosts('GlassSurface')).toHaveLength(0);
        expect(hosts('LoadingSpinner')).toHaveLength(0);
        expect(initialPress).not.toHaveBeenCalled();
      }
    );

    it.each([false, true])(
      'declares one accessible pressable and its target geometry (inComposer=%s)',
      async (inComposer) => {
        await render({ visible: true, inComposer });
        const surface = onlyHost('GlassSurface');
        const pressable = onlyHost('Pressable');
        expectOneControl();
        expectNoAnimation();
        expect(surface.props).toMatchObject({
          glassEffectStyle: 'regular',
          isInteractive: true,
        });
        const surfaceStyle = Object.assign({}, ...surface.props.style);
        expect(surfaceStyle).toMatchObject({
          width: 48,
          height: 48,
          borderRadius: 24,
          overflow: 'hidden',
        });
        if (inComposer) {
          expect(surfaceStyle).toMatchObject({
            position: 'absolute',
            top: 8,
            left: '50%',
            marginLeft: -12,
            zIndex: 1,
          });
        } else {
          expect(surfaceStyle.position).toBeUndefined();
        }
        expect(pressable.props).toMatchObject({
          accessibilityLabel: 'Scroll to bottom',
          accessibilityRole: 'button',
          hitSlop: 8,
          style: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        });
        expectContent(false);
        act(() => pressable.props.onPress());
        expect(initialPress).toHaveBeenCalledOnce();
      }
    );

    it.each([false, true])(
      'swaps loading content on the same pressable without entering the animation branch (reduced motion=%s)',
      async (reducedMotion) => {
        mocks.reducedMotion = reducedMotion;
        await render({ visible: true });
        const surface = onlyHost('GlassSurface');
        const pressable = onlyHost('Pressable');

        for (const loading of [true, true, false, false, true, false]) {
          const onPress = vi.fn();
          await render({ visible: true, loading, onPress });
          expectOneControl();
          expect(onlyHost('GlassSurface')).toBe(surface);
          expect(onlyHost('Pressable')).toBe(pressable);
          expectContent(loading);
          expect(pressable.props.accessibilityLabel).toBe('Scroll to bottom');
          expect(pressable.props.accessibilityRole).toBe('button');
          expect(pressable.props.hitSlop).toBe(8);
          expect(pressable.props.onPress).toBe(onPress);
          act(() => pressable.props.onPress());
          expect(onPress).toHaveBeenCalledOnce();
        }

        expectNoAnimation();
        expect(initialPress).not.toHaveBeenCalled();
      }
    );

    it('removes the whole interaction subtree on hide and returns exactly one control on show', async () => {
      for (const loading of [false, true, false]) {
        await render({ visible: true, loading });
        expectOneControl();
        onlyHost('GlassSurface');
        const pressable = onlyHost('Pressable');
        expectContent(loading);
        act(() => pressable.props.onPress());

        await render({ visible: false, loading });
        expect(renderer!.toJSON()).toBeNull();
        expect(hosts('Pressable')).toHaveLength(0);
        expect(hosts('GlassSurface')).toHaveLength(0);
        expect(hosts('Icon')).toHaveLength(0);
        expect(hosts('LoadingSpinner')).toHaveLength(0);
      }

      expectNoAnimation();
      expect(initialPress).toHaveBeenCalledTimes(3);
    });
  });
});
