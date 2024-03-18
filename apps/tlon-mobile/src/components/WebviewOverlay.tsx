import { View } from '@tloncorp/ui';

import { useWebviewPositionContext } from '../contexts/webview/position';
import { SingletonWebview } from './SingletonWebview';

export default function WebviewOverlay() {
  const { position, visible } = useWebviewPositionContext();
  return (
    <View
      style={{
        position: 'absolute',
        top: position.y,
        left: position.x,
        width: position.width,
        height: position.height,
        opacity: !visible ? 0 : undefined,
        pointerEvents: !visible ? 'none' : undefined,
      }}
    >
      <SingletonWebview />
    </View>
  );
}
