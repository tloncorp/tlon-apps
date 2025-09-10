import { COSMOS_ENABLED } from '@tloncorp/app/constants';
import { loadConstants } from '@tloncorp/app/lib/constants';

loadConstants();

module.exports = COSMOS_ENABLED
  ? require('./App.cosmos')
  : require('./App.main');
