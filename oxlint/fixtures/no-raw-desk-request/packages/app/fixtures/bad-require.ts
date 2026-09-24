// expect: tlon/no-raw-desk-request
const api = require('@tloncorp/api/client/urbit');

export const load = () => api.scry({ app: 'groups', path: '/v3/groups' });
