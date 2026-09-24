// expect: tlon/no-raw-desk-request
const { scry } = require('@tloncorp/api' as const);

export const load = () => scry({ app: 'groups', path: '/v3/groups' });
