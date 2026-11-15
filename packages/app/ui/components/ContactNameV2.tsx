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
 * // Set a pet name in the monospace paired with the surrounding text size
 * <Text size="$label/m"><ContactName contactId={userId} size="$label/m" /></Text>
 *
 * // Use as a hook for text-only contexts
 * const name = useContactName(userId);
 * ```
 */
import { escapeRegExp } from '@tloncorp/api/lib/utils';
import { RawText, type TextSize, monoPairStyle } from '@tloncorp/ui';
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

function petNameStyle(size: TextSize | undefined, fontSize: unknown) {
  if (size) {
    return monoPairStyle(size);
  }
  return typeof fontSize === 'number'
    ? monoPairStyle(fontSize)
    : ({ fontFamily: '$mono', letterSpacing: 0 } as const);
}

// Bolds the first match of a search query in a nickname. A pet name is shown
// as is.
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
  /**
   * The size of the text this name sits in. A pet name is set in monospace a
   * point smaller (`monoPairStyle`); without a size, or a `fontSize`, it keeps
   * the surrounding size.
   */
  size?: TextSize;
}>(
  ({ contactId, mode = 'auto', matchText, size, ...props }, ref) => {
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
        {resolved.formattedId ? (
          // Monospace marks a pet name as an address, set apart from any
          // nickname, which stays in the surrounding font.
          <RawText {...petNameStyle(size, props.fontSize)}>
            {resolved.formattedId.display}
          </RawText>
        ) : null}
        {resolved.formattedId && resolved.nickname ? ' ' : null}
        {resolved.nickname
          ? highlightMatch(resolved.nickname, matchText)
          : null}
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
