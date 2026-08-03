import { NavigationContext } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useContext, useMemo, useRef } from 'react';
import { useTheme } from 'tamagui';

import { getNativeHeaderOptions } from '../../navigation/nativeHeaderOptions';
import {
  resolveNativeHeaderColor,
  useNativeHeaderItems,
} from './nativeHeaderItems';
import type { UseScreenHeaderOptions } from './useScreenHeader.types';

const hiddenNativeHeaderOptions = { headerShown: false };

export function useScreenHeader({
  enabled,
  title,
  titleElement,
  usesCustomTitle,
  backgroundColor,
  left,
  right,
  revision,
}: UseScreenHeaderOptions) {
  const navigation = useContext(NavigationContext);
  const theme = useTheme();
  const titleRef = useRef(titleElement);
  titleRef.current = titleElement;

  const shouldUseNativeHeader = enabled && navigation != null;
  const resolvedBackgroundColor = resolveNativeHeaderColor(
    backgroundColor,
    theme
  );
  const options = useMemo<NativeStackNavigationOptions>(
    () => ({
      ...getNativeHeaderOptions({
        title,
        backgroundColor: resolvedBackgroundColor,
      }),
      headerBackVisible: false,
      headerTitle: usesCustomTitle ? () => titleRef.current : undefined,
    }),
    [resolvedBackgroundColor, title, usesCustomTitle]
  );

  useNativeHeaderItems({
    navigation,
    enabled: shouldUseNativeHeader,
    left,
    right,
    options,
    resetOptions: hiddenNativeHeaderOptions,
    revision,
  });

  return shouldUseNativeHeader;
}
