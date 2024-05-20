import { createDevLogger, logSyncDuration } from '@tloncorp/shared/dist';
import * as db from '@tloncorp/shared/dist/db';
import { preSig } from '@tloncorp/shared/src/urbit';
import anyAscii from 'any-ascii';
import { useMemo } from 'react';
import { isValidPatp } from 'urbit-ob';

type UrbitSort = 'pals' | 'nickname' | 'alphabetical';
const DEFAULT_SORT_ORDER: UrbitSort[] = ['nickname', 'alphabetical'];

const logger = createDevLogger('urbitSorter', true);

export type AlphaContactsSegment = {
  alphaKey: string;
  contacts: db.Contact[];
};

export type AlphaSegmentedContacts = AlphaContactsSegment[];

export function useAlphabeticallySegmentedContacts(
  contacts: db.Contact[],
  contactsIndex: Record<string, db.Contact>
): AlphaSegmentedContacts {
  const getFirstAlphabeticalChar = (name: string) => {
    const match = name.match(/[a-zA-Z]/);
    return match ? match[0].toUpperCase() : 'Other';
  };

  const segmentedContacts = useMemo(() => {
    return logSyncDuration('useAlphabeticallySegmentedContacts', logger, () => {
      const segmented: Record<
        string,
        { id: string; sortable: string; contact: db.Contact }[]
      > = {};

      // convert contact to alphabetical representation and bucket by first letter
      for (const contact of contacts) {
        const sortableName = contact.nickname
          ? anyAscii(contact.nickname.replace(/[~-]/g, ''))
          : contact.id.replace(/[~-]/g, '');
        const firstAlpha = getFirstAlphabeticalChar(sortableName);
        if (!segmented[firstAlpha]) {
          segmented[firstAlpha] = [];
        }
        segmented[firstAlpha].push({
          id: contact.id,
          sortable: sortableName,
          contact,
        });
      }

      // pull out non-alphabetical names
      const nonAlphaNames = segmented['Other'];
      delete segmented['Other'];

      // order groupings alphabetically and sort hits within each bucket
      const segmentedContacts = Object.entries(segmented)
        .filter(([_k, results]) => results.length > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([alphaKey, results]) => {
          const segmentContacts = sortContacts(
            results.map((r) => r.contact),
            ['nickname', 'alphabetical'],
            new Set()
          );
          // .sort((a, b) => a.sortable.localeCompare(b.sortable))
          // .map((result) => contactsIndex[result.id]);
          return { alphaKey, contacts: segmentContacts };
        });

      // add non-alphabetical names to the end
      if (nonAlphaNames && nonAlphaNames.length) {
        segmentedContacts.push({
          alphaKey: '_',
          contacts: nonAlphaNames.map((result) => contactsIndex[result.id]),
        });
      }

      return segmentedContacts;
    });
  }, [contacts, contactsIndex]);

  return segmentedContacts;
}

export function useSortedContacts({
  contacts,
  query,
  sortOrder = DEFAULT_SORT_ORDER,
}: {
  contacts: db.Contact[];
  query: string;
  sortOrder?: UrbitSort[]; // ordered list of priorities in the sort
}) {
  // no longer used in mocks, we can implement once needed.
  // for now pals sorter is a no op
  const pals = useMemo(() => new Set([]), []);
  const sortedContacts = useMemo(() => {
    if (sortOrder.length === 0) {
      return contacts;
    } else {
      return sortContacts(contacts, sortOrder, pals);
    }
  }, [contacts, sortOrder, pals]);

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

  // prioritize nicknames that aren't just @p's
  if (b.nickname && a.nickname) {
    const aIsPatp = isValidPatp(anyAscii(a.nickname.trim()));
    const bIsPatp = isValidPatp(anyAscii(b.nickname.trim()));
    if (aIsPatp && !bIsPatp) {
      return 1;
    }
    if (!aIsPatp && bIsPatp) {
      return -1;
    }
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
