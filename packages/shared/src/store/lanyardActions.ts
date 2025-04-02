import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';

const logger = createDevLogger('lanyardActions', true);

export async function initiateTwitterAttestation(handle: string) {
  let step = 'initial';
  try {
    // create the attestation
    step = 'creating';
    await api.initiateTwitterAttestation(handle);

    // for twitter, set visibility to public
    step = 'setting discoverability';
    await api.updateAttestationVisibility({
      type: 'twitter',
      value: handle,
      visibility: 'public',
    });

    // set it to display on your profile
    step = 'setting profile display';
    await api.updateAttestationProfileDisplay({
      type: 'twitter',
      value: handle,
      displaySetting: 'full', // will show with handle
    });

    logger.trackEvent(AnalyticsEvent.ActionInitiateTwitterAttest, { handle });
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to initiate twitter attestation',
      error: e,
      errorMessage: e.message,
      erroredAtStep: step,
    });
    throw e;
  }
}

export async function initiatePhoneAttestation(phoneNumber: string) {
  let step = 'initial';
  try {
    // create the attestation
    step = 'creating';
    await api.initiatePhoneAttestation(phoneNumber);

    // for phone, set visibility to discoverable
    step = 'setting discoverability';
    await api.updateAttestationVisibility({
      type: 'phone',
      value: phoneNumber,
      visibility: 'discoverable',
    });

    // set it to display on your profile
    step = 'setting profile display';
    await api.updateAttestationProfileDisplay({
      type: 'phone',
      value: phoneNumber,
      displaySetting: 'half', // will show it exists, but not reveal number
    });

    logger.trackEvent(AnalyticsEvent.ActionInitiatePhoneAttest, {
      phoneNumber,
    });
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to initiate phone attestation',
      error: e,
      errorMessage: e.message,
      erroredAtStep: step,
    });
    throw e;
  }
}

export async function confirmTwitterAttestation(
  handle: string,
  postId: string
) {
  try {
    await api.confirmTwitterAttestation(handle, postId);
    logger.trackEvent(AnalyticsEvent.ActionConfirmTwitterAttest, {
      handle,
      postId,
    });
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to confirm twitter attestation',
      error: e,
      errorMessage: e.message,
    });
    throw e;
  }
}

export async function confirmPhoneAttestation(
  phoneNumber: string,
  otp: string
) {
  try {
    await api.confirmPhoneAttestation(phoneNumber, otp);
    logger.trackEvent(AnalyticsEvent.ActionConfirmPhoneAttest, {
      phoneNumber,
      otp,
    });
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to confirm phone attestation',
      error: e,
      errorMessage: e.message,
    });
    throw e;
  }
}

export async function revokeAttestation(attestation: db.Attestation) {
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
    await db.deleteAttestation({ type, value });
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
