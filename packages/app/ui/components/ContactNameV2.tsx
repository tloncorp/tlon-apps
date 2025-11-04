/**
 * ContactNameV2 - The canonical component for displaying contact names throughout the app.
 *
 * This component provides consistent contact name display with:
 * - Automatic Calm mode support (respects disableNicknames setting)
 * - Flexible display modes (nickname, contactId, both, or auto)
 * - Proper aria labels for accessibility
 * - Full or shortened userId display
 *
 * Usage:
 * ```tsx
 * // Auto mode (shows nickname if available, otherwise userId)
 * <ContactName contactId={userId} />
 *
 * // Force show nickname
 * <ContactName contactId={userId} mode="nickname" />
 *
 * // Show both nickname and userId
 * <ContactName contactId={userId} mode="both" />
 *
 * // Use as a hook for text-only contexts
 * const name = useContactName(userId);
 * ```
 *
 * Note: For search highlighting, use the legacy ContactName component instead.
 */
import { RawText } from '@tloncorp/ui';
import React, { useMemo } from 'react';

import { useCalm } from '../contexts';
import { useContact } from '../contexts/appDataContext';
import { formatUserId } from '../utils/user';

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

const BaseContactName = RawText.styleable<{
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
      <RawText
        {...useContactNameProps({ contactId, expandLongIds, mode })}
        {...props}
        style={props.style ?? { whiteSpace: 'nowrap' }}
      ></RawText>
    );
  },
  {
    staticConfig: {
      componentName: 'ContactName',
    },
  }
);

export const ContactName = React.memo(BaseContactName);
