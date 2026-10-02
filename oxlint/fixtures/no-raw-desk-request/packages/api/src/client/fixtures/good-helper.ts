// expect: none
import { getCurrentUserId } from '../urbit';
import { groups, scryRequest } from '../requests';

export const load = () =>
  scryRequest(groups.uiGroup)({ groupId: getCurrentUserId() });
