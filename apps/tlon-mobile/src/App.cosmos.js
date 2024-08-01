import { Component } from 'react';
import { NativeFixtureLoader } from 'react-cosmos-native';
import { jsx as _jsx } from 'react/jsx-runtime';

import { moduleWrappers, rendererConfig } from '../cosmos.imports';

export default class CosmosApp extends Component {
  render() {
    return _jsx(NativeFixtureLoader, {
      rendererConfig: rendererConfig,
      moduleWrappers: moduleWrappers,
      initialFixtureId: { path: 'src/App.fixture.tsx' },
    });
  }
}
