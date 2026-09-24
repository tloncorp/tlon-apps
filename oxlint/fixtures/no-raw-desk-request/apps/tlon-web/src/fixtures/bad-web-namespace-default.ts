// expect: tlon/no-raw-desk-request
import * as web from '@/api';

export const load = () =>
  web.default.scry({ app: 'groups', path: '/v3/groups' });
