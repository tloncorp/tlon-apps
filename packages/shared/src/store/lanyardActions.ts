import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent } from '../domain';
import * as sync from './sync';

const logger = createDevLogger('lanyardActions', true);

export async function initiateTwitterAttestation(handle: string) {
  logger.trackEvent(AnalyticsEvent.ActionInitiateTwitterAttest, { handle });
  await api.initiateTwitterAttestation(handle);
  await sync.syncAttestations();
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

export async function revokeAttestation(attestation: db.Verification) {
  const currentUserId = api.getCurrentUserId();
  logger.trackEvent(AnalyticsEvent.ActionRevokeAttestation, { attestation });

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

  await api.revokeAttestation({ type, value });
  await db.deleteVerification({ type, value });
}

export async function checkAttestedSignature(
  signature: string
): Promise<boolean> {
  // const stubSig = `0w2U.pJmiv.hxEM9.uPnkC.873~M.QjQ71.VCY33.oJCz8.ys~4P.Wlils.-Cfn7.Fg-ZN.QCwVm.bylMo.2n60a.sTlLK.JHQ0O.ZGiLO.06pEp.D1Mq6.hGqD1.Or6VC.rCVOs.69q0e.zaOKX.Eu0pX.cH8Ue.juNJP.uSeyY.0VcHE.WdbKW.nw5AS.0000d.dCwbc.NBN00.00000.00g0X.6NRpL.wehBq.mpFsC.lS~0c.Kc5L5.HY02o.600g1`;
  const isValid = await api.checkAttestedSignature(signature);
  console.log(`checkAttestedSignature`, { signature, isValid });
  return isValid;
}
