// expect: none
import type { Urbit } from '@tloncorp/api';
import Airlock, { type Poke } from '@tloncorp/api/http-api';
import type * as api from '@tloncorp/api';

export type Listener = Airlock['on'];
export type Client = Urbit;
export type P = Poke<unknown>;
export type S = typeof api.scry;
