import { deSig, preSig } from '@urbit/api';
import fuzzy from 'fuzzy';
import _ from 'lodash';
import { useMemo } from 'react';
import { isValidPatp } from 'urbit-ob';

import { MAX_DISPLAYED_OPTIONS } from '@/constants';
import { useMemoizedContacts } from '@/state/contact';

export default function useShipSearch(
  query: string
): { value: string; label: string }[] {
  const contacts = useMemoizedContacts();
  const contactNames = useMemo(() => Object.keys(contacts), [contacts]);
  const contactOptions = useMemo(
    () =>
      contactNames.map((contact) => ({
        value: contact,
        label: contacts[contact]?.nickname || '',
      })),
    [contactNames, contacts]
  );

  const filteredOptions = useMemo(() => {
    if (!query) {
      return contactOptions;
    }

    // fuzzy search both nicknames and patps; fuzzy#filter only supports
    // string comparision, so concat nickname + patp
    const searchSpace = Object.entries(contacts).map(
      ([patp, contact]) => `${contact?.nickname || ''}${patp}`
    );

    const fuzzyNames = fuzzy
      .filter(query, searchSpace)
      .sort((a, b) => {
        const filter = deSig(query) || '';
        const left = deSig(a.string)?.startsWith(filter)
          ? a.score + 1
          : a.score;
        const right = deSig(b.string)?.startsWith(filter)
          ? b.score + 1
          : b.score;

        return right - left;
      })
      .map((result) => contactNames[result.index]);

    return fuzzyNames.map((contact) => ({
      value: contact,
      label: contacts[contact]?.nickname || '',
    }));
  }, [contactNames, contactOptions, contacts, query]);

  const searchResults = useMemo(() => {
    const trimmed = filteredOptions.slice(0, MAX_DISPLAYED_OPTIONS);

    const exactQueryIncluded = _.includes(
      trimmed.map((o) => o.value),
      preSig(query)
    );
    const exactQueryIsValid = isValidPatp(preSig(query));
    if (!exactQueryIncluded && exactQueryIsValid) {
      trimmed.unshift({ value: preSig(query), label: query });
    }
    return trimmed;
  }, [filteredOptions, query]);

  return searchResults;
}
