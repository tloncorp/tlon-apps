import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatKeyboard } from 'react-native-keyboard-controller/src/components/KeyboardChatScrollView/useChatKeyboard/index.ios';

const state = vi.hoisted(() => ({
  handlers: {} as Record<
    string,
    (e: {
      height: number;
      progress: number;
      duration: number;
      target: number;
    }) => void
  >,
  scroll: { value: 1200 },
  layout: { value: { width: 400, height: 800 } },
  size: { value: { width: 400, height: 2000 } },
}));

vi.mock('react-native-reanimated', () => ({
  useSharedValue: <T>(value: T) => ({ value }),
  interpolate: (value: number, input: number[], output: number[]) =>
    output[0] +
    ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
}));
vi.mock('react-native-keyboard-controller/src/hooks', () => ({
  useKeyboardHandler: (handlers: typeof state.handlers) => {
    state.handlers = handlers;
  },
}));
vi.mock(
  'react-native-keyboard-controller/src/components/hooks/useScrollState',
  () => ({
    default: () => ({
      offset: state.scroll,
      layout: state.layout,
      size: state.size,
      onLayout: vi.fn(),
      onContentSizeChange: vi.fn(),
    }),
  })
);

const event = (height: number, duration = 250) => ({
  height,
  progress: height / 300,
  duration,
  target: 1,
});

describe('patched iOS keyboard tracking', () => {
  beforeEach(() => {
    state.scroll.value = 1200;
  });

  function setup(freeze = { value: false }) {
    // All hooks are mocked above; exercise the registered handlers without React.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useChatKeyboard(vi.fn() as never, {
      inverted: false,
      keyboardLiftBehavior: 'whenAtEnd',
      offset: 0,
      freeze: freeze as never,
      blankSpace: { value: 0 } as never,
      extraContentPadding: { value: 0 } as never,
    });
  }

  it('does not apply the final inset or offset on first focus', () => {
    const result = setup();
    state.handlers.onStart(event(300));
    expect(result.padding.value).toBe(0);
    expect(result.contentOffsetY?.value).toBe(1200);
    state.handlers.onMove(event(150));
    expect(result.padding.value).toBe(150);
    expect(result.contentOffsetY?.value).toBe(1350);
    state.handlers.onEnd(event(300));
    expect(result.padding.value).toBe(300);
    expect(result.contentOffsetY?.value).toBe(1500);
  });

  it('tracks dismissal without jumping to the closed position at start', () => {
    const result = setup();
    state.handlers.onStart(event(300));
    state.handlers.onEnd(event(300));
    state.scroll.value = 1500;
    state.handlers.onStart(event(0));
    expect(result.padding.value).toBe(300);
    expect(result.contentOffsetY?.value).toBe(1500);
    state.handlers.onMove(event(150));
    expect(result.padding.value).toBe(150);
    expect(result.contentOffsetY?.value).toBe(1350);
    state.handlers.onEnd(event(0));
    expect(result.padding.value).toBe(0);
    expect(result.contentOffsetY?.value).toBe(1200);
  });

  it('preserves reading position away from the end', () => {
    state.scroll.value = 600;
    const result = setup();
    state.handlers.onStart(event(300));
    state.handlers.onMove(event(150));
    expect(result.contentOffsetY?.value).toBe(600);
    state.handlers.onEnd(event(300));
    expect(result.contentOffsetY?.value).toBe(600);
  });

  it('settles immediately when the system reports no animation', () => {
    const result = setup();
    state.handlers.onStart(event(300, 0));
    expect(result.padding.value).toBe(300);
    expect(result.contentOffsetY?.value).toBe(1500);
  });

  it('starts an interrupted close from the current frame', () => {
    const result = setup();
    state.handlers.onStart(event(300));
    state.handlers.onMove(event(150));
    state.scroll.value = 1350;
    state.handlers.onStart(event(0));
    expect(result.padding.value).toBe(150);
    state.handlers.onMove(event(75));
    expect(result.padding.value).toBe(75);
    expect(result.contentOffsetY?.value).toBe(1275);
  });

  it('does not replay a settled scroll destination on a duplicate end event', () => {
    const result = setup();
    state.handlers.onStart(event(300));
    state.handlers.onEnd(event(300));
    result.contentOffsetY!.value = 900;
    state.scroll.value = 900;
    state.handlers.onEnd(event(300));
    expect(result.contentOffsetY?.value).toBe(900);
  });

  it('keeps a composer-height adjustment made between keyboard frames', () => {
    const result = setup();
    state.handlers.onStart(event(300));
    state.handlers.onMove(event(150));
    result.contentOffsetY!.value += 50;
    state.handlers.onEnd(event(300));
    expect(result.contentOffsetY?.value).toBe(1550);
  });

  it('keeps the observed height current while layout writes are frozen', () => {
    const freeze = { value: true };
    const result = setup(freeze);
    state.handlers.onStart(event(300));
    state.handlers.onMove(event(150));
    state.handlers.onEnd(event(300));
    expect(result.padding.value).toBe(0);
    expect(result.currentHeight.value).toBe(300);
    freeze.value = false;
    // useFrozenPadding reconciles the inset on unfreeze.
    result.padding.value = 300;
    state.scroll.value = 1500;
    state.handlers.onStart(event(0));
    state.handlers.onMove(event(150));
    expect(result.padding.value).toBe(150);
    expect(result.contentOffsetY?.value).toBe(1350);
  });
});
