// expect: tlon/no-raw-desk-request
import { default as webApi } from '@/api';

export const load = () => webApi.scry({ app: 'groups', path: '/v3/groups' });
