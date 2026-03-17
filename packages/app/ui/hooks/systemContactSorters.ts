import * as db from '@tloncorp/shared/db';
import anyAscii from 'any-ascii';
import Fuse from 'fuse.js';
import { useCallback, useMemo, useState } from 'react';

import { getFirstAlphabeticalChar } from '../utils';

export type SystemContactSection = {
  label: string;
  data: db.SystemContact[];
};

/**
 * Gets the sortable display name for a system contact.
 */
function getSystemContactSortableName(contact: db.SystemContact): string {
  const firstName = contact.firstName || '';
  const lastName = contact.lastName || '';
  const displayName = firstName || lastName;
  return anyAscii(displayName);
}

/**
 * Sorts system contacts into alphabetical sections.
 * Contacts without names go into the 'Other' section at the end.
 */
export function sortSystemContactsIntoSections(
  contacts: db.SystemContact[]
): SystemContactSection[] {
  const sections: Record<string, db.SystemContact[]> = {};

  // Sort contacts into appropriate sections
  for (const contact of contacts) {
    const sortableName = getSystemContactSortableName(contact);
    const sectionKey = getFirstAlphabeticalChar(sortableName);

    if (!sections[sectionKey]) {
      sections[sectionKey] = [];
    }
    sections[sectionKey].push(contact);
  }

  // Pull out non-alphabetical names
  const nonAlphaContacts = sections['Other'];
  delete sections['Other'];

  // Order groupings alphabetically and sort contacts within each bucket
  const sectionArray = Object.entries(sections)
    .filter(([_, data]) => data.length > 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, data]) => ({
      label,
      data: data.sort((a, b) => {
        const nameA = getSystemContactSortableName(a);
        const nameB = getSystemContactSortableName(b);
        return nameA.localeCompare(nameB);
      }),
    }));

  // Add non-alphabetical names to the end
  if (nonAlphaContacts && nonAlphaContacts.length > 0) {
    sectionArray.push({ label: '#', data: nonAlphaContacts });
  }

  return sectionArray;
}

/**
 * Fuzzy search service for system contacts using Fuse.js.
 * Searches across firstName, lastName, phoneNumber, and email.
 */
export class SystemContactSearchService {
  private fuse: Fuse<db.SystemContact>;

  constructor(contacts: db.SystemContact[]) {
    // Configure Fuse with appropriate options
    const options = {
      keys: ['firstName', 'lastName', 'phoneNumber', 'email'],
      threshold: 0.4, // Lower threshold means more strict matching
      ignoreLocation: true,
      shouldSort: true,
    };

    this.fuse = new Fuse(contacts, options);
  }

  // Search contacts with a query string
  search(query: string): db.SystemContact[] {
    if (!query.trim()) {
      return [];
    }

    return this.fuse.search(query).map((result) => result.item);
  }
}

/**
 * Hook for searching and filtering system contacts.
 * Returns search state, handlers, and filtered results.
 */
export function useSystemContactSearch(contacts: db.SystemContact[]) {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<db.SystemContact[]>([]);

  const searchService = useMemo(() => {
    return new SystemContactSearchService(contacts);
  }, [contacts]);

  const handleSearch = useCallback(
    (newQuery: string) => {
      setQuery(newQuery);
      const results = searchService.search(newQuery);
      setSearchResults(results);
    },
    [searchService]
  );

  const displayContacts = useMemo(() => {
    return searchResults.length > 0 ? searchResults : contacts;
  }, [searchResults, contacts]);

  const isSearching = query.trim().length > 0;

  return {
    query,
    searchResults,
    displayContacts,
    isSearching,
    handleSearch,
  };
}
