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

`docs/feature-map/` is what Tlonbot tells people about the app. It describes one store build, named in `docs/feature-map/release.json`, and is updated once per build. CI checks that every label an entry quotes is in that build's source. It cannot see behaviour, so that part is for review.

-   App changes on develop do not need a map edit. Do not ask for one.
-   In a PR that changes the map, read each changed entry against the source at the store build's commit, using the files in its `<!-- src: … -->` line, not against develop. Flag an entry that describes something only develop has.
-   A PR that changes `release.json` moves the map to a new store build. Also check the entries that `node scripts/feature-map.mjs affected --since <old commit> --until <new tag>` lists: their code changed between the two builds, whether or not their text did.
-   Files under `packages/openclaw/skills/tlon-product-guide/references/` are written by `publish`. Flag a hand edit there.

## Style Rules

-   Scope stays tight to the PR goal; remove non-essential churn.
-   New code does not duplicate existing logic or patterns.
-   Control and data flow are easy to follow; comments explain only non-obvious behavior.
-   Prefer existing single-source logic over parallel implementations.
-   Keep code and comments concise; avoid explanatory noise.
-   When reusing complex Tamagui style combinations, extract them with `styled()` rather than repeating inline style props.

## Skip

-   Style nits not covered by the rules above.
