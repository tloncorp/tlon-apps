import * as db from '@tloncorp/shared/db';

import { formatUserId } from '../utils/user';

export type ContactNameMode = 'contactId' | 'nickname' | 'both' | 'auto';

export type ContactNameResolveInput = {
  contact: db.Contact | null | undefined;
  contactId: string;
  expandLongIds?: boolean;
  mode?: ContactNameMode;
  calmDisableNicknames: boolean;
};

export type ContactNameResolveResult = {
  children: string;
  ['aria-label']: string | undefined;
  showContactId: boolean;
  formattedId: ReturnType<typeof formatUserId>;
};

export function resolveContactNameProps({
  contact,
  contactId,
  expandLongIds = false,
  mode = 'auto',
  calmDisableNicknames,
}: ContactNameResolveInput): ContactNameResolveResult {
  const showNickname = !!(
    contact?.nickname &&
    (calmDisableNicknames ? mode === 'nickname' : mode !== 'contactId')
  );
  const showContactId =
    (mode === 'auto' && !showNickname) ||
    mode === 'both' ||
    mode === 'contactId';

  const formattedId = showContactId
    ? formatUserId(contactId, expandLongIds)
    : null;

  const children = [
    showContactId ? formattedId?.display : null,
    showNickname ? contact?.nickname : null,
  ]
    .filter((i): i is string => !!i)
    .join(' ');

  return {
    children,
    ['aria-label']: formattedId?.ariaLabel,
    showContactId,
    formattedId,
  };
}
