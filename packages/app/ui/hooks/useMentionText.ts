import { preSig } from '@tloncorp/api/lib/urbit';
import type * as db from '@tloncorp/shared/db';
import { valid } from '@urbit/aura';
import { useCallback } from 'react';

import { resolveContactNameProps } from '../components/contactNameResolver';
import { useCalm, useContactIndex } from '../contexts/appDataContext';

type MentionRole = { id: string; title?: string | null };

// The text a mention shows when it isn't rendered as a mention: a person's
// nickname or ship number, or a role's title. The mention itself keeps its id
// (a ship or a role).
export function getMentionText(
  id: string,
  {
    contactIndex,
    calmDisableNicknames,
    roles = [],
  }: {
    contactIndex: Record<string, db.Contact> | null | undefined;
    calmDisableNicknames: boolean;
    roles?: MentionRole[];
  }
): string {
  const ship = preSig(id);
  if (valid('p', ship)) {
    return `@${
      resolveContactNameProps({
        contact: contactIndex?.[ship],
        contactId: ship,
        calmDisableNicknames,
      }).children
    }`;
  }
  const role = roles.find((option) => option.id === id);
  return `@${role?.title || id}`;
}

const noRoles: MentionRole[] = [];

export function useMentionText(roles: MentionRole[] = noRoles) {
  const contactIndex = useContactIndex();
  const calm = useCalm();
  return useCallback(
    (id: string) =>
      getMentionText(id, {
        contactIndex,
        calmDisableNicknames: calm.disableNicknames,
        roles,
      }),
    [contactIndex, calm.disableNicknames, roles]
  );
}
