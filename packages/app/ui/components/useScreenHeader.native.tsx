import { NavigationContext } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useContext, useLayoutEffect, useMemo, useRef } from 'react';
import { Platform } from 'react-native';
import { useTheme } from 'tamagui';

import { getNativeHeaderOptions } from '../../navigation/nativeHeaderOptions';
import { ScreenHeaderItemElements } from './ScreenHeaderItemElements';
import {
  buildNativeHeaderItems,
  resolveNativeHeaderColor,
} from './nativeHeaderItems';
import {
  type ScreenHeaderItemConfig,
  forwardLatestHeaderItemCallbacks,
} from './screenHeaderItemModel';
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
  const leftConfigsRef = useRef<ScreenHeaderItemConfig[]>([]);
  const rightConfigsRef = useRef<ScreenHeaderItemConfig[]>([]);
  const themeRef = useRef(theme);
  titleRef.current = titleElement;
  leftConfigsRef.current = left;
  rightConfigsRef.current = right;
  themeRef.current = theme;

  const shouldUseNativeHeader = enabled && navigation != null;
  const resolvedBackgroundColor = resolveNativeHeaderColor(
    backgroundColor,
    theme
  );
  const signature = [
    buildNativeHeaderItems(left, theme).signature,
    buildNativeHeaderItems(right, theme).signature,
  ].join('|');

  const options = useMemo<NativeStackNavigationOptions>(() => {
    void signature;
    void revision;
    const next: Record<string, unknown> = {
      ...getNativeHeaderOptions({
        title,
        backgroundColor: resolvedBackgroundColor,
      }),
      headerBackVisible: false,
      headerTitle: usesCustomTitle ? () => titleRef.current : undefined,
    };

    function applySide(
      configsRef: { current: ScreenHeaderItemConfig[] },
      nativeKey: string,
      elementKey: string
    ) {
      if (Platform.OS === 'ios') {
        next[nativeKey] = () =>
          buildNativeHeaderItems(
            forwardLatestHeaderItemCallbacks(configsRef),
            themeRef.current
          ).items;
      } else {
        next[elementKey] = () => (
          <ScreenHeaderItemElements
            configs={forwardLatestHeaderItemCallbacks(configsRef)}
            nativeHeader
          />
        );
      }
    }

    applySide(leftConfigsRef, 'unstable_headerLeftItems', 'headerLeft');
    applySide(rightConfigsRef, 'unstable_headerRightItems', 'headerRight');

    return next as NativeStackNavigationOptions;
  }, [resolvedBackgroundColor, revision, signature, title, usesCustomTitle]);

  useLayoutEffect(() => {
    if (shouldUseNativeHeader) {
      navigation.setOptions(options);
    }
  }, [navigation, options, shouldUseNativeHeader]);

  useLayoutEffect(() => {
    if (!shouldUseNativeHeader) {
      return;
    }
    return () => {
      if (navigation.isFocused == null || navigation.isFocused()) {
        navigation.setOptions(hiddenNativeHeaderOptions);
      }
    };
  }, [navigation, shouldUseNativeHeader]);

  return shouldUseNativeHeader;
}
