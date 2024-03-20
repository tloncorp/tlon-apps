import { contacts, groups } from './schemas';
import { Group, Groups } from '../urbit/groups';
import { Contact, ContactRolodex } from '../urbit/contact';
import { getDatabase } from '.';

export const getGroups = async (web?: boolean) => {
  const db = getDatabase(web);

  return db.query.groups.findMany();
};

export const insertGroup = async (
  flag: string,
  group: Group,
  web?: boolean
) => {
  const db = getDatabase(web);

  return db.insert(groups).values({
    flag,
    fleet: group.fleet,
    cabals: group.cabals,
    channels: group.channels,
    cordon: group.cordon,
    meta: group.meta,
    zones: group.zones,
    zoneOrder: group['zone-ord'],
    bloc: group.bloc,
    secret: group.secret,
    saga: group.saga,
    flaggedContent: group['flagged-content']
  });
};

export const insertGroups = async (groupsData: Groups, web?: boolean) => {
  const db = getDatabase(web);

  const insertData = Object.entries(groupsData).map(([flag, group]) => ({
    flag,
    fleet: group.fleet,
    cabals: group.cabals,
    channels: group.channels,
    cordon: group.cordon,
    meta: group.meta,
    zones: group.zones,
    zoneOrder: group['zone-ord'],
    bloc: group.bloc,
    secret: group.secret,
    saga: group.saga,
    flaggedContent: group['flagged-content']
  }));

  return db.insert(groups).values(insertData).onConflictDoNothing();
};

export const getGroup = async (flag: string, web?: boolean) => {
  const db = getDatabase(web);

  return db.query.groups.findFirst({
    where: (groups, { eq }) => eq(groups.flag, flag)
  });
};

export const getContacts = async (web?: boolean) => {
  const db = getDatabase(web);

  return db.query.contacts.findMany();
};

export const getContact = async (id: string, web?: boolean) => {
  const db = getDatabase(web);

  return db.query.contacts.findFirst({
    where: (contacts, { eq }) => eq(contacts.id, id)
  });
};

export const insertContact = async (
  id: string,
  contact: Contact,
  web?: boolean
) => {
  const db = getDatabase(web);

  return db.insert(contacts).values({
    id,
    nickname: contact.nickname,
    bio: contact.bio,
    status: contact.status,
    color: contact.color,
    avatarImage: contact.avatar,
    coverImage: contact.cover,
    pinnedGroupIds: contact.groups.join(',')
  });
};

export const insertContacts = async (
  contactsData: ContactRolodex,
  web?: boolean
) => {
  const db = getDatabase(web);

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
      pinnedGroupIds: (contact as Contact).groups.join(',')
    }));

  return db.insert(contacts).values(insertData).onConflictDoNothing();
};
