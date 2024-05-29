import { IGNORE_COSMOS } from './constants';

module.exports =
  (global as any).__DEV__ && !IGNORE_COSMOS
    ? require('./App.cosmos')
    : require('./App.main');
