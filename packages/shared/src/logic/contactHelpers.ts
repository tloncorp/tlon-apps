import { eq } from 'drizzle-orm';

import { processBatchOperation } from '../db/dbUtils';
import { QueryCtx } from '../db/query';
import {
  contacts as $contacts,
  systemContacts as $systemContacts,
} from '../db/schema';
import { SystemContact } from '../db/types';
import { Channel } from '../db/types';
import { createDevLogger } from '../debug';

const logger = createDevLogger('contactHelpers', false);

export function generateNicknameUpdates(
  matches: [string, string][],
  systemContacts: SystemContact[]
): { contactId: string; nicknamePart: string }[] {
  const nicknameUpdates: { contactId: string; nicknamePart: string }[] = [];

  for (const [phoneNumber, contactId] of matches) {
    const matchingSystemContact = systemContacts.find(
      (sc) => sc.phoneNumber === phoneNumber
    );

    if (
      matchingSystemContact &&
      (matchingSystemContact.firstName || matchingSystemContact.lastName)
    ) {
      const nicknamePart =
        `${matchingSystemContact.firstName || ''} ${matchingSystemContact.lastName || ''}`.trim();

      if (nicknamePart) {
        nicknameUpdates.push({ contactId, nicknamePart });
      }
    }
  }

  return nicknameUpdates;
}

export async function updateContactNicknames(
  nicknameUpdates: { contactId: string; nicknamePart: string }[],
  txCtx: QueryCtx,
  batchSize: number
): Promise<void> {
  await processBatchOperation(
    nicknameUpdates,
    batchSize,
    async (batch) => {
      return Promise.all(
        batch.map(({ contactId, nicknamePart }) =>
          txCtx.db
            .update($contacts)
            .set({ customNickname: nicknamePart })
            .where(eq($contacts.id, contactId))
        )
      );
    },
    'Error updating contact nicknames'
  );
}

export async function updateSystemContactIds(
  matches: [string, string][],
  txCtx: QueryCtx,
  batchSize: number
): Promise<void> {
  const contactIdUpdates = matches.map(([phoneNumber, contactId]) => ({
    phoneNumber,
    contactId,
  }));

  await processBatchOperation(
    contactIdUpdates,
    batchSize,
    async (batch) => {
      return Promise.all(
        batch.map(({ phoneNumber, contactId }) =>
          txCtx.db
            .update($systemContacts)
            .set({ contactId })
            .where(eq($systemContacts.phoneNumber, phoneNumber))
        )
      );
    },
    'Error updating system contact contactId'
  );
}

export function createDmChannelsForNewContacts(
  newContactMatches: [string, string][]
): Channel[] {
  const newContacts = newContactMatches.map(([phoneNumber, contactId]) => ({
    id: contactId,
    phoneNumber,
  }));

  return newContacts.map((contact) => ({
    id: contact.id,
    contactId: contact.id,
    type: 'dm' as const,
    currentUserIsMember: null,
    currentUserIsHost: null,
    isDmInvite: false,
    isPending: false,
    isNewMatchedContact: true,
    title: '',
    isNew: true,
    members: [
      {
        chatId: contact.id,
        contactId: contact.id,
        contact: contact,
        membershipType: 'channel' as const,
      },
    ],
    timestamp: Date.now(),
  }));
}
