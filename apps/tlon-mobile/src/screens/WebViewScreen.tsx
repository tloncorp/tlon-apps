import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';

import { IS_IOS } from '../constants';
import { useWebviewPositionContext } from '../contexts/webview/position';
import type { WebViewStackParamList } from '../types';

export type Props = NativeStackScreenProps<WebViewStackParamList, 'Webview'>;

export const WebviewPlaceholderScreen = () => {
  const screenRef = useRef<View>(null);
  const { setPosition } = useWebviewPositionContext();

  // Pass along tab dimensions so webview can properly position
  const measureTab = useCallback(() => {
    screenRef.current?.measure((x, y, width, height) => {
      setPosition({ x, y, width, height });
    });
  }, [setPosition, screenRef]);

  if (IS_IOS) {
    return (
      <KeyboardAvoidingView behavior="height">
        <View
          ref={screenRef}
          onLayout={measureTab}
          style={{ height: '100%', width: '100%' }} // Optionally set background color here for debugging
        />
      </KeyboardAvoidingView>
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
