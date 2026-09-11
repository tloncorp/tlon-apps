import { IGNORE_COSMOS } from '@tloncorp/app/constants';
import { loadConstants } from '@tloncorp/app/lib/constants';

loadConstants();

export default __DEV__ && !IGNORE_COSMOS
  ? require('./App.cosmos').default
  : require('./App.main').default;
