# Code Review Guidelines

## Always Check

-   Shared component/default changes: verify all consumers handle the new shape (grep callsites + confirm `pnpm -r tsc` still passes).
-   SSE subscription paths are idempotent without cross-wire ordering assumptions.
-   Retries and duplicate deliveries cannot double-apply state. Optimistic mutations have matching rollback paths.
-   Pending/request cleanup paths are deterministic.
-   Added network/sync/render/disk work is justified in the PR description or an inline comment.
-   UI changes avoid large or frequent re-renders where possible; unavoidable render cost is justified in the PR description or an inline comment.
-   Platform-conditional code (`Platform.OS` guards, `.native.tsx`/`.web.tsx` splits) works on all active platforms. Removing a platform-specific file requires verifying the replacement covers that platform.
-   User-facing flow changes include E2E coverage updates or an explicit reason E2E changes are not required.
-   User-facing error paths for the same operation produce consistent feedback (e.g. don't Alert in one path and silently drop in another).
-   Error states are handled explicitly (shown, logged, and recoverable), not silently swallowed.
-   Native dependency changes (new packages, version bumps) include a regenerated Android Gradle lockfile.

## Feature Map

`docs/feature-map/` is what Tlonbot tells people about the app. CI checks that every label an entry quotes is still in the code. It cannot see a behaviour change behind an unchanged label, so that part is for review.

-   When a PR changes a file that an entry cites in its `<!-- src: … -->` line, read that entry against the diff. Flag it if the PR changes who can do the thing, where it is found, or what happens afterwards, and the entry was not updated. `node scripts/feature-map.mjs affected --since <base>` lists the entries; the Feature Map job prints the same list in its summary.
-   A new button, menu item or setting with no new screen, message action, feature flag or slash command needs an entry. CI will not ask for one.
-   PRs from `release/feature-map-*` publish the map to bots. Their description lists entries whose code changed between two releases but whose text did not. Read those against `git diff <previous> <release>` for the files they cite, not just the lines the PR changes.
-   Files under `packages/openclaw/skills/tlon-product-guide/references/` are generated. Flag a hand edit there; do not review their wording outside a release PR.

## Style Rules

-   Scope stays tight to the PR goal; remove non-essential churn.
-   New code does not duplicate existing logic or patterns.
-   Control and data flow are easy to follow; comments explain only non-obvious behavior.
-   Prefer existing single-source logic over parallel implementations.
-   Keep code and comments concise; avoid explanatory noise.
-   When reusing complex Tamagui style combinations, extract them with `styled()` rather than repeating inline style props.

## Skip

-   Style nits not covered by the rules above.
