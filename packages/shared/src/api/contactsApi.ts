import { parseUx } from "@urbit/aura";

import type { ClientTypes as Client } from "../client";
import type * as ub from "../urbit/contact";
import { scry } from "./urbit";

export const getContacts = async () => {
  const results = await scry<ub.ContactRolodex>({
    app: "contacts",
    path: "/all",
  });
  return toClientContacts(results);
};

export const toClientContacts = (
  contacts: ub.ContactRolodex
): Client.Contact[] => {
  return Object.entries(contacts).map(([ship, contact]) =>
    toClientContact(ship, contact)
  );
};

export const toClientContact = (
  id: string,
  contact: ub.Contact | null
): Client.Contact => {
  return {
    id,
    nickname: contact?.nickname ?? null,
    bio: contact?.bio ?? null,
    status: contact?.status ?? null,
    color: contact?.color ? "#" + parseUx(contact.color) : null,
    coverImage: contact?.cover ?? null,
    avatarImage: contact?.avatar ?? null,
    pinnedGroupIds: contact?.groups ?? [],
  };
};
