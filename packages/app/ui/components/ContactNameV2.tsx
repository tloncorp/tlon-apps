/**
 * ContactNameV2 - The canonical component for displaying contact names throughout the app.
 *
 * This component provides consistent contact name display with:
 * - Automatic Calm mode support (respects disableNicknames setting)
 * - Flexible display modes (nickname, contactId, both, or auto)
 * - Proper aria labels for accessibility
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
 * // Highlight a search match within the nickname
 * <ContactName contactId={userId} matchText={query} />
 *
 * // Use as a hook for text-only contexts
 * const name = useContactName(userId);
 * ```
 */
import { escapeRegExp } from '@tloncorp/api/lib/utils';
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
  mode?: ContactNameMode;
};

export const useContactNameProps = ({
  contactId,
  mode = 'auto',
}: ContactNameOptions) => {
  const calm = useCalm();
  const contact = useContact(contactId);

  return useMemo(() => {
    const resolved = resolveContactNameProps({
      contact,
      contactId,
      mode,
      calmDisableNicknames: calm.disableNicknames,
    });
    return {
      children: resolved.children,
      ['aria-label']: resolved['aria-label'],
    };
  }, [contact, contactId, mode, calm.disableNicknames]);
};

export const useContactName = (options: string | ContactNameOptions) => {
  const resolvedOptions = useMemo(() => {
    return typeof options === 'string' ? { contactId: options } : options;
  }, [options]);
  return useContactNameProps(resolvedOptions).children;
};

// Bolds the first match of a search query in a nickname. An ID number is
// shown as is.
function highlightMatch(text: string, matchText: string | undefined) {
  const match = matchText
    ? text.match(new RegExp(escapeRegExp(matchText), 'i'))
    : null;
  if (!match || match.index === undefined) {
    return text;
  }
  const end = match.index + match[0].length;
  return (
    <>
      {text.slice(0, match.index)}
      <RawText fontWeight="bold">{text.slice(match.index, end)}</RawText>
      {text.slice(end)}
    </>
  );
}

const BaseContactName = RawText.styleable<{
  contactId: string;
  mode?: ContactNameMode;
  /** Search query to highlight within a displayed nickname. */
  matchText?: string;
}>(
  ({ contactId, mode = 'auto', matchText, ...props }, ref) => {
    const calm = useCalm();
    const contact = useContact(contactId);
    const resolved = useMemo(
      () =>
        resolveContactNameProps({
          contact,
          contactId,
          mode,
          calmDisableNicknames: calm.disableNicknames,
        }),
      [contact, contactId, mode, calm.disableNicknames]
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
        {resolved.showContactId
          ? resolved.children
          : highlightMatch(resolved.children, matchText)}
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
