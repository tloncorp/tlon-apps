import { NavigationContext } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'tamagui';

import {
  type ScreenHeaderAction,
  type UseScreenHeaderOptions,
  getScreenHeaderActionSignature,
} from './actions';
import {
  buildNativeHeaderActionOptions,
  resolveNativeHeaderColor,
} from './nativeActions';
import { NativeHeaderTitle, createNativeHeaderTitleStore } from './nativeTitle';

const hiddenNativeHeaderOptions = { headerShown: false };

export function useNativeHeader({
  enabled,
  title,
  titleElement,
  usesCustomTitle,
  backgroundColor,
  left,
  right,
}: UseScreenHeaderOptions) {
  const navigation = useContext(NavigationContext);
  const theme = useTheme();
  const [titleStore] = useState(() =>
    createNativeHeaderTitleStore(titleElement)
  );
  const leftActionsRef = useRef<ScreenHeaderAction[]>([]);
  const rightActionsRef = useRef<ScreenHeaderAction[]>([]);
  const themeRef = useRef(theme);
  leftActionsRef.current = left;
  rightActionsRef.current = right;
  themeRef.current = theme;

  useLayoutEffect(() => {
    titleStore.set(titleElement);
  }, [titleElement, titleStore]);

  const shouldUseNativeHeader = enabled && navigation != null;
  const resolvedBackgroundColor = resolveNativeHeaderColor(
    backgroundColor,
    theme
  );
  const signature = [left, right]
    .map((actions) =>
      getScreenHeaderActionSignature(actions, (color) =>
        resolveNativeHeaderColor(color, theme)
      )
    )
    .join('|');

  const options = useMemo<NativeStackNavigationOptions>(() => {
    void signature;
    return {
      headerShown: true,
      headerStyle: resolvedBackgroundColor
        ? { backgroundColor: resolvedBackgroundColor }
        : undefined,
      headerTitle: usesCustomTitle
        ? () => <NativeHeaderTitle store={titleStore} />
        : undefined,
      title,
      ...buildNativeHeaderActionOptions({
        side: 'left',
        actionsRef: leftActionsRef,
        themeRef,
      }),
      ...buildNativeHeaderActionOptions({
        side: 'right',
        actionsRef: rightActionsRef,
        themeRef,
      }),
    } as NativeStackNavigationOptions;
  }, [resolvedBackgroundColor, signature, title, titleStore, usesCustomTitle]);

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
