// The oldest %groups desk this client supports: by policy, the previous desk
// release (docs/tlon-apps/desk-compatibility.md). Ships below it get the
// desk-outdated notice instead of an empty home.
//
// This constant RECORDS the floor. It is NOT the lever for shipping a new desk
// dependency: a client change needing something only the current desk serves
// waits for that desk to become N-1, or carries a fallback tested against N-1.
// Raise it only as part of a release, once the desk release it names has
// shipped and `pnpm check:desk-compat` passes — and re-pin the ~bus pier in the
// same change (apps/tlon-web/e2e/shipManifest.json).
export const MIN_GROUPS_VERSION = '12.2.0';
