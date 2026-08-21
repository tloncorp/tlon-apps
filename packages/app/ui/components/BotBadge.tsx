import * as domain from '@tloncorp/shared/domain';

import { useContact } from '../contexts/appDataContext';
import { Badge } from './Badge';

export function BotBadge({ contactId }: { contactId: string }) {
  const contact = useContact(contactId);
  if (!domain.isBotContact({ id: contactId, botInfo: contact?.botInfo })) {
    return null;
  }
  return <Badge type="neutral" size="micro" text="Bot" flexShrink={0} />;
}
