import * as db from '../../db';

// Update the last activity timestamp when we receive new data
export function updateLastActivityTime() {
  db.lastActivityAt.setValue(Date.now());
}
