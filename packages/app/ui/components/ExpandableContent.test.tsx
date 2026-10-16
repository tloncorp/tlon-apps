import { createElement } from 'react';
import { act, create } from 'react-test-renderer';
import type { ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { setupReactTestEnvironment } from '../../test/sheetTestUtils';

import { ExpandableContent } from './ExpandableContent';

vi.mock('@tloncorp/ui', () => ({ Pressable: 'Pressable', Text: 'Text' }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, View: 'View' }));
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
    expect(clip(tree).props.maxHeight).toBeUndefined();
    expect(byType(tree, 'LinearGradient')).toHaveLength(0);
    expect(toggles(tree)).toHaveLength(0);
  });

  it('shows content whole when the fade would hide less than itself', async () => {
    const tree = await render();
    measure(tree, 312);
    expect(clip(tree).props.maxHeight).toBeUndefined();
    expect(toggles(tree)).toHaveLength(0);

    measure(tree, 313);
    expect(clip(tree).props.maxHeight).toBe(240);
    expect(toggles(tree)).toHaveLength(1);
  });

  it('clips without bounding its content on native', async () => {
    // A hidden overflow would let Yoga collapse flex: 1 children (rendered
    // lists) to nothing inside the clip.
    const tree = await render();
    expect(clip(tree).props.overflow).toBe('scroll');
  });

  it('drops the toggle when expanded content shrinks to fit', async () => {
    const tree = await render();
    measure(tree, 900);
    pressToggle(tree);
    measure(tree, 200);
    expect(toggles(tree)).toHaveLength(0);
    expect(clip(tree).props.maxHeight).toBeUndefined();
  });

  it('toggles from the keyboard once per key press', async () => {
    const tree = await render();
    measure(tree, 900);
    const key = (key: string, repeat = false) => {
      const event = { key, repeat, preventDefault: vi.fn() };
      act(() => {
        toggles(tree)[0].props.onKeyDown(event);
      });
      return event;
    };

    expect(key('Enter').preventDefault).toHaveBeenCalled();
    expect(toggles(tree)[0].props['aria-expanded']).toBe(true);
    key(' ', true);
    expect(toggles(tree)[0].props['aria-expanded']).toBe(true);
    key(' ');
    expect(toggles(tree)[0].props['aria-expanded']).toBe(false);
    expect(key('a').preventDefault).not.toHaveBeenCalled();
    expect(toggles(tree)[0].props['aria-expanded']).toBe(false);
  });

  it("answers the screen reader's expand and collapse actions", async () => {
    const tree = await render();
    measure(tree, 900);
    const perform = (actionName: string) =>
      act(() => {
        toggles(tree)[0].props.onAccessibilityAction({
          nativeEvent: { actionName },
        });
      });

    perform('expand');
    expect(toggles(tree)[0].props['aria-expanded']).toBe(true);
    perform('collapse');
    expect(toggles(tree)[0].props['aria-expanded']).toBe(false);
  });

  it('fades long content into its surface until it is expanded', async () => {
    const tree = await render();
    measure(tree, 900);
    expect(clip(tree).props.maxHeight).toBe(240);
    expect(byType(tree, 'LinearGradient')[0].props.colors).toEqual([
      'rgba(255, 255, 255, 0)',
      '#FFFFFF',
    ]);
    expect(toggles(tree)[0].props['aria-expanded']).toBe(false);

    pressToggle(tree);
    expect(clip(tree).props.maxHeight).toBeUndefined();
    expect(byType(tree, 'LinearGradient')).toHaveLength(0);
    expect(toggles(tree)[0].props['aria-expanded']).toBe(true);

    pressToggle(tree);
    expect(clip(tree).props.maxHeight).toBe(240);
  });
});
