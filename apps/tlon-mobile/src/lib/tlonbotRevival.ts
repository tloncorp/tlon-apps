import * as api from '@tloncorp/api';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';

const logger = createDevLogger('tlonbotRevival', true);

const TLONBOT_REVIVAL_WAYFINDING_GROUP_IDS = ['~wittyr-witbes/v3s2kbd7'];

export function prejoinTlonbotRevivalWayfindingGroups() {
  TLONBOT_REVIVAL_WAYFINDING_GROUP_IDS.forEach((groupId) => {
    api.joinGroup(groupId).catch((error) => {
      logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
        error,
        context: 'failed to prejoin TlonBot revival wayfinding group',
        groupId,
        during: 'mobile TlonBot revival',
        severity: AnalyticsSeverity.High,
      });
    });
  });
}
