import * as domain from '@tloncorp/shared/domain';

import { useContact } from '../contexts/appDataContext';
import { Badge, type BadgeSize } from './Badge';

export function useIsBotContact(contactId: string) {
  const contact = useContact(contactId);
  return domain.isBotContact({ id: contactId, botInfo: contact?.botInfo });
}

export function BotBadge({
  contactId,
  // Inline next to a name the badge should stay out of the way; in a row that
  // lines it up with sibling badges it has to match their size.
  size = 'micro',
}: {
  contactId: string;
  size?: BadgeSize;
}) {
  const isBot = useIsBotContact(contactId);
  if (!isBot) {
    return null;
  }
  return <Badge type="neutral" size={size} text="Bot" flexShrink={0} />;
}
