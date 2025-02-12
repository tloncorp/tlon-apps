import * as api from '../api';
import * as db from '../db';

export function initiateTwitterAttestation(handle: string) {
  return api.initiateTwitterAttestation(handle);
}
