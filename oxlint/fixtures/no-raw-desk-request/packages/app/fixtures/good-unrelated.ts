// expect: none
import * as api from '@tloncorp/api';
import { getGroups, unsubscribe } from '@tloncorp/api';

function scry(path: string) {
  return path;
}

export const local = () => scry('/x');
export const groups = () => api.getGroups();
export const stop = (id: number) => unsubscribe(id);
export const load = () => getGroups();
