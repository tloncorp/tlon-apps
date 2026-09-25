// expect: tlon/no-raw-desk-request
import * as api from '@tloncorp/api';

export const load = () => api.scry({ app: 'groups', path: '/v3/groups' });
