import { daToUnix, parseDa } from '@urbit/aura';

import * as db from '../db';
import { createDevLogger } from '../debug';
import * as ub from '../urbit';
import { poke, scry } from './urbit';

const logger = createDevLogger('lanyardApi', true);

export async function getVerifications(): Promise<db.Verification[]> {
  logger.log(`getting verifications`);
  const records = await scry<ub.LanyardRecords>({
    app: 'lanyard',
    path: '/records/json',
  });

  logger.log('lanyard/records scry result', records);

  const verifications = records
    .filter((r) => !ub.isDummyRecord(r))
    .map(lanyardRecordToVerification)
    .filter(Boolean) as db.Verification[];

  logger.log('parsed verifications', verifications);

  return verifications;
}

export function startPhoneVerify(phoneNumber: string) {
  logger.log(`starting phone verification`, phoneNumber);

  const command: ub.LanyardCommand = {
    host: null,
    command: {
      start: {
        id: { phone: phoneNumber },
      },
    },
  };

  logger.log(`sending start command`, command);

  return poke({
    app: 'lanyard',
    mark: 'json',
    json: command,
  });
}

export function checkPhoneVerifyOtp(phoneNumber: string, otp: string) {
  logger.log(`sending phone verification OTP`, otp);

  const command: ub.LanyardCommand = {
    host: null,
    command: {
      work: {
        id: { phone: phoneNumber },
        work: { phone: { otp } },
      },
    },
  };

  logger.log(`sending work command`, command);

  return poke({
    app: 'lanyard',
    mark: 'json',
    json: command,
  });
}

// parsers
function lanyardRecordToVerification(
  record: ub.LanyardRecord
): db.Verification | null {
  if (ub.isDummyRecord(record)) {
    return null;
  }

  return {
    type: ub.isPhoneRecord(record) ? 'phone' : 'node',
    value: ub.isPhoneRecord(record)
      ? record.identifier.phone
      : record.identifier.urbit,
    initiatedAt: Date.now(), //  TODO: update once backend supports
    status: parseLanyardStatus(record.record.status),
    visibility: parseLanyardConfig(record.record.config),
  };
}

function parseLanyardStatus(
  status: ub.LanyardRecordStatus
): db.VerificationStatus {
  switch (status) {
    case 'done':
      return 'verified';
    case 'wait':
      return 'pending';
    case 'want':
      return 'waiting';
  }
}

function parseLanyardConfig(
  config: ub.LanyardRecordConfig
): db.VerificationVisibility {
  switch (config) {
    case 'public':
      return 'public';
    case 'hidden':
      return 'hidden';
    case 'verified':
      return 'discoverable';
  }
}
