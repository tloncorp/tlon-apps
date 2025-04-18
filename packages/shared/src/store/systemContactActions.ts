import * as db from '../db';
import { createDevLogger } from '../debug';
import * as domain from '../domain';
import { AnalyticsEvent, AnalyticsSeverity } from '../domain';

const logger = createDevLogger('SystemContactActions', true);

// export async function importSystemContactBook(
//   systemContacts: db.SystemContact[]
// ) {
//   try {
//     await db.insertSystemContacts({ systemContacts });
//     logger.trackEvent(AnalyticsEvent.DebugSystemContacts, {
//       context: 'inserted system contacts',
//       numContacts: systemContacts.length,
//     });
//   } catch (error) {
//     logger.trackEvent(AnalyticsEvent.ErrorSystemContacts, {
//       context: 'failed to insert system contacts',
//       severity: AnalyticsSeverity.Critical,
//       numContacts: systemContacts.length,
//       error,
//     });
//   }
// }

export async function recordSentInvites(
  invitedTo: string,
  systemContacts: db.SystemContact[]
) {
  const sentInvites: db.SystemContactSentInvite[] = systemContacts.map(
    (contact) => ({
      invitedTo,
      systemContactId: contact.id,
      sentAt: new Date(),
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
      severity: AnalyticsSeverity.Critical,
      numContacts: systemContacts.length,
      error,
    });
  }
}
