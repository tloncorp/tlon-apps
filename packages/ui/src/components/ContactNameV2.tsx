import { useMemo } from 'react';
import React from 'react';

import { useContact } from '../contexts/appDataContext';
import { useCalm } from '../contexts/calm';
import { formatUserId } from '../utils/user';
import { Text } from './TextV2';

// This file is temporary -- it uses the new text, and I want to make sure it
// works across all callsites before swapping it in globally.

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
      <Text {...props} ref={ref} aria-label={formattedId?.ariaLabel}>
        {showContactId ? formattedId?.display : null}
        {showNickname && showContactId ? ' ' : null}
        {showNickname ? contact.nickname : null}
      </Text>
    );
  },
  {
    staticConfig: {
      componentName: 'ContactName',
    },
  }
);

export const ContactName = React.memo(BaseContactName);
