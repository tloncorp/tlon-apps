import * as api from '../api';
import * as db from '../db';
import { createDevLogger } from '../debug';

const logger = createDevLogger('verificationActions', true);

export async function startPhoneVerify(phoneNumber: string) {
  // optimistic update
  const newVerification: db.Verification = {
    type: 'phone',
    value: phoneNumber,
    status: 'waiting',
    visibility: 'discoverable',
  };
  await db.insertVerifications({ verifications: [newVerification] });

  try {
    // use api when ready
    await api.startPhoneVerify(phoneNumber);

    // fake it updating status
    // setTimeout(() => {
    //   db.updateVerification({
    //     verification: {
    //       type: 'phone',
    //       value: phoneNumber,
    //       status: 'pending',
    //     },
    //   });
    // }, 3000);
  } catch (e) {
    logger.trackError('Failed to start phone verification', e);
    // rollback the update
    await db.deleteVerification({ type: 'phone', value: phoneNumber });
  }
}

export async function checkPhoneVerifyOtp(phoneNumber: string, otp: string) {
  try {
    // use api when ready
    await api.checkPhoneVerifyOtp(phoneNumber, otp);

    // fake it updating status
    // setTimeout(() => {
    //   db.updateVerification({
    //     verification: {
    //       type: 'phone',
    //       value: phoneNumber,
    //       status: 'verified',
    //     },
    //   });
    // }, 3000);
  } catch (e) {
    logger.trackError('Failed to check phone verification OTP', e);
  }
}
