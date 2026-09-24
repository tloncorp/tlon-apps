// expect: tlon/no-raw-desk-request
import * as api from '@tloncorp/api';

const { scry } = api;
export const load = () => scry({ app: 'groups', path: '/v3/groups' });
