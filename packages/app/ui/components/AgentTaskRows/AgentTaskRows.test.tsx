import React from 'react';
import Animated from 'react-native-reanimated';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AgentTaskRows } from './AgentTaskRows';

const { darkMode } = vi.hoisted(() => ({
  darkMode: { value: false },
}));

vi.mock('../../../hooks/useDarkMode', () => ({
  useIsDarkMode: () => darkMode.value,
}));

vi.mock('@tloncorp/ui', () => ({
  Icon: 'Icon',
  Pressable: 'Pressable',
}));

vi.mock('react-native', () => ({
  StyleSheet: { create: (styles: unknown) => styles },
  View: 'NativeView',
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Circle: 'SvgCircle',
}));

vi.mock('react-native-reanimated', () => {
  const View = 'AnimatedView';
  return {
    default: {
      View,
      createAnimatedComponent: () => 'AnimatedSvgCircle',
    },
    Easing: {
      cubic: 'cubic',
      linear: 'linear',
      out: (value: unknown) => value,
      inOut: (value: unknown) => value,
    },
    FadeIn: {
      duration: () => ({ easing: () => 'fade-in' }),
    },
    useAnimatedProps: (factory: () => unknown) => factory(),
    useAnimatedStyle: (factory: () => unknown) => factory(),
    useReducedMotion: () => true,
    useSharedValue: (value: unknown) => ({ value }),
    withRepeat: (value: unknown) => value,
    withTiming: (value: unknown) => value,
  };
});

vi.mock('tamagui', () => ({
  Circle: 'Circle',
  SizableText: 'SizableText',
  View: 'View',
  XStack: 'XStack',
  YStack: 'YStack',
  getVariableValue: (value: { val?: string } | string) =>
    typeof value === 'string' ? value : value.val,
  useTheme: () => ({
    border: { val: '#ddd' },
    secondaryText: { val: '#777' },
    shadow: { val: '#000' },
  }),
}));

describe('AgentTaskRows rendered states', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  beforeEach(() => {
    darkMode.value = false;
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders waiting and determinate progress with explicit accessibility state', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentTaskRows
          rows={[
            {
              id: 'waiting',
              sequence: 1,
              title: 'Confirm the group name',
              subtitle: 'Waiting on you',
              status: 'waiting',
            },
            {
              id: 'running',
              sequence: 2,
              title: 'Create the group',
              status: 'running',
              progress: 0.4,
            },
            {
              id: 'approval',
              sequence: 3,
              title: 'Approve publishing',
              subtitle: 'Waiting for approval',
              status: 'waiting',
              waitingLabel: 'Waiting for approval',
            },
          ]}
        />
      );
    });

    expect(
      renderer!.root.findByProps({
        'aria-label': 'Confirm the group name, Waiting on you, Waiting on you',
      })
    ).toBeTruthy();
    expect(
      renderer!.root.findByProps({
        'aria-label':
          'Approve publishing, Waiting for approval, Waiting for approval',
      })
    ).toBeTruthy();
    const progress = renderer!.root.findByProps({ role: 'progressbar' });
    expect(progress.props['aria-valuemin']).toBe(0);
    expect(progress.props['aria-valuemax']).toBe(100);
    expect(progress.props['aria-valuenow']).toBe(40);

    act(() => renderer!.unmount());
  });

  it('keeps a terminal row expandable after the run ends', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentTaskRows
          rows={[
            {
              id: 'done',
              sequence: 1,
              title: 'Published the page',
              subtitle: 'Completed',
              status: 'completed',
              details: [{ label: 'Outcome', value: 'Page is live.' }],
            },
          ]}
        />
      );
    });

    expect(JSON.stringify(renderer!.toJSON())).not.toContain('Page is live.');
    const disclosure = renderer!.root.findByProps({
      'aria-label': 'Published the page, Completed, Completed',
    });
    const preventDefault = vi.fn();
    expect(disclosure.props.role).toBe('button');
    expect(disclosure.props.tabIndex).toBe(0);
    expect(disclosure.props.focusStyle).toBeUndefined();
    expect(disclosure.props.focusVisibleStyle).toMatchObject({
      outlineStyle: 'solid',
      outlineWidth: 2,
    });
    await act(async () =>
      disclosure.props.onKeyDown({ key: 'Enter', preventDefault })
    );
    expect(JSON.stringify(renderer!.toJSON())).toContain('Page is live.');
    expect(disclosure.props['aria-expanded']).toBe(true);
    expect(preventDefault).toHaveBeenCalledOnce();

    act(() => renderer!.unmount());
  });

  it('does not advertise rows without details as interactive', async () => {
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentTaskRows
          rows={[
            {
              id: 'pending',
              sequence: 1,
              title: 'Wait for the next step',
              status: 'pending',
            },
          ]}
        />
      );
    });

    const row = renderer!.root.findByProps({
      'aria-label': 'Wait for the next step, Not started',
    });
    expect(row.props.disabled).toBe(true);
    expect(row.props.cursor).toBe('default');
    expect(row.props.role).toBeUndefined();
    expect(row.props.tabIndex).toBeUndefined();
    expect(row.props.onKeyDown).toBeUndefined();
    expect(row.props.hoverStyle).toBeUndefined();

    act(() => renderer!.unmount());
  });

  it('uses a crisp border instead of card shadows in dark themes', async () => {
    darkMode.value = true;
    let renderer: ReactTestRenderer;
    await act(async () => {
      renderer = create(
        <AgentTaskRows
          rows={[
            {
              id: 'dark-row',
              sequence: 1,
              title: 'Publish the result',
              status: 'running',
            },
          ]}
        />
      );
    });

    const animatedViews = renderer!.root.findAllByType(Animated.View);
    expect(animatedViews[0].props.style).toBeUndefined();
    expect(animatedViews[1].props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ borderColor: '#ddd', borderWidth: 1 }),
      ])
    );

    act(() => renderer!.unmount());
  });
});
