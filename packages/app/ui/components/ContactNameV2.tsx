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

import { useCalm } from '../contexts/appDataContext';
import { useContact } from '../contexts/appDataContext';
import {
  type ContactNameMode,
  resolveContactNameProps,
} from './contactNameResolver';

export {
  type ContactNameMode,
  type ContactNameResolveInput,
  type ContactNameResolveResult,
  resolveContactNameProps,
} from './contactNameResolver';

type ContactNameOptions = {
  contactId: string;
  expandLongIds?: boolean;
  mode?: ContactNameMode;
};

export const useContactNameProps = ({
  contactId,
  expandLongIds = false,
  mode = 'auto',
}: ContactNameOptions) => {
  const calm = useCalm();
  const contact = useContact(contactId);

  return useMemo(() => {
    const resolved = resolveContactNameProps({
      contact,
      contactId,
      expandLongIds,
      mode,
      calmDisableNicknames: calm.disableNicknames,
    });
    return {
      children: resolved.children,
      ['aria-label']: resolved['aria-label'],
    };
  }, [contact, contactId, expandLongIds, mode, calm.disableNicknames]);
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
  mode?: ContactNameMode;
}>(
  ({ contactId, mode = 'auto', expandLongIds, ...props }, ref) => {
    const calm = useCalm();
    const contact = useContact(contactId);
    const resolved = useMemo(
      () =>
        resolveContactNameProps({
          contact,
          contactId,
          expandLongIds,
          mode,
          calmDisableNicknames: calm.disableNicknames,
        }),
      [contact, contactId, expandLongIds, mode, calm.disableNicknames]
    );

    if (resolved.showContactId && !resolved.formattedId) {
      console.error('unable to display invalid id', contactId);
      return null;
    }

    return (
      <RawText
        aria-label={resolved['aria-label']}
        {...props}
        style={props.style ?? { whiteSpace: 'nowrap' }}
      >
        {resolved.children}
      </RawText>
    );
  },
  {
    staticConfig: {
      componentName: 'ContactName',
    },
  }
);

export const ContactName = React.memo(BaseContactName);
