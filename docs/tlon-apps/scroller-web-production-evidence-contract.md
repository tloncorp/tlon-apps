# Production web asset evidence

Saved before production-provenance controls or execution. This adds build identity
to the existing desktop reading and concurrent-image cases; it does not add a
new scroller behavior, native coverage or presented-frame proof. Existing
captures remain explicitly Vite development evidence.

| Situation | Required evidence |
| --- | --- |
| Build creation | A dedicated command snapshots the relevant tracked and untracked workspace inputs, runs the current `tlon-web` `build` script, and snapshots them again. Exit zero and identical source manifests are required. Record Git HEAD, the exact build command, package-script hash, build times and every output file's SHA-256/length. Refuse a nonempty output directory |
| Before capture | Recompute current source and output manifests against the receipt. A changed source, build script or output file disqualifies this receipt; an environment flag alone is insufficient |
| Actual browser load | Attach response observers before reloading the actual authenticated application. Hash bodies obtained from those browser responses, including the document and loaded build assets. Independently match their URL paths, lengths and SHA-256 to the receipt. A fresh HTTP refetch is not a substitute for the browser response |
| Runtime inventory | Inspect actual DOM script URLs and performance resource entries through the end of the scenario. Reject Vite client/preamble, `/@fs/`, `/@id/`, source-module or node_modules URLs. Require the loaded executable/style resources to have matching captured responses and require at least one hashed bundled JavaScript asset |
| Attempt and scope | The observation starts and ends inside its enclosing Playwright attempt. Final origin/scope and performance-clock coverage must agree with the content evidence. Build completion precedes observation; receipt digest and source/build-script links are replayed independently |
| Historical development data | Development captures keep their existing classification and require no new receipt. A production label with absent or corrupt provenance is INCOMPLETE; independently witnessed scroller failures remain failures |

Response-body hashes are observations made by the test collector and are checked
against the independently recorded build outputs. This is provenance for the
served resources and current checkout, not cryptographic attestation that a CPU
executed every byte or proof of physical display presentation. Cache and service
worker delivery are recorded; matching bytes may be reused. No account or
service-worker settings are changed for this check.

Controls must reject an altered bundle, receipt digest, source digest, build
script, output path, stale attempt, missing response, missing runtime inventory,
wrong scope, or injected development URL. Healthy controls require a complete
receipt and observed document plus bundle; development compatibility remains
separate. The production run uses an isolated output directory and the existing
Vite preview proxy to the already running local test ship. Building and switching
servers occur only in the root-assigned execution window.

The source snapshot also verifies canonical `@tloncorp/ui`, `app`, `api` and
`shared` workspace links; a stale link into another checkout cannot qualify.
Ignored `.env*` inputs are hashed, with build-time VITE/TAMAGUI/ship/runtime
environment inputs retained as hashes rather than disclosing their values.

Root-controlled commands after all source edits are frozen:

```sh
node scripts/scroll-stability-web-assets.mjs --build --root /Users/danielbrewster/Projects/landscape-apps --output /private/tmp/scroller-web-production-DIST --receipt /private/tmp/scroller-web-production-RECEIPT.json
```

Use fresh absolute DIST/RECEIPT paths. This command performs the build itself and
writes no success receipt on a failed build or source change. Then serve that
same output from `apps/tlon-web` with the existing proxy:

```sh
SHIP_URL=http://localhost:35453 corepack pnpm serve --outDir /private/tmp/scroller-web-production-DIST --port 3000 --host localhost --strictPort
```

Run either existing reading/concurrent config with
`USE_PRODUCTION_BUILD=true` and
`SCROLLER_WEB_BUILD_RECEIPT=/private/tmp/scroller-web-production-RECEIPT.json`.
The collector checks the current files, observes an authenticated reload before
scenario preparation, and leaves normal application flags intact. Production
provenance is embedded as `preparation.assetProof` for concurrent captures and
attached as `production-reading-image-{position}-asset-proof` for the rich-text
reading pair. Both import paths independently replay it using the enclosing
Playwright attempt times. Missing provenance never upgrades a production label.

The installed Urbit Vite plugin injects two required ship-provided bootstrap
scripts: `/apps/groups/desk.js` and `/session.js`. Their actual same-origin
browser response hashes are recorded separately in the observation, but cannot
be compared to compiled output files. This exception is restricted to those two
exact URLs, both must be observed, and it does not permit other unbuilt scripts.
Their backend source is not attested by the web build receipt. Actual application
ship/scope checks remain required by the scenario. Decorative ship assets and
manifest metadata are not promoted to executable bundle identity.

The first built run exposed two harness preconditions, recorded before corrected
controls or recapture. Installed Playwright reports timeout-slot elapsed time in
`duration`, which can omit wall time spent outside those slots. New reports retain
the original duration and add an `onTestEnd` wall-clock observation, bound to the
exact test ID, retry and start time. This reporter observation is an upper bound
on attempt completion, not a browser-frame timestamp. Replay rejects duplicate,
malformed or mismatched clock records and any asset observation beyond that
bound. Historical reports without it retain their conservative duration-derived
bound; the original 133 ms boundary failure remains incomplete.

After the authenticated reload, setup reads the actual persisted developer-tools
visibility setting and closes an open tool through the application's existing
toggle hook, then verifies both the setting and mounted overlay are absent.
Already-hidden tools must not be toggled open. This changes only test setup; no
production DOM is removed, no acceptance tolerance changes, and no capture starts
while the tool can intercept a message action. Controls cover visible/hidden
settings, a missing hook, malformed state and inconsistent mounted state.
