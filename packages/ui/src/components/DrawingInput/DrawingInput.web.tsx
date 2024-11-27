import { WithSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { Text } from 'tamagui';

import { DrawingInputComponent } from './shared';

export const StandaloneDrawingInput: DrawingInputComponent = (props) => {
  return (
    <WithSkiaWeb
      getComponent={() => import('./DrawingInputBase')}
      fallback={<Text style={{ textAlign: 'center' }}>Loading...</Text>}
      componentProps={props}
      opts={{
        // canvaskit wasm binary should be located at this path - for Vite,
        // this is the `public` directory.
        locateFile: () => '/apps/groups/canvaskit.wasm',
      }}
    />
  );
};
