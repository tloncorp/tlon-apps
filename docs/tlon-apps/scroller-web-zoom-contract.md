# Control-wheel ownership correction

Prepared outside the checkout during source freeze. No tests or browser run yet.

- Control-modified vertical wheel in either direction does not revoke current FOLLOW or a captured send validator. Existing viewport/content reconciliation remains responsible for zoom-driven layout.
- Ordinary trusted, unprevented vertical wheel still revokes a captured send validator immediately and preserves current directional intent policy.
- Zero vertical, untrusted and already-prevented wheel input do not revoke intent. Grid now uses the same predicate as the ordinary list.
- Existing keyboard/editable handling stays unchanged and its controls must still pass.
- These are owner/classifier controls, not evidence of actual browser zoom, physical presentation, or gesture smoothness.

Planned focused validation after root release: webReadingAnchor.test.ts and webScrollCoordinator.test.ts, plus scoped formatting. No actual capture needed to claim the bounded classification correction.

This contract was first saved in the corresponding `/private/tmp` review folder
before its red/green controls ran, and subsequently retained here.
