/** Blob types onboarding reads from owner posts; only the Tlon app sends them. */
export const RESERVED_ONBOARDING_BLOB_TYPES: ReadonlySet<string> = new Set([
  'tlon-agent-intro-request',
  'tlon-agent-provider-config',
  'tlon-agent-provision',
]);
