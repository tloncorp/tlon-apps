import * as db from '../db';

const CacheKeys = {
  contacts: 'tlon:cache:contacts',
  contactsLastUpdated: 'tlon:cache:contacts:lastUpdated',
};

const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;

export function cacheContacts(contacts: db.Contact[]) {
  const value = JSON.stringify(contacts);
  localStorage.setItem(CacheKeys.contacts, value);
  localStorage.setItem(CacheKeys.contactsLastUpdated, Date.now().toString());
}

export async function loadCachedContacts(): Promise<boolean> {
  try {
    const contactsValue = localStorage.getItem(CacheKeys.contacts);
    const lastUpdatedValue = localStorage.getItem(
      CacheKeys.contactsLastUpdated
    );

    if (!contactsValue || !lastUpdatedValue) {
      return false;
    }

    const contacts = JSON.parse(contactsValue) as db.Contact[];
    const lastUpdated = new Date(lastUpdatedValue).getTime();

    if (Date.now() - lastUpdated > TWO_DAYS) {
      return false;
    }

    await db.insertContacts(contacts);
    return true;
  } catch (e) {
    console.error('Failed to load cached contacts', e);
    return false;
  }
}
