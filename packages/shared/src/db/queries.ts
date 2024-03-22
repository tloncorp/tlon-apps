import { Column, sql } from "drizzle-orm";
import { SQLiteTable, SQLiteUpdateSetSource } from "drizzle-orm/sqlite-core";
import { getDatabase } from ".";
import { Contact, ContactRolodex } from "../urbit/contact";
import * as schemas from "./schemas";
import { GroupInsert } from "./types";

export const getGroups = async () => {
  const db = getDatabase();

  return db.query.groups.findMany({
    with: {
      roles: true,
      members: true,
      channels: true,
    },
  });
};

export const insertGroup = async (group: GroupInsert) => {
  const db = getDatabase();
  await db.transaction(async (tx) => {
    await tx.insert(schemas.groups).values(group).onConflictDoNothing();
    if (group.roles) {
      await db
        .insert(schemas.groupRoles)
        .values(group.roles)
        .onConflictDoUpdate({
          target: [schemas.groupRoles.groupId, schemas.groupRoles.id],
          set: conflictUpdateSet(schemas.groupRoles, [
            "groupId",
            "iconImage",
            "coverImage",
            "title",
            "description",
          ]),
        });
    }
    if (group.members) {
      await db
        .insert(schemas.contacts)
        .values(group.members.map((m) => ({ id: m.contactId })))
        .onConflictDoNothing();
      await db.insert(schemas.groupMembers).values(group.members);
      const memberRoles = group.members.flatMap((m) => {
        return m.roles.map((r) => ({
          groupId: group.id,
          contactId: m.contactId,
          roleId: r.roleId,
        }));
      });
      if (memberRoles.length) {
        await db.insert(schemas.groupMemberRoles).values(memberRoles);
      }
    }
    if (group.channels?.length) {
      await db
        .insert(schemas.channels)
        .values(group.channels)
        .onConflictDoUpdate({
          target: [schemas.channels.id],
          set: conflictUpdateSet(schemas.channels, [
            "groupId",
            "iconImage",
            "coverImage",
            "title",
            "description",
            "addedToGroupAt",
            "currentUserIsMember",
          ]),
        });
    }
    if (group.posts) {
    }
  });
};

export function getGroupRoles(groupId: string) {
  return getDatabase().query.groupRoles.findMany();
}

export function conflictUpdateSet<TTable extends SQLiteTable>(
  table: TTable,
  columns: (keyof TTable["_"]["columns"] & keyof TTable)[]
): SQLiteUpdateSetSource<TTable> {
  return Object.assign(
    {},
    ...columns.map((k) => ({
      [k]: sql.raw(`excluded.${(table[k] as unknown as Column).name}`),
    }))
  ) as SQLiteUpdateSetSource<TTable>;
}

export const insertGroups = async (groupData: GroupInsert[]) => {
  return Promise.all(groupData.map(insertGroup));
};

export const getGroup = async (id: string) => {
  const db = getDatabase();

  return db.query.groups.findFirst({
    where: (groups, { eq }) => eq(groups.id, id),
  });
};

export const getContacts = async () => {
  const db = getDatabase();

  return db.query.contacts.findMany();
};

export const getContact = async (id: string) => {
  const db = getDatabase();

  return db.query.contacts.findFirst({
    where: (contacts, { eq }) => eq(contacts.id, id),
  });
};

export const insertContact = async (id: string, contact: Contact) => {
  const db = getDatabase();

  return db.insert(schemas.contacts).values({
    id,
    nickname: contact.nickname,
    bio: contact.bio,
    status: contact.status,
    color: contact.color,
    avatarImage: contact.avatar,
    coverImage: contact.cover,
    pinnedGroupIds: contact.groups.join(","),
  });
};

export const insertContacts = async (contactsData: ContactRolodex) => {
  const db = getDatabase();

  const insertData = Object.entries(contactsData)
    .filter(([, contact]) => contact !== null)
    .map(([id, contact]) => ({
      id,
      nickname: (contact as Contact).nickname,
      bio: (contact as Contact).bio,
      status: (contact as Contact).status,
      color: (contact as Contact).color,
      avatarImage: (contact as Contact).avatar,
      coverImage: (contact as Contact).cover,
      pinnedGroupIds: (contact as Contact).groups.join(","),
    }));

  return db.insert(schemas.contacts).values(insertData).onConflictDoNothing();
};
