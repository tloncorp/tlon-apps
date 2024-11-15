import React, { Component } from 'react';
import { NativeFixtureLoader } from 'react-cosmos-native';

import { moduleWrappers, rendererConfig } from '../../../cosmos.imports';

export default class CosmosApp extends Component {
  render() {
    return (
      <NativeFixtureLoader
        rendererConfig={rendererConfig}
        // @ts-expect-error - TODO: fix types
        moduleWrappers={moduleWrappers}
        initialFixtureId={{ path: 'apps/tlon-mobile/src/App.fixture.tsx' }}
      />
    );
  }
}
