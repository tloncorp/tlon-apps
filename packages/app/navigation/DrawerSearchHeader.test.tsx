import React, { createRef } from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { DrawerSearchHeader } from './DrawerSearchHeader';

vi.mock('react-native-reanimated', () => ({
  default: { View: 'AnimatedView' },
  Easing: { inOut: () => undefined, quad: undefined },
  useSharedValue: <T,>(value: T) => ({ value }),
  useAnimatedStyle: (style: () => object) => style(),
  interpolate: (value: number, input: number[], output: number[]) =>
    output[0] +
    ((value - input[0]) / (input[1] - input[0])) * (output[1] - output[0]),
}));
vi.mock('tamagui', () => ({
  View: 'View',
  getTokenValue: (token: string) =>
    ({ $4xl: 48, $m: 8 })[token as '$4xl' | '$m'] ?? 0,
  useTheme: () => ({ secondaryBackground: { val: '#eee' } }),
}));
vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Pressable: 'Pressable',
}));
vi.mock('../ui', () => ({
  RawTextInput: 'RawTextInput',
  interactionWithTiming: (value: number) => value,
}));
vi.mock('../ui/components/GlassSurface', () => ({
  GlassSurface: 'GlassSurface',
  supportsLiquidGlass: () => false,
}));

type Props = React.ComponentProps<typeof DrawerSearchHeader>;

function render(overrides: Partial<Props> = {}) {
  const props: Props = {
    children: 'tabs',
    open: false,
    query: '',
    disabled: false,
    onOpen: vi.fn(),
    onChangeQuery: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  const inputRef = createRef<never>();
  const focus = vi.fn();
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<DrawerSearchHeader {...props} ref={inputRef} />, {
      createNodeMock: () => ({ focus, blur: vi.fn() }),
    });
  });
  const root = renderer.root;
  return {
    props,
    focus,
    control: () => root.findByProps({ testID: 'TopLevelDrawerSearch' }),
    tabs: () =>
      root.find(
        (node) =>
          node.type === 'AnimatedView' &&
          node.props['aria-hidden'] !== undefined
      ),
    input: () => root.findAllByProps({ testID: 'TopLevelDrawerSearchInput' }),
    close: () => root.findByProps({ testID: 'TopLevelDrawerSearchClose' }),
  };
}

describe('DrawerSearchHeader', () => {
  it('shows the tabs and a control that opens the search', () => {
    const header = render();

    expect(header.input()).toHaveLength(0);
    expect(header.tabs().props['aria-hidden']).toBe(false);
    expect(header.tabs().props.pointerEvents).toBe('auto');

    header.control().props.onPress();

    expect(header.props.onOpen).toHaveBeenCalledTimes(1);
  });

  it('refuses to open while disabled', () => {
    const header = render({ disabled: true });

    expect(header.control().props.onPress).toBeUndefined();
    expect(header.control().props.accessibilityState).toMatchObject({
      disabled: true,
    });
  });

  it('opens into a focused field and puts the tabs out of reach', () => {
    const header = render({ open: true, query: 'tlon' });
    const [input] = header.input();

    expect(input.props.autoFocus).toBe(true);
    expect(input.props.value).toBe('tlon');
    expect(header.tabs().props['aria-hidden']).toBe(true);
    expect(header.tabs().props.pointerEvents).toBe('none');
  });

  it('hands typing to the caller, and its X closes the search', () => {
    const header = render({ open: true });
    const [input] = header.input();

    input.props.onChangeText('tl');
    header.close().props.onPress();

    expect(header.props.onChangeQuery).toHaveBeenCalledWith('tl');
    expect(header.props.onClose).toHaveBeenCalledTimes(1);
  });

  it('focuses the field when its glyph is pressed, rather than opening again', () => {
    const header = render({ open: true, disabled: true });

    header.control().props.onPress();

    expect(header.focus).toHaveBeenCalledTimes(1);
    expect(header.props.onOpen).not.toHaveBeenCalled();
  });
});
