// expect: tlon/no-raw-desk-request
import api from '@/api';

export const leave = () =>
  api.poke({ app: 'groups', mark: 'group-leave', json: '~zod/g' });
