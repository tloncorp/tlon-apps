import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';

const logger = createDevLogger('lanyardActions', true);

export function initiateTwitterAttestation(handle: string) {
  logger.trackEvent(AnalyticsEvent.ActionInitiateTwitterAttest, { handle });
  return api.initiateTwitterAttestation(handle);
}

export function confirmTwitterAttestation(handle: string, postId: string) {
  logger.trackEvent(AnalyticsEvent.ActionConfirmTwitterAttest, {
    handle,
    postId,
  });
  return api.confirmTwitterAttestation(handle, postId);
}
