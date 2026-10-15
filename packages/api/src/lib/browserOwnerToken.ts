import { Buffer } from 'buffer';
import { hmac } from 'fast-sha256';

/** Owner proofs expire ten minutes after issuance. */
export function deriveBrowserOwnerToken(
  code: string,
  now = Date.now()
): string {
  const normalized = code.trim().replace(/^~+/, '');
  if (!normalized) throw new Error('Owner authentication is unavailable.');
  const expires = Math.floor(now / 1000) + 600;
  const signature = hmac(
    Buffer.from(normalized, 'utf8'),
    Buffer.from(`tlon/browser-vault/owner/v1\0${expires}`, 'utf8')
  );
  return `${expires}.${Buffer.from(signature).toString('base64')}`;
}
