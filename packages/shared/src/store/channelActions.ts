import * as api from '../api';
import * as db from '../db';
import * as logic from '../logic';

export async function pinItem(channel: db.Channel) {
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

export async function markChannelRead(
  channel: db.Channel | { id: string; type: db.ChannelType }
) {
  if (channel.type === 'dm' || channel.type === 'groupDm') {
    await api.markChatRead(channel.id);
  } else {
    await api.markChannelRead(channel.id);
  }
}

export async function upsertDmChannel({
  participants,
  currentUserId,
}: {
  participants: string[];
  currentUserId: string;
}): Promise<db.Channel> {
  // if it's a group dm
  if (participants.length > 1) {
    // see if any existing group dm has the exact same participant set
    const multiDms = await db.getAllMultiDms();
    const fullParticipantSet = [...participants, currentUserId];
    const existingId = multiDms.reduce((foundId: null | db.Channel, currDm) => {
      if (foundId !== null) return foundId;
      if (currDm.members.length === fullParticipantSet.length) {
        if (
          currDm.members.every((member) =>
            fullParticipantSet.includes(member.contactId)
          )
        ) {
          return currDm;
        }
      }
      return null;
    }, null);

    // if we found a match, return it
    if (existingId) {
      return existingId;
    }

    // if we didn't, we need to create a new pending group dm channel
    // on the client that will only persist on the backend after sending
    // the first message
    const newMultiDm = api.createPendingMultiDmChannel(
      participants,
      currentUserId
    );
    await db.insertChannels([newMultiDm]);
    return newMultiDm;
  }

  // check for existing single dm
  const dmPartner = participants[0];
  const dms = await db.getAllSingleDms();
  const existingDm = dms.find((dm) => dm.id === dmPartner);
  if (existingDm) {
    return existingDm;
  }

  // if it doesn't exist, we create a new one but don't need to juggle
  // any pending state
  const newDm = api.createSingleDmChannel(dmPartner, currentUserId);
  await db.insertChannels([newDm]);
  return newDm;
}
