import * as domain from '@tloncorp/shared/domain';

import { useContact } from '../contexts/appDataContext';
import { Badge } from './Badge';

export function BotBadge({
  contactId,
  assumeBot,
}: {
  contactId: string;
  assumeBot?: boolean;
}) {
  const contact = useContact(contactId);
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
  return (
    <Badge
      type={offline ? 'warning' : 'neutral'}
      size="micro"
      text={offline ? 'Bot · Offline' : 'Bot'}
      flexShrink={0}
    />
  );
}
