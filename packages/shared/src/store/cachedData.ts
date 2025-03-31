// No-op on Native. Response cacheing is only valuable in
// ephemeral environments like web where the app is regularly
// loaded from scratch.
import * as db from '../db';

export function cacheContacts(contacts: db.Contact[]) {
  return;
}

export async function loadCachedContacts(): Promise<boolean> {
  return false;
}
