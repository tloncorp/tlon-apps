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

export function initiatePhoneAttestation(phoneNumber: string) {
  logger.trackEvent(AnalyticsEvent.ActionInitiatePhoneAttest, { phoneNumber });
  return api.initiatePhoneAttestation(phoneNumber);
}

export function confirmPhoneAttestation(phoneNumber: string, otp: string) {
  logger.trackEvent(AnalyticsEvent.ActionConfirmPhoneAttest, {
    phoneNumber,
    otp,
  });
  return api.confirmPhoneAttestation(phoneNumber, otp);
}
