// expect: tlon/no-raw-desk-request
import { subscribeOnce } from '..';

export const once = () => subscribeOnce({ app: 'groups', path: '/chan/x' });
