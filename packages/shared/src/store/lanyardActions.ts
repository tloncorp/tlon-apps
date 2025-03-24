import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';

const logger = createDevLogger('lanyardActions', true);

export async function initiateTwitterAttestation(handle: string) {
  try {
    // create the attestation
    await api.initiateTwitterAttestation(handle);

    // for twitter, set visibility to public
    await api.updateAttestationVisibility({
      type: 'twitter',
      value: handle,
      visibility: 'public',
    });

    logger.trackEvent(AnalyticsEvent.ActionInitiateTwitterAttest, { handle });
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to initiate twitter attestation',
      error: e,
      errorMessage: e.message,
    });
    throw e;
  }
}

export async function initiatePhoneAttestation(phoneNumber: string) {
  try {
    // create the attestation
    await api.initiatePhoneAttestation(phoneNumber);

    // for phone, set visibility to discoverable
    await api.updateAttestationVisibility({
      type: 'phone',
      value: phoneNumber,
      visibility: 'discoverable',
    });

    logger.trackEvent(AnalyticsEvent.ActionInitiatePhoneAttest, {
      phoneNumber,
    });
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to initiate phone attestation',
      error: e,
      errorMessage: e.message,
    });
    throw e;
  }
}

export function confirmTwitterAttestation(handle: string, postId: string) {
  logger.trackEvent(AnalyticsEvent.ActionConfirmTwitterAttest, {
    handle,
    postId,
  });
  return api.confirmTwitterAttestation(handle, postId);
}

export function confirmPhoneAttestation(phoneNumber: string, otp: string) {
  logger.trackEvent(AnalyticsEvent.ActionConfirmPhoneAttest, {
    phoneNumber,
    otp,
  });
  return api.confirmPhoneAttestation(phoneNumber, otp);
}

export async function revokeAttestation(attestation: db.Verification) {
  const currentUserId = api.getCurrentUserId();

  if (attestation.contactId !== currentUserId) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'Cannot revoke attestation for another user',
    });
    throw new Error('Cannot revoke attestation for another user');
  }

  const type = attestation.type;
  const value = attestation.value;

  if (!value) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'Cannot revoke attestation without value',
    });
    throw new Error('Cannot revoke attestation without value');
  }

  try {
    await api.revokeAttestation({ type, value });
    await db.deleteVerification({ type, value });
    logger.trackEvent(AnalyticsEvent.ActionRevokeAttestation, { attestation });
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to revoke attestation',
      type: attestation.type,
      value: attestation.value,
      error: e,
      errorMessage: e.message,
    });
    throw e;
  }
}

export async function checkAttestedSignature(
  signature: string
): Promise<boolean> {
  try {
    const isValid = await api.checkAttestedSignature(signature);
    logger.trackEvent(AnalyticsEvent.ActionCheckAttestSig, {
      signature,
      isValid,
    });
    return isValid;
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to check attestation signature',
      signature,
      error: e,
      errorMessage: e.message,
    });
    throw e;
  }
}
