import React from 'react';
import { ReactTestRenderer, act, create } from 'react-test-renderer';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { PurposePane } from './PurposePane';

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@tloncorp/ui', () => ({
  Button: 'Button',
  Pressable: 'Pressable',
  Text: 'Text',
}));

vi.mock('tamagui', () => ({
  ScrollView: 'ScrollView',
  View: 'View',
  YStack: 'YStack',
  styled: () => 'Styled',
}));

vi.mock('./SplashOptionCard', () => ({
  SplashOptionCard: 'SplashOptionCard',
}));

vi.mock('./splashPrimitives', () => ({
  SplashTitle: 'SplashTitle',
  SplashParagraph: 'SplashParagraph',
}));

// vi.mock swaps each component for a host-string stub, but the imported type
// still says "component", so compare against a widened alias.
const OPTION_CARD = 'SplashOptionCard' as unknown as React.ElementType;

function findByTestID(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAll(
    (node) => node.props?.testID === testID,
    // testID lives on host-ish stubs, so don't restrict to component nodes
    { deep: true }
  )[0];
}

function findOptionCards(renderer: ReactTestRenderer) {
  return renderer.root.findAll((node) => node.type === OPTION_CARD);
}

function renderPane(
  overrides: Partial<React.ComponentProps<typeof PurposePane>> = {}
) {
  const props = {
    selectedId: 'meal-plan',
    onSelect: vi.fn(),
    onActionPress: vi.fn(),
    onSkipPress: vi.fn(),
    ...overrides,
  };
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<PurposePane {...props} />);
  });
  return { renderer, props };
}

describe('PurposePane', () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });

  afterAll(() => {
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  it('renders the three starters, with only meals recommended', () => {
    const { renderer } = renderPane();
    const cards = findOptionCards(renderer);

    expect(cards.map((card) => card.props.option.label)).toEqual([
      'Weekly meals and grocery list',
      'Household tasks and routines',
      'Garden plan and seasonal reminders',
    ]);
    expect(cards.map((card) => card.props.option.recommendationLabel)).toEqual([
      'Recommended',
      undefined,
      undefined,
    ]);
    // Every option explains itself, recommended one included.
    for (const card of cards) {
      expect(card.props.option.description).toBeTruthy();
    }
  });

  it('marks the selected option and only that one', () => {
    const { renderer } = renderPane({ selectedId: 'garden-plan' });
    const selected = findOptionCards(renderer).filter(
      (card) => card.props.selected
    );

    expect(selected).toHaveLength(1);
    expect(selected[0].props.option.label).toBe(
      'Garden plan and seasonal reminders'
    );
  });

  it('reports the pressed option rather than advancing on its own', () => {
    const { renderer, props } = renderPane();
    const household = findByTestID(renderer, 'starter-option-household-tasks');

    act(() => household.props.onPress());

    expect(props.onSelect).toHaveBeenCalledWith('household-tasks');
    expect(props.onActionPress).not.toHaveBeenCalled();
  });

  it('advances with the current selection when Next is pressed', () => {
    const { renderer, props } = renderPane({ selectedId: 'meal-plan' });

    act(() => findByTestID(renderer, 'starter-next').props.onPress());

    expect(props.onActionPress).toHaveBeenCalledTimes(1);
    expect(props.onSkipPress).not.toHaveBeenCalled();
  });

  it('takes the Something else path without selecting a starter', () => {
    const { renderer, props } = renderPane();

    act(() => findByTestID(renderer, 'starter-something-else').props.onPress());

    expect(props.onSkipPress).toHaveBeenCalledTimes(1);
    expect(props.onSelect).not.toHaveBeenCalled();
    expect(props.onActionPress).not.toHaveBeenCalled();
  });

  it('disables Next when nothing is selected', () => {
    const { renderer } = renderPane({ selectedId: undefined });
    expect(findByTestID(renderer, 'starter-next').props.disabled).toBe(true);
  });
});
