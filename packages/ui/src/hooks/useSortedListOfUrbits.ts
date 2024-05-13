import { createDevLogger, logSyncDuration } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { isValidPatp, preSig } from '@tloncorp/shared/src/urbit';
import { useMemo } from 'react';

type UrbitSort = 'pals' | 'nickname' | 'alphabetical';
const DEFAULT_SORT_ORDER: UrbitSort[] = ['pals', 'nickname', 'alphabetical'];

const logger = createDevLogger('urbitSorter', true);

export function useSortedListOfUrbits({
  contacts,
  query,
  sortOrder = DEFAULT_SORT_ORDER,
}: {
  contacts: db.Contact[];
  query: string;
  sortOrder?: UrbitSort[]; // ordered list of priorities in the sort
}) {
  const pals = useMemo(() => new Set([]), []);
  const sortedContacts = useMemo(
    () => sortContacts(contacts, sortOrder, pals),
    [contacts, sortOrder, pals]
  );

  if (isValidQuery(query)) {
    const filtered = filterContactsOnQuery(sortedContacts, query);
    const exactMatchCheck = preSig(query.trim().toLocaleLowerCase());
    if (isValidPatp(exactMatchCheck)) {
      const exactMatch = db.getFallbackContact(exactMatchCheck);
      filtered.push(exactMatch);
    }
    return filtered;
  }
  return sortedContacts;
}

function sortContacts(
  contacts: db.Contact[],
  sortOrder: UrbitSort[],
  pals: Set<string>
) {
  return logSyncDuration('sortContacts', logger, () => {
    return contacts.sort((a, b) => {
      for (const sorter of sortOrder) {
        const result = sorters[sorter](a, b, { pals });
        if (result !== 0) {
          return result;
        }
      }
      return 0;
    });
  });
}

const sorters = {
  pals: palsSorter,
  nickname: nicknameSorter,
  alphabetical: alphabeticalSorter,
};

function palsSorter(
  a: db.Contact,
  b: db.Contact,
  { pals }: { pals: Set<string> }
): number {
  if (pals.has(a.id) && !pals.has(b.id)) {
    return -1;
  }

  if (!pals.has(a.id) && pals.has(b.id)) {
    return 1;
  }

  return 0;
}

function nicknameSorter(a: db.Contact, b: db.Contact): number {
  if (a.nickname && !b.nickname) {
    return -1;
  }

  if (b.nickname && !a.nickname) {
    return 1;
  }

  return 0;
}

function alphabeticalSorter(a: db.Contact, b: db.Contact): number {
  const aName = a.nickname?.replace(/[~-]/g, '') ?? a.id.replace(/[~-]/g, '');
  const bName = b.nickname?.replace(/[~-]/g, '') ?? b.id.replace(/[~-]/g, '');
  return aName.localeCompare(bName);
}

function filterContactsOnQuery(contacts: db.Contact[], query: string) {
  if (!isValidQuery(query)) return [];
  const processedQuery = query.trim().toLowerCase().replace(/[~-]/g, '');
  return logSyncDuration('filterContactsOnQuery', logger, () => {
    return contacts.filter((contact) => {
      const nickname = contact.nickname?.toLowerCase() ?? '';
      const id = contact.id.replace(/[~-]/g, '');
      return (
        nickname.startsWith(processedQuery) || id.startsWith(processedQuery)
      );
    });
  });
}

function isValidQuery(query: string) {
  return query.length && query.trim() !== '';
}
