let sequence = 0

// Correlation IDs, not credentials. LAN HTTP pages do not expose randomUUID,
// but getRandomValues is available even outside a secure context.
export function clientId(crypto = globalThis.crypto) {
  if (crypto?.randomUUID) return crypto.randomUUID()
  if (crypto?.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(16))
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  return `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`
}
