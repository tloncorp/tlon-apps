// expect: tlon/no-raw-desk-request
import api from '../api';

export const load = () =>
  api.client.scry({ app: 'groups', path: '/v3/groups' });
