import React, { useMemo } from 'react';

import { useCalm } from '../contexts';
import { useContact } from '../contexts/appDataContext';
import { formatUserId } from '../utils/user';
import { Text } from './TextV2';

// This file is temporary -- it uses the new text, and I want to make sure it works across all callsites before swapping it in

type ContactNameOptions = {
  contactId: string;
  expandLongIds?: boolean;
  mode?: 'contactId' | 'nickname' | 'both' | 'auto';
};

export const useContactNameProps = ({
  contactId,
  expandLongIds = false,
  mode = 'auto',
}: ContactNameOptions) => {
  const calm = useCalm();
  const contact = useContact(contactId);
  const showNickname =
    contact?.nickname &&
    (calm.disableNicknames ? mode === 'nickname' : mode !== 'contactId');
  const showContactId =
    (mode === 'auto' && !showNickname) ||
    mode === 'both' ||
    mode === 'contactId';

  return useMemo(() => {
    const idMeta = showContactId
      ? formatUserId(contactId, expandLongIds)
      : null;
    return {
      children: [
        showContactId ? idMeta?.display : null,
        showNickname ? contact?.nickname : null,
      ]
        .filter((i) => !!i)
        .join(' '),
      ['aria-label']: idMeta?.ariaLabel,
    };
  }, [
    contact?.nickname,
    contactId,
    expandLongIds,
    showContactId,
    showNickname,
  ]);
};

export const useContactName = (options: string | ContactNameOptions) => {
  const resolvedOptions = useMemo(() => {
    return typeof options === 'string' ? { contactId: options } : options;
  }, [options]);
  return useContactNameProps(resolvedOptions).children;
};

const BaseContactName = Text.styleable<{
  contactId: string;
  expandLongIds?: boolean;
  mode?: 'contactId' | 'nickname' | 'both' | 'auto';
}>(
  ({ contactId, mode = 'auto', expandLongIds, ...props }, ref) => {
    const calm = useCalm();
    const contact = useContact(contactId);
    const showNickname =
      contact?.nickname &&
      (calm.disableNicknames ? mode === 'nickname' : mode !== 'contactId');
    const showContactId =
      (mode === 'auto' && !showNickname) ||
      mode === 'both' ||
      mode === 'contactId';

    const formattedId = useMemo(() => {
      return showContactId ? formatUserId(contactId, expandLongIds) : null;
    }, [contactId, expandLongIds, showContactId]);

    if (showContactId && !formattedId) {
      console.error('unable to display invalid id', contactId);
      return null;
    }

    return (
      <Text
        {...useContactNameProps({ contactId, expandLongIds, mode })}
        {...props}
      ></Text>
    );
  },
  {
    staticConfig: {
      componentName: 'ContactName',
    },
  }
);

export const ContactName = React.memo(BaseContactName);
