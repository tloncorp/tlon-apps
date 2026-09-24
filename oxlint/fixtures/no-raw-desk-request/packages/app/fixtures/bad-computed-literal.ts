// expect: tlon/no-raw-desk-request
import * as api from '@tloncorp/api';

export const run = () => api['thread']({} as never);
