// expect: tlon/no-raw-desk-request
import api from '@/state/../api';

export const load = () => api.scry({ app: 'groups', path: '/v99/new' });
