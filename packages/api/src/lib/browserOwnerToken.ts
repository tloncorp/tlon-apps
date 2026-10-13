import { Buffer } from 'buffer';
import { hash } from 'fast-sha256';

/** Matches Pioneer's owner domain, independently of its encryption factor and bot key. */
export function deriveBrowserOwnerToken(code: string): string {
  const normalized = code.trim().replace(/^~+/, '');
  if (!normalized) throw new Error('Owner authentication is unavailable.');
  return Buffer.from(
    hash(Buffer.from(`tlon/browser-vault/owner/v1\0${normalized}`, 'utf8'))
  ).toString('base64');
}
