import AsyncStorage from '@react-native-async-storage/async-storage';
import '@tamagui/native/setup-teleport';
import { setStorage } from '@tloncorp/app/ui';
import '@tloncorp/ui/config';
import * as fixture from '@tloncorp/app/fixtures/ScrollStability.fixture';
import * as decorator from '@tloncorp/app/fixtures/cosmos.decorator';
import { registerRootComponent } from 'expo';
import { NativeFixtureLoader } from 'react-cosmos-native';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import 'react-native-get-random-values';

// Explicit local entry; never starts App.main or the normal account database.
setStorage(AsyncStorage);
const path = 'packages/app/fixtures/ScrollStability.fixture.tsx';
function ScrollStabilityApp() {
  return (
    <KeyboardProvider>
      <NativeFixtureLoader
        rendererConfig={{ webSocketUrl: null, rendererUrl: null }}
        moduleWrappers={{
          lazy: false,
          fixtures: { [path]: { module: fixture } },
          decorators: {
            'packages/app/fixtures/cosmos.decorator.tsx': { module: decorator },
          },
        }}
        initialFixtureId={{ path }}
      />
    </KeyboardProvider>
  );
}
registerRootComponent(ScrollStabilityApp);
