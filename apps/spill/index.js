/**
 * @format
 */

import {AppRegistry, LogBox} from 'react-native';
import Root from './src/components/Root';
import {name as appName} from './app.json';

// Ignoring an error that crops up when using model sheet inside a list -- since
// list isn't actually inside another list, but is portalled to the root, it
// shouldn't actually apply? This is a problem in the picker components. Here's
// the full error:
// "VirtualizedLists should never be nested inside plain ScrollViews with the
// same orientation because it can break windowing and other functionality - use
// another VirtualizedList-backed container instead."
LogBox.ignoreLogs([/VirtualizedLists.+?/]);

AppRegistry.registerComponent(appName, () => Root);
