import * as api from '../api';
import * as db from '../db';
import * as logic from '../logic';

export async function pinItem(channel: db.ChannelSummary) {
  // optimistic update
  const partialPin = logic.getPinPartial(channel);
  db.insertPinnedItem(partialPin);

  try {
    await api.pinItem(partialPin.itemId);
  } catch (e) {
    console.error('Failed to pin item', e);
    // rollback optimistic update
    db.deletePinnedItem(partialPin);
  }
}

export async function unpinItem(pin: db.Pin) {
  // optimistic update
  db.deletePinnedItem(pin);

  try {
    await api.unpinItem(pin.itemId);
  } catch (e) {
    console.error('Failed to unpin item', e);
    // rollback optimistic update
    db.insertPinnedItem(pin);
  }
}
