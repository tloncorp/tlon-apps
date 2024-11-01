import * as db from '../db';
import { createDevLogger } from '../debug';
import { normalizeUrbitColor } from '../logic';
import * as ub from '../urbit';
import { poke, scry, subscribe } from './urbit';

const logger = createDevLogger('contactsApi', true);

export const getContacts = async () => {
  // this is all peers we know about, with merged profile data for
  // contacts
  const peersResponse = await scry<ub.ContactRolodex>({
    app: 'contacts',
    path: '/all',
  });

  // this is all of your contacts, with unmerged profile data + user overrides
  const contactsResponse = await scry<ub.ContactBookScryResult1>({
    app: 'contacts',
    path: '/v1/book',
  });
  const skipContacts = new Set(Object.keys(contactsResponse));

  const suggestionsResponse = await scry<string[]>({
    app: 'groups-ui',
    path: '/suggested-contacts',
  });

  const contactSuggestions = new Set(suggestionsResponse);

  const peerProfiles = v0PeersToClientProfiles(peersResponse, {
    userIdsToOmit: skipContacts,
    contactSuggestions,
  });
  const contactProfiles = contactsToClientProfiles(contactsResponse, {
    contactSuggestions,
  });

  return [...peerProfiles, ...contactProfiles];
};

export const removeContactSuggestion = async (contactId: string) => {
  return poke({
    app: 'groups-ui',
    mark: 'ui-hide-contact',
    json: contactId,
  });
};

// TODO: use new method
export const addContacts = async (contactIds: string[]) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: { heed: contactIds },
  });
};

export const updateContactMetadata = async (
  contactId: string,
  metadata: { nickname?: string; avatarImage?: string }
) => {
  const contactUpdate: ub.ContactBookProfileEdit = {};
  if (metadata.nickname !== undefined) {
    contactUpdate.nickname = metadata.nickname
      ? { type: 'text', value: metadata.nickname }
      : null;
  }

  if (metadata.avatarImage !== undefined) {
    contactUpdate.avatar = metadata.avatarImage
      ? { type: 'look', value: metadata.avatarImage }
      : null;
  }

  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { edit: { kip: contactId, contact: contactUpdate } },
  });
};

export const addContact = async (contactId: string) => {
  removeContactSuggestion(contactId);
  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: {
      page: { kip: contactId, contact: {} },
    },
  });
};

export const removeContact = async (contactId: string) => {
  return poke({
    app: 'contacts',
    mark: 'contact-action-1',
    json: { wipe: [contactId] },
  });
};

export interface ProfileUpdate {
  nickname?: string;
  bio?: string;
  avatarImage?: string;
  coverImage?: string;
}
export const updateCurrentUserProfile = async (update: ProfileUpdate) => {
  const editedFields: ub.ContactEditField[] = [];
  if (update.nickname !== undefined) {
    editedFields.push({ nickname: update.nickname });
  }

  if (update.bio !== undefined) {
    editedFields.push({ bio: update.bio });
  }

  if (update.avatarImage !== undefined) {
    editedFields.push({ avatar: update.avatarImage });
  }

  if (update.coverImage !== undefined) {
    editedFields.push({ cover: update.coverImage });
  }

  const action: ub.ContactEdit = {
    edit: editedFields,
  };

  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: action,
  });
};

export const addPinnedGroup = async (groupId: string) => {
  const update: ub.ContactEdit = { edit: [{ 'add-group': groupId }] };
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: update,
  });
};

export const removePinnedGroup = async (groupId: string) => {
  const update: ub.ContactEdit = { edit: [{ 'del-group': groupId }] };
  return poke({
    app: 'contacts',
    mark: 'contact-action',
    json: update,
  });
};

export type ContactsUpdate =
  | { type: 'upsertContact'; contact: db.Contact }
  | { type: 'removeContact'; contactId: string };

