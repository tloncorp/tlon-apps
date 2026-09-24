// expect: tlon/no-raw-desk-request
import * as api from '@tloncorp/api';

const listen = api.subscribe;
export const watch = () =>
  listen({ app: 'groups', path: '/v3/groups' }, () => {});
