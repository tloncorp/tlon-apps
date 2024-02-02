import * as db from '@db';
import {TamaguiProvider} from '@theme';
import {Provider as JotaiProvider} from 'jotai';
import React, {PropsWithChildren} from 'react';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {Main} from './Main';

function App(): React.JSX.Element {
  return (
    <Providers>
      <Main />
    </Providers>
  );
}

function Providers({children}: PropsWithChildren) {
  return (
    <SafeAreaProvider>
      <db.RealmProvider>
        <JotaiProvider>
          <TamaguiProvider>{children}</TamaguiProvider>
        </JotaiProvider>
      </db.RealmProvider>
    </SafeAreaProvider>
  );
}

export default App;
