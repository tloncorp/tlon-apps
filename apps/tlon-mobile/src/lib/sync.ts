import * as db from '../db';
import { getContacts } from './contactsApi';

export const syncContacts = async () => {
  const contacts = await getContacts();
  db.createBatch('Contact', contacts, db.UpdateMode.All);
};
