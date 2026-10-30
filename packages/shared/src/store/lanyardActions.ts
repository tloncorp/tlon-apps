import * as api from '@tloncorp/api';

import * as db from '../db';
import { createDevLogger } from '../debug';
import { AnalyticsEvent, AnalyticsSeverity } from '../domain';
import { getClientGeneration } from './session';

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
    return true;
  } catch (e) {
    // Rollback
    await db.updateAttestation({ attestation });
    logger.trackEvent(AnalyticsEvent.ErrorAttestation, {
      context: 'failed to update discoverability',
      severity: AnalyticsSeverity.Critical,
      error: e,
    });
    return false;
  }
}

export type ContactsMatchedHandler = (
  contactIds: string[]
) => void | Promise<void>;

let contactsMatchedHandler: ContactsMatchedHandler | null = null;

export function setContactsMatchedHandler(
  handler: ContactsMatchedHandler | null
) {
  contactsMatchedHandler = handler;
}

export async function invokeContactsMatchedHandler(contactIds: string[]) {
  if (!contactsMatchedHandler || contactIds.length === 0) return;
  try {
    await contactsMatchedHandler([...new Set(contactIds)]);
  } catch (e) {
    logger.trackEvent(AnalyticsEvent.ErrorContactMatching, {
      error: e,
      context: 'contactsMatchedHandler',
    });
  }
}

// Older desks cannot enforce the complete discovery intent contract, so they
// retain the conservative profile-based suppression rule.
export function isAlreadyKnownContact(contact: db.Contact): boolean {
  return !!(
    contact.isContact ||
    contact.isContactSuggestion ||
    contact.peerNickname ||
    contact.customNickname ||
    contact.peerAvatarImage ||
    contact.bio ||
    contact.status
  );
}

// Splits raw lanyard matches into "new" (unseen by the user) vs.
// already-known. Under the dev mock, treat every match as new so
// repeated test runs keep surfacing matches even after they've been
// added as contacts in a prior run.
export async function partitionDiscoveryMatches(
  matches: [string, string][],
  { isMocked }: { isMocked: boolean }
): Promise<{
  newMatches: [string, string][];
  removedMatches?: [string, string][];
  contactState?: api.ContactState;
}> {
  if (isMocked) return { newMatches: matches };
  const contactIds = matches.map((m) => m[1]);
  let removedContactIds = new Set<string>();
  let declinedContactIds = new Set<string>();
  let hiddenSuggestionIds = new Set<string>();
  const supportsDecisions = api.getDeskSupportsContactDecisionsState() === true;
  let contactState: api.ContactState | undefined;
  if (supportsDecisions || api.getDeskSupportsContactRemovalState() === true) {
    contactState = await api.getContactState();
    removedContactIds = new Set(contactState.removedContactIds);
    declinedContactIds = new Set(contactState.declinedContactIds ?? []);
    if (supportsDecisions)
      hiddenSuggestionIds = new Set(contactState.hiddenSuggestionIds ?? []);
  }
  const existingContacts = await db.getContactsBatch({ contactIds });
  const existingById = new Map(existingContacts.map((c) => [c.id, c] as const));
  const authoritativeById = new Map(
    contactState?.contacts.map((c) => [c.id, c] as const)
  );
  const removedMatches = matches.filter(([, id]) => removedContactIds.has(id));
  const isKnown = supportsDecisions
    ? (contact: db.Contact) =>
        !!(contact.isContact || contact.isContactSuggestion)
    : isAlreadyKnownContact;
  const newMatches = matches.filter(([, contactId]) => {
    const c = existingById.get(contactId);
    const authoritative = authoritativeById.get(contactId);
    return (
      !removedContactIds.has(contactId) &&
      !declinedContactIds.has(contactId) &&
      !hiddenSuggestionIds.has(contactId) &&
      (!c || !isKnown(c)) &&
      (!authoritative || !isKnown(authoritative))
    );
  });
  const uniqueIds = [...new Set(contactIds)];
  logger.trackEvent('Contact discovery eligibility', {
    matchCount: uniqueIds.length,
    savedCount: uniqueIds.filter(
      (id) =>
        existingById.get(id)?.isContact || authoritativeById.get(id)?.isContact
    ).length,
    suggestedCount: uniqueIds.filter(
      (id) =>
        existingById.get(id)?.isContactSuggestion ||
        authoritativeById.get(id)?.isContactSuggestion
    ).length,
    profileOnlyCount: supportsDecisions
      ? 0
      : uniqueIds.filter((id) => {
          const local = existingById.get(id);
          const authoritative = authoritativeById.get(id);
          return (
            !local?.isContact &&
            !local?.isContactSuggestion &&
            !authoritative?.isContact &&
            !authoritative?.isContactSuggestion &&
            ((!!local && isAlreadyKnownContact(local)) ||
              (!!authoritative && isAlreadyKnownContact(authoritative)))
          );
        }).length,
    eligibleCount: new Set(newMatches.map(([, id]) => id)).size,
    removedCount: new Set(contactIds.filter((id) => removedContactIds.has(id)))
      .size,
    declinedCount: new Set(
      contactIds.filter((id) => declinedContactIds.has(id))
    ).size,
    hiddenCount: new Set(contactIds.filter((id) => hiddenSuggestionIds.has(id)))
      .size,
    completeProtection: supportsDecisions,
  });
  return {
    newMatches,
    removedMatches,
    ...(contactState ? { contactState } : {}),
  };
}

export async function discoverContacts(
  phoneNumbers: string[]
): Promise<[string, string][]> {
  const generation = getClientGeneration();
  const isCurrent = () => generation === getClientGeneration();
  const lastSalt = await db.lastLanyardSalt.getValue();
  const lastPhoneNumbers = await db.lastPhoneContactSetRequest.getValue();
  if (!isCurrent()) return [];

  try {
    const { matches, nextSalt } = await api.discoverContacts(
      phoneNumbers,
      lastSalt,
      lastPhoneNumbers
    );

    if (!isCurrent()) return [];
    // always store the phone numbers we just successfully sent, will be used to diff
    // against the next time we send a request
    await db.lastPhoneContactSetRequest.setValue(JSON.stringify(phoneNumbers));
    if (!isCurrent()) return [];
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
