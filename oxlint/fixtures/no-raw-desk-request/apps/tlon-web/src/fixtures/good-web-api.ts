// expect: none
import api, { IS_MOCK } from '@/api';

export const stop = (id: number) => (IS_MOCK ? null : api.unsubscribe(id));
