import React, {Component} from 'react';
import {NativeFixtureLoader} from 'react-cosmos-native';
import {rendererConfig, moduleWrappers} from '../../cosmos.imports';

export default class CosmosApp extends Component {
  render() {
    return (
      <NativeFixtureLoader
        rendererConfig={rendererConfig}
        moduleWrappers={moduleWrappers}
      />
    );
  }
}
