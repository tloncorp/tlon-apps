import { signWithIdentity } from './crypto';
import { signalStore } from './store';
import type { AuthType, PasskeyIdentity } from './types';

/**
 * Shared auth finalization: signs SPK, persists keys to store.
 * The caller is responsible for saving to ship (via signalApi) afterward.
 */
export function finalizeAuth(
  passkey: PasskeyIdentity,
  authType: AuthType
): void {
  const spk = {
    key: passkey.prekey.public,
    signature: signWithIdentity(passkey.identity, passkey.prekey.public),
  };

  signalStore.unlock(passkey);
  signalStore.setAuthType(authType);
  signalStore.setSpk(spk);
}
