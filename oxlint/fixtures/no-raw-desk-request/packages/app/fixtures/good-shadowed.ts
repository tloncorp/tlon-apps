// expect: none
import { scry } from '@tloncorp/api';

export const run = (scry: (p: string) => string) => scry('/x');
export type Scry = typeof scry;
