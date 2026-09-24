// expect: none
import { scry } from '@tloncorp/api';

export class Probe {
  constructor(public readonly load: typeof scry) {}
}
