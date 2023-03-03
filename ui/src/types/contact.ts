import { Resource } from '@urbit/api';

export interface Contact {
  nickname: string;
  bio: string;
  status: string;
  color: string;
  avatar: string | null;
  cover: string | null;
  groups: string[];
  'last-updated': string;
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

export type ContactsAction = ContactDrop | ContactEdit;

export interface ContactDrop {
  drop: null;
}

export interface ContactEdit {
  edit: ContactEditField[];
}

export type ContactRolodex = Record<string, Contact>;
