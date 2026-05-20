import * as api from '@tloncorp/api';
import {
  AnalyticsEvent,
  AnalyticsSeverity,
  createDevLogger,
} from '@tloncorp/shared';

const logger = createDevLogger('tlonbotRevival', true);

const TLONBOT_REVIVAL_GROUP_IDS = [
  '~ramlud-bintun/v1l3qcoq',
  '~wittyr-witbes/v3s2kbd7',
];

export function prejoinTlonbotRevivalGroups() {
  TLONBOT_REVIVAL_GROUP_IDS.forEach((groupId) => {
    api.joinGroup(groupId).catch((error) => {
      logger.trackEvent(AnalyticsEvent.ErrorWayfinding, {
        error,
        context: 'failed to prejoin TlonBot revival group',
        groupId,
        during: 'mobile TlonBot revival',
        severity: AnalyticsSeverity.High,
      });
    });
  });
}
