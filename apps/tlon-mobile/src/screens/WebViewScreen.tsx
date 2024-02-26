import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef } from 'react';
import { View } from 'react-native';

import { IS_IOS } from '../constants';
import { useWebViewContext } from '../contexts/webview';
import type { WebViewStackParamList } from '../types';

export type Props = NativeStackScreenProps<WebViewStackParamList, 'Webview'>;

export const WebviewPlaceholderScreen = () => {
  const screenRef = useRef<View>(null);
  const { setPosition } = useWebViewContext();

  // Pass along tab dimensions so webview can properly position
  const measureTab = useCallback(() => {
    screenRef.current?.measure((x, y, width, height) => {
      console.log(`setting position: ${x}, ${y}, ${width}, ${height}`);
      setPosition({ x, y, width, height });
    });
  }, [setPosition, screenRef]);

  if (IS_IOS) {
    return (
      <View
        ref={screenRef}
        onLayout={measureTab}
        style={{ height: '100%', width: '100%' }} // Optionally set background color here for debugging
      />
    );
  }
  return (
    <View
      ref={screenRef}
      onLayout={measureTab}
      style={{ height: '100%', width: '100%' }}
    />
  );
};
