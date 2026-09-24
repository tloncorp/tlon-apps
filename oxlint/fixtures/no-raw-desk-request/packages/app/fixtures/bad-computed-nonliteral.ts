// expect: tlon/no-raw-desk-request
import * as api from '@tloncorp/api';

const method = ['sc', 'ry'].join('') as 'getGroups';
export const load = () => api[method]();
