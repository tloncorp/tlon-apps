import { Resource } from '@urbit/api';

export interface Contact {
  nickname: string;
  bio: string;
  status: string;
  color: string;
  avatar: string | null;
  cover: string | null;
  groups: string[];
}

export interface ContactAddGroup {
  'add-group': Resource;
}

export interface ContactDelGroup {
  'del-group': Resource;
}

export type ContactEditField =
  | Pick<Contact, 'nickname'>
  | Pick<Contact, 'bio'>
  | Pick<Contact, 'status'>
  | Pick<Contact, 'color'>
  | Pick<Contact, 'avatar'>
  | Pick<Contact, 'cover'>
  | ContactAddGroup
  | ContactDelGroup;

export type ContactsAction = ContactAnon | ContactEdit | ContactHeed;

export interface ContactAnon {
  anon: null;
}

export interface ContactEdit {
  edit: ContactEditField[];
}

export interface ContactHeed {
  heed: string[];
}

export type ContactRolodex = Record<string, Contact | null>;

export interface ContactNews {
  who: string;
  con: Contact | null;
}
