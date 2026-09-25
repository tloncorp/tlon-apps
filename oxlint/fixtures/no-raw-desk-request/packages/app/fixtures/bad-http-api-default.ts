// expect: tlon/no-raw-desk-request
import Airlock from '@tloncorp/api/http-api';

export const load = () =>
  new Airlock('').scry({ app: 'groups', path: '/v3/groups' });
