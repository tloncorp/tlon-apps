import type * as db from '@tloncorp/shared/db';
import * as domain from '@tloncorp/shared/domain';

import { useContact } from '../contexts/appDataContext';
import { Badge } from './Badge';

/**
 * What a bot's badge says, or null for a person. Shared with places that show
 * it as text, so every bot reads the same.
 */
export function botBadgeLabel(
  contactId: string,
  contact: db.Contact | null | undefined,
  assumeBot?: boolean
): { text: string; offline: boolean } | null {
  if (
    !assumeBot &&
    !domain.isBotContact({ id: contactId, botInfo: contact?.botInfo })
  ) {
    return null;
  }
  // assumeBot means the caller already knows this is a bot (the post carries
  // isBot), so read the raw claim even when isBotContact can't see it.
  const liveness = assumeBot
    ? domain.parseBotLiveness(contact?.botLiveness)
    : domain.botLivenessOf(contact);
  const offline = liveness === 'offline';
  return { text: offline ? 'Bot · Offline' : 'Bot', offline };
}

export function BotBadge({
  contactId,
  assumeBot,
}: {
  contactId: string;
  assumeBot?: boolean;
}) {
  const contact = useContact(contactId);
  const label = botBadgeLabel(contactId, contact, assumeBot);
  if (!label) {
    return null;
  }
  return (
    <Badge
      type={label.offline ? 'warning' : 'neutral'}
      size="micro"
      text={label.text}
      flexShrink={0}
    />
  );
}
