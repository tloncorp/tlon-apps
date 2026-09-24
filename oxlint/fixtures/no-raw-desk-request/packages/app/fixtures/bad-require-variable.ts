// expect: tlon/no-raw-desk-request
const target = ['@tloncorp', 'api'].join('/');
const api = require(target);

export const load = () => api.scry({ app: 'groups', path: '/v3/groups' });
