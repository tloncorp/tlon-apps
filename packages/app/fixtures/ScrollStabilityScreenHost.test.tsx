import { createElement, useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const runtime = vi.hoisted(() => ({ OS: 'ios' }));
vi.mock('react-native', () => ({ Platform: runtime }));
vi.mock('react-native-screens', () => ({
  Screen: 'NativeScreen',
  ScreenContainer: 'NativeScreenContainer',
}));
import { Screen, ScreenContainer } from 'react-native-screens';
import { ScrollStabilityScreenHost } from './ScrollStabilityScreenHost';

let renderer: ReactTestRenderer | undefined;
beforeEach(() => {
  runtime.OS = 'ios';
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
});
afterEach(async () => {
  await act(async () => renderer?.unmount());
  renderer = undefined;
});

describe('native fixture screen lifecycle host wiring', () => {
  it('mounts one actual-enabled screen with normal active state and no synthetic lifecycle callbacks', async () => {
    await act(async () => {
      renderer = create(
        <ScrollStabilityScreenHost>
          {createElement('div')}
        </ScrollStabilityScreenHost>
      );
    });
    const container = renderer!.root.findByType(ScreenContainer);
    const screen = renderer!.root.findByType(Screen);
    expect(container.props).toMatchObject({
      enabled: true,
      style: { flex: 1 },
    });
    expect(screen.props).toMatchObject({
      enabled: true,
      activityState: 2,
      freezeOnBlur: false,
      style: { flex: 1 },
    });
    expect(Object.keys(screen.props).sort()).toEqual(
      ['enabled', 'activityState', 'freezeOnBlur', 'style', 'children'].sort()
    );
    expect(container.findAllByType(Screen)).toHaveLength(1);
    expect(screen.findAllByType('div')).toHaveLength(1);
  });

  it('retains the native screen and child lifetime when fixture content changes', async () => {
    const mount = vi.fn();
    const dispose = vi.fn();
    function Child({ value }: { value: string }) {
      useEffect(() => {
        mount();
        return dispose;
      }, []);
      return createElement('div', { value });
    }
    await act(async () => {
      renderer = create(
        <ScrollStabilityScreenHost>
          <Child value="before" />
        </ScrollStabilityScreenHost>
      );
    });
    const screen = renderer!.root.findByType(Screen);
    await act(async () => {
      renderer!.update(
        <ScrollStabilityScreenHost>
          <Child value="after" />
        </ScrollStabilityScreenHost>
      );
    });
    expect(renderer!.root.findByType(Screen)).toBe(screen);
    expect(mount).toHaveBeenCalledTimes(1);
    expect(dispose).not.toHaveBeenCalled();
    expect(renderer!.root.findByType('div').props.value).toBe('after');
  });

  it.each(['web', 'android'])(
    'preserves the existing %s child tree',
    async (platform) => {
      runtime.OS = platform;
      await act(async () => {
        renderer = create(
          <ScrollStabilityScreenHost>
            {createElement('div')}
          </ScrollStabilityScreenHost>
        );
      });
      expect(renderer!.root.findAllByType(Screen)).toHaveLength(0);
      expect(renderer!.toJSON()).toEqual({
        type: 'div',
        props: {},
        children: null,
      });
    }
  );
});
