import { createDevLogger } from '../debug';

const logger = createDevLogger('lanyardActions', true);

export function startPhoneVerify(phoneNumber: string) {
  logger.log(`starting phone verification`, phoneNumber);
}
