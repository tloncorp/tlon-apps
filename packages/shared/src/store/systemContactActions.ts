import * as db from '../db';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { AnalyticsEvent, AnalyticsSeverity } from '../domain';

const logger = createDevLogger('SystemContactActions', false);

export async function recordSentInvites(
  invitedTo: string,
  systemContacts: db.SystemContact[]
) {
  const sentInvites: db.SystemContactSentInvite[] = systemContacts.map(
    (contact) => ({
      invitedTo,
      systemContactId: contact.id,
      invitedAt: Date.now(),
    })
  );

  try {
    await db.insertSystemContactSentInvites({ sentInvites });
    logger.trackEvent(AnalyticsEvent.DebugSystemContacts, {
      context: 'inserted system contact sent invites',
      numContacts: systemContacts.length,
    });
  } catch (error) {
    logger.trackEvent(AnalyticsEvent.ErrorSystemContacts, {
      context: 'failed to insert system contact sent invites',
      severity: AnalyticsSeverity.Medium,
      numContacts: systemContacts.length,
      error,
    });
  }
}
