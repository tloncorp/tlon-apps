import { createDevLogger } from '@tloncorp/shared';
import * as domain from '@tloncorp/shared/domain';
import { AnalyticsEvent } from '@tloncorp/shared/domain';
import * as MailComposer from 'expo-mail-composer';
import * as SMS from 'expo-sms';
import { Alert } from 'react-native';

const logger = createDevLogger('ContactsHelpers', true);

export async function inviteSystemContacts(
  params: domain.SystemContactInviteParams
): Promise<boolean> {
  if (!params.recipients.length) {
    return false;
  }

  if (params.type === 'sms') {
    logger.trackEvent(AnalyticsEvent.ActionContactBookInviteShown, {
      type: 'sms',
      numRecipients: params.recipients.length,
    });

    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'initiated sms invite, but system sms not available',
      });
      Alert.alert(
        'SMS Invites Unavailable',
        'Please configure a default SMS app and try again.'
      );
      return false;
    }

    const response = await SMS.sendSMSAsync(
      params.recipients,
      `${params.invite.link}
${params.invite.message}`
    );

    if (response.result === 'sent') {
      logger.trackEvent(AnalyticsEvent.ActionContactBookInviteSent, {
        type: 'sms',
        numRecipients: params.recipients.length,
      });
      return true;
    } else {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'invite opened, but not sent',
        type: 'sms',
        numRecipients: params.recipients.length,
        actionStatus: response.result,
      });
    }
    return false;
  }

  if (params.type === 'email') {
    logger.trackEvent(AnalyticsEvent.ActionContactBookInviteShown, {
      type: 'email',
      numRecipients: params.recipients.length,
    });

    const isAvailable = await MailComposer.isAvailableAsync();
    if (!isAvailable) {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'initiated email invite, but system email not available',
      });
      Alert.alert(
        'Email Invites Unavailable',
        'Please sign into your system email app and try again.'
      );
      return false;
    }
    const result = await MailComposer.composeAsync({
      recipients: params.recipients,
      subject: params.invite.subject ?? `You're Invited to Tlon Messenger!`,
      body: `${params.invite.message}
${params.invite.link}`,
    });

    if (result.status === MailComposer.MailComposerStatus.SENT) {
      logger.trackEvent(AnalyticsEvent.ActionContactBookInviteSent, {
        type: 'email',
        numRecipients: params.recipients.length,
      });
      return true;
    } else {
      logger.trackEvent(AnalyticsEvent.InviteDebug, {
        context: 'invite opened, but not sent',
        type: 'email',
        numRecipients: params.recipients.length,
        actionStatus: result.status,
      });
    }
    return false;
  }
  return false;
}
