import { NavigationContext } from '@react-navigation/native';
import { useContext } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getTokenValue } from 'tamagui';

/**
 * Bottom inset for content on one of the top-level sections.
 *
 * Nothing is pinned across the bottom of the window any more, so these screens
 * run to its edge and have to reserve the safe area themselves. Anything
 * pushed onto the root stack renders above them and gets ordinary content
 * spacing instead.
 */
export function useTopLevelContentInset() {
  const { bottom } = useSafeAreaInsets();
  const navigation = useContext(NavigationContext);
  const contentSpacing = getTokenValue('$l', 'space');

  return navigation?.getState().type === 'tab'
    ? bottom + contentSpacing
    : contentSpacing;
}
