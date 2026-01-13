import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent, AnalyticsSeverity } from '../domain';

const logger = createDevLogger('lanyardActions', true);

export async function initiateTwitterAttestation(handle: string) {
  let step = 'initial';
  try {
    // create the attestation
    step = 'creating';
    await api.initiateTwitterAttestation(handle);

    // for twitter, set visibility to public
    step = 'setting discoverability';
    await api.updateAttestationDiscoverability({
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
      error: e,
      context: 'failed to initiate twitter attestation',
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
    await api.updateAttestationDiscoverability({
      type: 'phone',
      value: phoneNumber,
      visibility: 'verified',
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
      error: e,
      context: 'failed to initiate phone attestation',
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
      error: e,
      context: 'failed to confirm twitter attestation',
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
      error: e,
      context: 'failed to confirm phone attestation',
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
      error: e,
      context: 'failed to revoke attestation',
      type: attestation.type,
      value: attestation.value,
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
      error: e,
      context: 'failed to check attestation signature',
      signature,
    });
    throw e;
  }
}

export async function updateAttestationDiscoverability({
  attestation,
  discoverability,
}: {
  attestation: db.Attestation;
  discoverability: db.AttestationDiscoverability;
}) {
  if (!attestation.value) {
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'tried to update discoverability for incomplete attestation',
    });
    throw new Error('Attestation not full, cannot update discoverability');
  }
  // optimistic update
  await db.updateAttestation({
    attestation: { ...attestation, discoverability },
  });

  try {
    await api.updateAttestationDiscoverability({
      type: attestation.type,
      value: attestation.value!,
      visibility: discoverability,
    });
    logger.trackEvent(AnalyticsEvent.ActionUpdateAttestDiscoverability, {
      type: attestation.type,
      discoverability,
    });
  } catch (e) {
    // Rollback
    await db.updateAttestation({ attestation });
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to update discoverability',
      severity: AnalyticsSeverity.Critical,
      error: e,
    });
  }
}

export async function discoverContacts(
  phoneNumbers: string[]
): Promise<[string, string][]> {
  const lastSalt = await db.lastLanyardSalt.getValue();
  const lastPhoneNumbers = await db.lastPhoneContactSetRequest.getValue();

  try {
    const { matches, nextSalt } = await api.discoverContacts(
      phoneNumbers,
      lastSalt,
      lastPhoneNumbers
    );

    // always store the phone numbers we just successfully sent, will be used to diff
    // against the next time we send a request
    await db.lastPhoneContactSetRequest.setValue(JSON.stringify(phoneNumbers));
    await db.lastLanyardSalt.setValue(nextSalt);
    return matches;
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorContactMatching, {
      error: e,
      context: 'failed to discover contacts',
    });
    throw e;
  }
}
