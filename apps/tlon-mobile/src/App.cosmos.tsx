import * as SplashScreen from 'expo-splash-screen';
import React, { Component } from 'react';
import { NativeFixtureLoader } from 'react-cosmos-native';

import { moduleWrappers, rendererConfig } from '../../../cosmos.imports';
import { GateOnDbReady } from './components/GateOnDbReady';

export default class CosmosApp extends Component {
  componentDidMount(): void {
    // Splash screen sometimes stick - no idea why, since the
    // `preventAutoHideAsync` call is happening in App.main.tsx, but throwing
    // this hear to avoid getting stuck.
    SplashScreen.hideAsync();
  }

  render() {
    return (
      <GateOnDbReady inMemory>
        <NativeFixtureLoader
          rendererConfig={rendererConfig}
          // @ts-expect-error - TODO: fix types
          moduleWrappers={moduleWrappers}
          initialFixtureId={{ path: 'apps/tlon-mobile/src/App.fixture.tsx' }}
        />
      </GateOnDbReady>
    );
  }
}
