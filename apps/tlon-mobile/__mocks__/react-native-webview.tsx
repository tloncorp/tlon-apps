// https://github.com/react-native-webview/react-native-webview/issues/2959#issuecomment-1695757917
import React from 'react';
import { View } from 'react-native';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const WebView = (props: any) => <View {...props} />;
export default WebView;