export const subscribeToContactUpdates = (
  handler: (update: ContactsUpdate) => void
) => {
  subscribe(
    {
      app: 'contacts',
      path: '/v1/news',
    },
    (event: ub.ContactsNewsResponse1) => {
      // received when someone is marked as a contact or when a contact's profile is updated
      if (ub.isPageResponse(event) && event.page.kip.startsWith('~')) {
        const { kip, contact, mod } = event.page;
        const contactBookEntry = [contact, mod] as ub.ContactBookEntry;
        return handler({
          type: 'upsertContact',
          contact: contactToClientProfile(kip, contactBookEntry),
        });
      }

      if (ub.isWipeResponse(event) && event.wipe.kip.startsWith('~')) {
        return handler({ type: 'removeContact', contactId: event.wipe.kip });
      }

      // received when we get initial or updated profile info for a non-contact. Note: we also get
      // a dupe event here if a contact updates their own profile (get a page fact and peer fact)
      if (ub.isPeerResponse(event) && event.peer.who.startsWith('~')) {
        const { who, contact } = event.peer;
        return handler({
          type: 'upsertContact',
          contact: v1PeerToClientProfile(who, contact),
        });
      }
    }
  );
};

export const v0PeersToClientProfiles = (
  contacts: ub.ContactRolodex,
  config?: {
    userIdsToOmit?: Set<string>;
    contactSuggestions?: Set<string>;
  }
): db.Contact[] => {
  return Object.entries(contacts)
    .filter(([ship]) =>
      config?.userIdsToOmit ? !config.userIdsToOmit.has(ship) : true
    )
    .flatMap(([ship, contact]) =>
      contact === null
        ? []
        : [
            v0PeerToClientProfile(ship, contact, {
              isContactSuggestion: config?.contactSuggestions?.has(ship),
            }),
          ]
    );
};

export const v0PeerToClientProfile = (
  id: string,
  contact: ub.Contact | null,
  config?: {
    isContactSuggestion?: boolean;
  }
): db.Contact => {
  return {
    id,
    nickname: contact?.nickname ?? null,
    bio: contact?.bio ?? null,
    status: contact?.status ?? null,
    color: contact?.color ? normalizeUrbitColor(contact.color) : null,
    coverImage: contact?.cover ?? null,
    avatarImage: contact?.avatar ?? null,
    pinnedGroups:
      contact?.groups?.map((groupId) => ({
        groupId,
        contactId: id,
      })) ?? [],

    isContact: false,
    isContactSuggestion: config?.isContactSuggestion,
  };
};

export const v1PeersToClientProfiles = (
  peers: ub.ContactsAllScryResult1,
  config?: {
    contactSuggestions?: Set<string>;
  }
) => {
  return Object.entries(peers).map(([ship, contact]) =>
    v1PeerToClientProfile(ship, contact, {
      isContactSuggestion: config?.contactSuggestions?.has(ship),
    })
  );
};

export const v1PeerToClientProfile = (
  id: string,
  contact: ub.ContactBookProfile,
  config?: {
    isContact?: boolean;
    isContactSuggestion?: boolean;
  }
) => {
  return {
    id,
    nickname: contact.nickname?.value ?? null,
    bio: contact.bio?.value ?? null,
    status: contact.status?.value ?? null,
    color: contact.color ? normalizeUrbitColor(contact.color.value) : null,
    coverImage: contact.cover?.value ?? null,
    avatarImage: contact.avatar?.value ?? null,
    pinnedGroups:
      contact.groups?.value.map((group) => ({
        groupId: group.value,
        contactId: id,
      })) ?? [],

    isContact: config?.isContact,
    isContactSuggestion: config?.isContactSuggestion && !config?.isContact,
  };
};

export const contactsToClientProfiles = (
  contacts: ub.ContactBookScryResult1,
  config?: {
    contactSuggestions?: Set<string>;
  }
): db.Contact[] => {
  return Object.entries(contacts).flatMap(([userId, contact]) =>
    contact === null
      ? []
      : [
          contactToClientProfile(userId, contact, {
            isContactSuggestion: config?.contactSuggestions?.has(userId),
          }),
        ]
  );
};

export const contactToClientProfile = (
  userId: string,
  contact: ub.ContactBookEntry,
  config?: {
    isContactSuggestion?: boolean;
  }
): db.Contact => {
  const [base, overrides] = contact;

  return {
    id: userId,
    nickname: base.nickname?.value ?? null,
    bio: base.bio?.value ?? null,
    avatarImage: base.avatar?.value ?? null,
    coverImage: base.cover?.value ?? null,
    color: base.color ? normalizeUrbitColor(base.color.value) : null,
    pinnedGroups:
      base.groups?.value.map((group) => ({
        groupId: group.value,
        contactId: userId,
      })) ?? [],

    isContact: true,
    customNickname: overrides.nickname?.value,
    customAvatarImage: overrides.avatar?.value,
    isContactSuggestion: false,
  };
};
