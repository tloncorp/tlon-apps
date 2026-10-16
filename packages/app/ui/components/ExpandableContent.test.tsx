import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { ExpandableContent } from './ExpandableContent';

vi.mock('@tloncorp/ui', () => ({ Pressable: 'Pressable', Text: 'Text' }));
vi.mock('react-native', () => ({ View: 'View' }));
vi.mock('tamagui', () => ({ YStack: 'YStack' }));
vi.mock('tamagui/linear-gradient', () => ({
  LinearGradient: 'LinearGradient',
}));

setupReactTestEnvironment();

async function render() {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <ExpandableContent
        collapsedHeight={240}
        fadeColor="#FFFFFF"
        testID="Expander"
      >
        {createElement('Body')}
      </ExpandableContent>
    );
  });
  return tree;
}

const byType = (tree: ReactTestRenderer, type: string) =>
  tree.root.findAll((node) => (node.type as unknown) === type);
const clip = (tree: ReactTestRenderer) =>
  tree.root.find(
    (node) => (node.type as unknown) === 'YStack' && 'maxHeight' in node.props
  );
const toggles = (tree: ReactTestRenderer) =>
  tree.root.findAll(
    (node) =>
      (node.type as unknown) === 'Pressable' &&
      node.props.testID === 'ExpanderToggle'
  );

function measure(tree: ReactTestRenderer, height: number) {
  const content = tree.root.find(
    (node) => (node.type as unknown) === 'View' && !!node.props.onLayout
  );
  act(() => {
    content.props.onLayout({ nativeEvent: { layout: { height } } });
  });
}

function pressToggle(tree: ReactTestRenderer) {
  act(() => {
    toggles(tree)[0].props.onPress();
  });
}

describe('ExpandableContent', () => {
  it('clips from the first frame, before the content is measured', async () => {
    const tree = await render();
    expect(clip(tree).props.maxHeight).toBe(240);
  });

  it('shows content that fits with no fade or toggle', async () => {
    const tree = await render();
    measure(tree, 180);
    expect(byType(tree, 'LinearGradient')).toHaveLength(0);
    expect(toggles(tree)).toHaveLength(0);
  });

  it('fades long content into its surface until it is expanded', async () => {
    const tree = await render();
    measure(tree, 900);
    expect(clip(tree).props.maxHeight).toBe(240);
    expect(byType(tree, 'LinearGradient')[0].props.colors).toEqual([
      'rgba(255, 255, 255, 0)',
      '#FFFFFF',
    ]);
    expect(toggles(tree)[0].props.accessibilityState).toEqual({
      expanded: false,
    });

    pressToggle(tree);
    expect(clip(tree).props.maxHeight).toBeUndefined();
    expect(byType(tree, 'LinearGradient')).toHaveLength(0);
    expect(toggles(tree)[0].props.accessibilityState).toEqual({
      expanded: true,
    });

    pressToggle(tree);
    expect(clip(tree).props.maxHeight).toBe(240);
  });
});
