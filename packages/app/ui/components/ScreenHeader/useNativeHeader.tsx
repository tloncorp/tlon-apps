import { NavigationContext } from '@react-navigation/native';
import type { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import { useContext, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useTheme } from 'tamagui';

import { useInstalledNavigationOptions } from '../../../navigation/useInstalledNavigationOptions';
import {
  type ScreenHeaderAction,
  type ScreenHeaderActionPresentation,
  type UseNativeHeaderOptions,
  getScreenHeaderActionPresentation,
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
}: UseNativeHeaderOptions) {
  const navigation = useContext(NavigationContext);
  const theme = useTheme();
  const [titleStore] = useState(() =>
    createNativeHeaderTitleStore(titleElement)
  );
  const leftActionsRef = useRef<ScreenHeaderAction[]>([]);
  const rightActionsRef = useRef<ScreenHeaderAction[]>([]);

  useLayoutEffect(() => {
    leftActionsRef.current = left;
    rightActionsRef.current = right;
    titleStore.set(titleElement);
  }, [left, right, titleElement, titleStore]);

  const shouldUseNativeHeader =
    enabled && Platform.OS !== 'web' && navigation != null;
  const resolvedBackgroundColor = resolveNativeHeaderColor(
    backgroundColor,
    theme
  );
  const actionPresentation = JSON.stringify({
    left: getScreenHeaderActionPresentation(left, (color) =>
      resolveNativeHeaderColor(color, theme)
    ),
    right: getScreenHeaderActionPresentation(right, (color) =>
      resolveNativeHeaderColor(color, theme)
    ),
  });

  const options = useMemo<NativeStackNavigationOptions>(() => {
    const presentation = JSON.parse(actionPresentation) as {
      left: ScreenHeaderActionPresentation[];
      right: ScreenHeaderActionPresentation[];
    };

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
        presentation: presentation.left,
        actionsRef: leftActionsRef,
      }),
      ...buildNativeHeaderActionOptions({
        side: 'right',
        presentation: presentation.right,
        actionsRef: rightActionsRef,
      }),
    } as NativeStackNavigationOptions;
  }, [
    actionPresentation,
    resolvedBackgroundColor,
    title,
    titleStore,
    usesCustomTitle,
  ]);

  useInstalledNavigationOptions(
    navigation,
    options,
    hiddenNativeHeaderOptions,
    shouldUseNativeHeader
  );

  return shouldUseNativeHeader;
}
