import React, { act } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import Pressable from './Pressable';

const navigate = vi.hoisted(() => vi.fn());

vi.mock('tamagui', () => ({ isWeb: false, View: 'View' }));
vi.mock('@react-navigation/native', () => ({
  useLinkProps: ({ href }: { href: string }) => {
    // The node-ready screen's plain button has no navigation context.
    if (!href) throw new Error('No navigation context');
    return { href, onPress: navigate };
  },
}));

describe('Pressable', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });
  it('runs a plain button without navigation context', async () => {
    const onPress = vi.fn();
    let tree!: ReactTestRenderer;
    await act(() => {
      tree = create(<Pressable onPress={onPress}>Continue</Pressable>);
    });
    tree.root.findByType('View').props.onPress();
    expect(onPress).toHaveBeenCalledOnce();
    await act(() => tree.unmount());
  });

  it('keeps link navigation when switching between button and link', async () => {
    const onPress = vi.fn();
    let tree!: ReactTestRenderer;
    await act(() => {
      tree = create(<Pressable onPress={onPress}>Open</Pressable>);
    });
    await act(() => {
      tree.update(
        <Pressable to="/home" onPress={onPress}>
          Open
        </Pressable>
      );
    });
    tree.root.findByType('View').props.onPress();
    expect(navigate).toHaveBeenCalledOnce();
    expect(onPress).not.toHaveBeenCalled();
    await act(() => {
      tree.update(<Pressable onPress={onPress}>Open</Pressable>);
    });
    tree.root.findByType('View').props.onPress();
    expect(onPress).toHaveBeenCalledOnce();
    await act(() => tree.unmount());
  });
});
