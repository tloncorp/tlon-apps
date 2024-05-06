import { ComponentProps, useMemo } from 'react';

import { useCalm } from '../contexts/calm';
import { useContact } from '../contexts/contacts';
import { SizableText } from '../core';
import { formatUserId } from '../utils/user';

export default function ContactName({
  userId,
  full = false,
  showAlias = false,
  ...rest
}: ComponentProps<typeof SizableText> & {
  userId: string;
  full?: boolean;
  showAlias?: boolean;
}) {
  const calm = useCalm();
  const contact = useContact(userId);

  const showNickname = useMemo(
    () => contact?.nickname && !calm.disableNicknames && showAlias,
    [contact, calm.disableNicknames, showAlias]
  );

  const formattedId = formatUserId(userId, full);
  if (!formattedId) {
    return null;
  }

  return (
    <SizableText aria-label={formattedId.ariaLabel} {...rest}>
      {showNickname ? contact!.nickname : formattedId.display}
    </SizableText>
  );
}
