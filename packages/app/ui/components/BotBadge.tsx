import * as domain from '@tloncorp/shared/domain';

import { useContact } from '../contexts/appDataContext';
import { Badge } from './Badge';

export function useIsBotContact(contactId: string) {
  const contact = useContact(contactId);
  return domain.isBotContact({ id: contactId, botInfo: contact?.botInfo });
}

export function BotBadge({ contactId }: { contactId: string }) {
  const isBot = useIsBotContact(contactId);
  if (!isBot) {
    return null;
  }
  return <Badge type="neutral" size="micro" text="Bot" flexShrink={0} />;
}
