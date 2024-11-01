import { createDevLogger, logSyncDuration } from '@tloncorp/shared';
import * as db from '@tloncorp/shared/db';
import { preSig } from '@tloncorp/shared/urbit';
import anyAscii from 'any-ascii';
import { useMemo } from 'react';
import { isValidPatp } from 'urbit-ob';

import * as utils from '../utils';
import { resolveNickname } from '../utils';

type UrbitSort = 'pals' | 'nickname' | 'alphabetical';
const DEFAULT_SORT_ORDER: UrbitSort[] = ['nickname', 'alphabetical'];

const logger = createDevLogger('urbitSorter', false);

export type AlphaContactsSegment = {
  label: string;
  data: db.Contact[];
};

export type AlphaSegmentedContacts = AlphaContactsSegment[];

export function useAlphabeticallySegmentedContacts(
  contacts: db.Contact[],
  contactsIndex: Record<string, db.Contact>
): AlphaSegmentedContacts {
  const segmentedContacts = useMemo(() => {
    return logSyncDuration('useAlphabeticallySegmentedContacts', logger, () => {
      const segmented: Record<
        string,
        { id: string; sortable: string; contact: db.Contact }[]
      > = {};

      // convert contact to alphabetical representation and bucket by first letter
      for (const contact of contacts) {
        const sortableName = resolveNickname(contact)
          ? anyAscii(resolveNickname(contact)!.replace(/[~-]/g, ''))
          : contact.id.replace(/[~-]/g, '');
        const firstAlpha = utils.getFirstAlphabeticalChar(sortableName);
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
        .map(([label, results]) => {
          const segmentContacts = sortContacts(
            results.map((r) => r.contact),
            ['nickname', 'alphabetical'],
            new Set()
          );
          // .sort((a, b) => a.sortable.localeCompare(b.sortable))
          // .map((result) => contactsIndex[result.id]);
          return { label, data: segmentContacts };
        });

      // add non-alphabetical names to the end
      if (nonAlphaNames && nonAlphaNames.length) {
        segmentedContacts.push({
          label: '_',
          data: nonAlphaNames.map((result) => contactsIndex[result.id]),
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

  const finalContacts = useMemo(() => {
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
  }, [query, sortedContacts]);

  return finalContacts;
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
  if (resolveNickname(a) && !resolveNickname(b)) {
    return -1;
  }

  if (resolveNickname(b) && !resolveNickname(a)) {
    return 1;
  }

  // prioritize nicknames that aren't just @p's
  if (resolveNickname(b) && resolveNickname(a)) {
    const aIsPatp = isValidPatp(anyAscii(resolveNickname(a)!.trim()));
    const bIsPatp = isValidPatp(anyAscii(resolveNickname(b)!.trim()));
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
  const aName =
    resolveNickname(a)?.replace(/[~-]/g, '') ?? a.id.replace(/[~-]/g, '');
  const bName =
    resolveNickname(b)?.replace(/[~-]/g, '') ?? b.id.replace(/[~-]/g, '');
  return aName.localeCompare(bName);
}

function filterContactsOnQuery(contacts: db.Contact[], query: string) {
  if (!isValidQuery(query)) return [];
  const processedQuery = query.trim().toLowerCase().replace(/[~-]/g, '');
  return logSyncDuration('filterContactsOnQuery', logger, () => {
    return contacts.filter((contact) => {
      const nickname = resolveNickname(contact)?.toLowerCase() ?? '';
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
