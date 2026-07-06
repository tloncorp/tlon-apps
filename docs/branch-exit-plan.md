# branch exit: implementation guide

**Goal:** serve invite links from our own infrastructure on `join.tlon.io`, remove Branch in stages with zero regression for shipped binaries, replace its probabilistic matching with a first-party matcher validated in shadow mode.

**Repos:** `tloncorp/landscape-apps` (this repo) · `tloncorp/serverless-infra` (Vercel invite service — `git pull` first, local clones may be stale; it also hosts unrelated services [gemini/LLM, Linear webhook, PostHog cohorts, Mailchimp, Twilio] — do not touch them).

**Task labels:** `[CODEX]` agent-implementable · `[HUMAN]` DNS / dashboards / physical devices / petitions · `[CODEX←HUMAN]` parameterized on a test result.

---

## 0. Ground rules (hard requirements, apply everywhere)

1. `join.tlon.io` links must never break. The domain keeps serving legacy tokens indefinitely.
2. **No Branch JS on any page we host.** No third-party scripts at all on invite pages.
3. **Invite pages are stateless**: no `Set-Cookie`, no localStorage/sessionStorage, self-hosted assets only. (Keeps the page immune to bounce-tracking mitigations and outside EU consent-banner obligations.)
4. AASA/assetlinks must be served by us from the minute DNS flips — existing installs' universal links depend on it.
5. The invite domain never proxies or hosts tracker-endpoint traffic (that is how first-party domains end up on filter lists).
6. The Branch account, dashboard config, and link minting stay alive until gate B′ (old binaries depend on them).
7. All recovery sources set the lure identically — `ip_match` included (parity with today, where Branch's probabilistic matches behave exactly like deterministic ones). False-positive protection is server-side: `/deferred-match` returns a match only when the in-window candidate is unique.
8. Every recovered token is tagged with its source: `universal_link | install_referrer | clipboard | paste_button | ip_match | shortcode | manual_url | default`.

---

## 1. Architecture specs

### 1.1 Token recovery cascade (client end state — what P2.1/P3.1 build)

```text
 app launch
     │
     ▼
 1. URL from OS?  (universal link / app link / custom scheme · expo-linking)
     │ token ────────────────────────────────────▶ set lure  [source: universal_link]
     │ none
     ▼
 2. Play install referrer  (Android, first run · expo-application)
     │ token ────────────────────────────────────▶ set lure  [source: install_referrer]
     │ none / iOS
     ▼
 3. clipboard  (first run · hasUrlAsync gate → getUrlAsync · iOS paste prompt, same as today)
     │ token ────────────────────────────────────▶ set lure  [source: clipboard]
     │ empty / denied
     ▼
 4. first-party IP matcher  (POST /deferred-match)
     │ unique hit ─────────────────────────────────▶ set lure  [source: ip_match]
     │ miss / ambiguous (server refuses non-unique candidates)
     ▼
 5. manual fallbacks  (PasteInviteLinkScreen / shortcode / ClipboardPasteButton)
     │ token ────────────────────────────────────▶ set lure  [source: shortcode | paste_button | manual_url]
     │ none
     ▼
 DEFAULT_LURE → generic onboarding

 every "set lure" feeds the unchanged existing flow:
 storage.invitation → useSignupParams → signUpHostedUser(inviteId) / redeemInviteIfNeeded
```

Parser rules (shared by steps 1/2/3/5): accepts `https://(join|invite).tlon.io/<token>` and the app's `app.link` domain; token shapes `0v…` (single segment) and legacy `~ship/name` (multi-segment) produce lures; `dm-<ship>` aliases produce a `wer`-style deep link path (`dm/~ship`) feeding `deepLinkPath`, not a lure.

### 1.2 Invite page behavior (server spec — what P0.1 builds)

```text
 user taps https://join.tlon.io/<token>  (app NOT installed; installed users bypass
 the page entirely via universal link / app link)

  1. browser → page     GET /<token>
  2. page → bait        fetch invite metadata (title, image, group preview)
  3. page → KV          log {hmac(ip), device_class, os_major, token, ts}  TTL ~4h
  4. page → browser     render OG preview + CTA
                        (stateless: no cookies, no storage, no third-party JS)
  5. user taps CTA      — user gesture, required for clipboard write —
       iOS:             JS writes CLIPBOARD_PAYLOAD(token), then → App Store
       Android:         → Play Store URL with referrer=REFERRER_PAYLOAD(token)
       desktop:         → link's $desktop_url if known, else https://tlon.network/lure/<token>
  6. install → first open
  7. app runs the recovery cascade (1.1)
       on cascade miss: POST /deferred-match → KV lookup by hmac(ip) → token | null
```

### 1.3 Schedule: parallel tracks and gates

```text
            week 1              week 2             weeks 3–6          ~weeks 5–7      adoption-gated
 ─────────────────────────────────────────────────────────────────────────────────────────────────────
 TRACK A    page + AASA +       staging smoke →    delisting          propagation
 server     matcher KV/         ▲ DNS FLIP         petitions filed;   watch (gate C)
 (no rel.)  endpoints           (gate A)           payload tuning
                                                   from T1/T2

 TRACK B    telemetry diff +    cascade + shadow   shadow data        gate B clears
 client     token parser        matcher → OTA      accumulates        (per-OS, on the
 (OTA)      OTA'd wk 1          ship               (sample-count      P2 binary)
            (gate A)                               gate B)

 TRACK C    (development        entitlements +     rides next         P3.1:             P3.2/3.3:
 client     alongside           dual-domain        scheduled binary   SDK-removal       mint switch +
 (binary)   Track B)            regexes merged     (blocks only 2.5)  binary + matcher  account closure
                                                                      promoted          (gate B′)

 TRACK D    T1 capture (½h,     flip-day           30/60/90-day
 human      pre-flip) · T1/T2   smoke + AASA       list checks
            device runs         verification
```

**Gates**

- **A (DNS flip):** AASA/assetlinks verified on the production service · P0.3 telemetry + P0.4 token parser live via OTA · installed-app smoke passes (tap a `join.tlon.io` link on a device with the app installed → invite arrives) · staging smoke passes · T1 capture step done. (Full T1/T2 results tune server config post-flip; defaults are safe.)
- **B (SDK-removal binary):** P2.3 binary (embedded cascade) published to stores · shadow `only_branch = 0` **per OS** across ≥30 first-open deferred recoveries on that binary, OR 4 weeks of its shadow data · backstop: second binary release after Phase 2. (Pre-binary OTA shadow data is directionally conservative — fresh installs run the embedded bundle on first launch, so OTA-only recovery executes late; referrer survives, clipboard may decay.)
- **B′ (decommission + mint switch):** pre-Phase-2 binaries <10% of active installs.
- **C (optional domain flip):** delisting propagation stalled after 60–90 days AND Phase 2 build dominant (>80–90% of active installs).

**Held lines:** AASA before flip, always · petitions only after flip · `/deferred-match` never returns ambiguous candidates · Branch account alive until B′.

---

## 2. Master checklist

- [ ] P0.1 `[CODEX]` serverless-infra: invite page + well-knowns + KV click log
- [ ] P0.2 `[HUMAN]` device tests T1 (pasteboard) + T2 (referrer)
- [ ] P0.3 `[CODEX]` telemetry diff in branch.tsx → OTA immediately
- [ ] P0.4 `[CODEX]` Branch-independent universal-link parser (expo-linking + non_branch_link) → OTA (gate A requirement)
- [ ] P0.5 `[HUMAN]` invite.tlon.io DNS + categorization warm-up
- [ ] P0.6 `[HUMAN, optional]` canary domain-divorce experiment
- [ ] P1.1 `[HUMAN]` preconditions check (gate A)
- [ ] P1.2 `[HUMAN]` DNS flip + smoke + rollback readiness
- [ ] P1.3 `[HUMAN]` delisting petitions (AdGuard → EasyPrivacy) + list watch
- [ ] P2.1 `[CODEX]` deferred-source cascade module (shadow mode) → OTA
- [ ] P2.2 `[CODEX]` matcher: app call (log-only) + serverless `/deferred-match`
- [ ] P2.3 `[CODEX]` flip groundwork: entitlements, intent filter, dual-domain regexes (binary)
- [ ] P2.4 `[CODEX, optional]` ClipboardPasteButton onboarding affordance
- [ ] P2.5 `[CODEX]` tests: parser units, e2e domain updates
- [ ] P2.5x `[CODEX←gate C]` optional mint-domain flip to invite.tlon.io
- [ ] P3.1 `[CODEX←gate B]` SDK removal + DeepLinkProvider rewrite + matcher promotion (binary)
- [ ] P3.2 `[CODEX←gate B′]` serverless + desk teardown, mint switch
- [ ] P3.3 `[HUMAN←gate B′]` Branch account closure + DNS hygiene audit
- [ ] P3.4 `[CODEX]` cleanup pass

---

## 3. Code inventory

### landscape-apps

| Concern | Location |
|---|---|
| Domain env default | `packages/app/lib/envVars.ts:77` (`BRANCH_DOMAIN`, fallback `join.tlon.io`), `envVars.native.ts:69`, `apps/tlon-mobile/app.config.ts:58` |
| Branch client context | `packages/app/contexts/branch.tsx` — subscribe :93, `+non_branch_link` handling :95–127, `Detected Branch Link Click` :136, deterministic gate :143–151, lure set :154–174, `setLure` :214, saved-lure restore :196 |
| Lure → signup attribution | `apps/tlon-mobile/src/screens/Onboarding/CheckOTPScreen.tsx:90–115` (`signUpHostedUser` with `inviteId`/`priorityToken`), `useDeepLinkListener.ts`, `WelcomeScreen.tsx:41` |
| Manual paste path | `apps/tlon-mobile/src/screens/Onboarding/PasteInviteLinkScreen.tsx` (tracking :108, placeholder copy :170), `packages/api/src/client/deeplinks.ts:210` (`checkInviteShortcode`) |
| Token metadata fetch (bait) | `packages/api/src/client/deeplinks.ts:66–130` — `GET ${INVITE_PROVIDER}/lure/<token>/metadata`; Branch enrichment fallback :132–150 |
| Link regexes | `packages/api/src/client/deeplinks.ts:162` (`createInviteLinkRegex`), `packages/app/ui/components/MessageInput/index.tsx:444` (`DEEPLINK_REGEX`) |
| Branch REST client | `packages/api/src/client/branch.ts` (api2.branch.io helpers; `createDeepLink` :165; `checkInviteServiceLinkExists` :253) |
| Native link config | `apps/tlon-mobile/ios/Landscape/Landscape.entitlements:10` (`applinks:join.tlon.io`), `Info.plist:107`, `android/app/src/main/AndroidManifest.xml:65` |
| Hoon-side | `desk/app/profile/widgets.hoon:44` (`dm-` links), `desk/ted/branch-update.hoon:7–8` (api2.branch.io updater) |
| Analytics | `packages/api/src/types/analytics.ts:142` (`'Installed with Deferred Deeplink Invite'`), `packages/app/utils/posthog.ts:83` (`'Onboarding Action'`), `DEFAULT_LURE` `packages/app/lib/envVars.ts:55` (`~nibset-napwyn/tlon`) |
| CI secrets | `.github/workflows/{deploy,deploy-canary,build-and-glob,mobile-update}.yml` (`BRANCH_KEY_*`, `VITE_BRANCH_*`, `INVITE_SERVICE_ENDPOINT`) |
| Misc hardcodes | `SplashSequence.tsx:2684`, `fixtures/SplashSequence.fixture.tsx:74`, `apps/tlon-web/e2e/invite-service.spec.ts:53`, `.maestro/03-signup.yaml` |

### serverless-infra (origin/main)

| Concern | Location |
|---|---|
| Link mint | `api/inviteLink.ts` → `lib/branchApi.ts` `upsertInviteLink` (get-or-create by alias, `api2.branch.io/v1/url`; OG copy templates `lib/branchApi.ts:126–167`; env `BRANCH_DOMAIN`/`BRANCH_KEY` + `TEST_*`) |
| Mint payload contract | `lib/types.ts` `DeepLinkData` (`$desktop_url`, `$canonical_url`, `lure`/`wer`, full invite metadata) — client side `createDeepLink` `packages/api/src/client/branch.ts:165` |
| Branch click webhook → PostHog | `api/branchClicks.ts` emits `Invite Link Click` (geo/platform/os/browser; `?short-redirect` → `fromShortcode`) |
| Link existence check | `api/checkLink.ts` (via Branch) ← `checkInviteServiceLinkExists` |
| Shortcodes (Branch-free) | `api/checkInviteShortcode.ts` + static map `lib/shortcodes.ts` — no changes any phase |
| Infra | posthog-node + `lib/logger.ts` available for page events · no KV dependency yet · `vercel.json` has cron + CORS headers (merge rewrites in, don't replace) |

### PostHog events reference

| Event | Emitted | Meaning |
|---|---|---|
| `Detected Branch Link Click` | `branch.tsx:136` | any `+clicked_branch_link` open; `inviteId` null when no parseable lure. P0.3 adds `matchGuaranteed`, `isFirstSession` |
| `Installed with Deferred Deeplink Invite` | `branch.tsx:147` | deterministic deferred by construction (`+match_guaranteed && +is_first_session`) |
| `Onboarding Action` | `posthog.ts:83` | `actionName='Account Created'` carries `lure` (recovered token or `~nibset-napwyn/tlon`); `'Invite Link Added'` fires from BOTH WelcomeScreen (any lure) and paste screen (only the latter sets `fromShortcode`) |
| `Invite Link Click` | serverless webhook | Branch click-side analytics — page events must keep property parity |
| `Invite Page View` / `Invite Page CTA Click` (new, P0.1) | page render / CTA beacon | correlated by `pageViewId`; supersede the Branch webhook post-flip |
| `Detected Branch-Independent Invite Link` (new, P0.4) | `handleInviteUrl` in branch.tsx | fires per intake with `source: expo_linking \| non_branch_link` — measures the expo-linking listener's interim coverage per OS |
| `Deferred Invite Recovery` (new, P2.1) | cascade module | `{source, token, branchAgreed: same\|only_ours\|only_branch\|neither}` — feeds gate B |
| Saved insight | [eu.posthog.com/project/7233/insights/4G2SLfbF](https://eu.posthog.com/project/7233/insights/4G2SLfbF) | attribution by recovery path, rolling 90d |

---

## Phase 0 — page + groundwork (no app release)

### P0.1 [CODEX · serverless-infra] invite page service
Host-agnostic handler for `GET /:token+` over config `SERVED_DOMAINS = ['join.tlon.io', 'invite.tlon.io']`, deployed in the existing serverless-infra Vercel project (same deployment as `INVITE_SERVICE_ENDPOINT`; attach domains there).

- **Routing**: `vercel.json` rewrites `/:token*` → page function, excluding `/api/*` and `/.well-known/*`. Merge into the existing cron + CORS config.
- **Token shapes**: `0v…` single segment; legacy multi-segment `~ship/name` (join full path as the token); `dm-~ship` alias → generic "DM this person" landing (no bait metadata exists).
- **Metadata**: `GET https://loshut-lonreg.tlon.network/lure/<token>/metadata` (shape: `ProviderMetadataResponse.fields` — see `deeplinks.ts:38–51`). Compose OG title/description like `lib/branchApi.ts:126–167` (reuse copy + `OPEN_GRAPH_IMAGE_URL`). `invitedGroupDeleted: true` → "group no longer exists" page. Unknown token → branded fallback (no 404). Brief server-side caching only (be gentle on ~loshut-lonreg); never client storage. **Degradation**: metadata fetch failure ≠ unknown token — on bait error/timeout, render the generic invite page with a fully working CTA (clipboard/referrer need no metadata) and serve stale-from-cache when available; an ~loshut outage must not break invite onboarding.
- **CTA routing** (user gesture — required for clipboard):
  - iOS UA: `navigator.clipboard.writeText(CLIPBOARD_PAYLOAD(token))` → `location = APP_STORE_URL`.
  - Android UA: `location = 'https://play.google.com/store/apps/details?id=<APP_ID>&referrer=' + encodeURIComponent(REFERRER_PAYLOAD(token))`.
  - Desktop: link's `$desktop_url` if known, else `https://tlon.network/lure/<token>`.
  - `CLIPBOARD_PAYLOAD` / `REFERRER_PAYLOAD` are config templates (finalized by T1/T2; safe defaults: plain `https://join.tlon.io/<token>` clipboard, raw-token referrer). DISCOVER the app's default `app.link` subdomain from the Branch dashboard for the clipboard payload option.
- **Statelessness**: per ground rule 3. No third-party requests at all.
- **Matcher click log**: on **CTA tap** (beacon before the store redirect — never on render: link-preview fetchers and accidental opens would pollute the uniqueness constraint and suppress real matches), write to Vercel KV/Upstash (add the dependency): `{key: hmac_sha256(SECRET, normalized_ip), device_class: iphone|ipad|android_phone|android_tablet, os_major, token, ts}`, TTL 4h. Normalize before hashing: IPv4 exact; IPv6 → /64 prefix (privacy extensions rotate the low bits). Never store raw IP.
- **Analytics**: server-side PostHog via existing `lib/logger.ts`, as **two immutable events** correlated by a per-request `pageViewId` (UUID held in page JS memory only — no client storage): `Invite Page View {token, platform, pageViewId, analyticsSource: 'page'}` at render, and `Invite Page CTA Click {token, platform, pageViewId}` from the CTA beacon (the same beacon that writes the matcher KV). Property parity with `api/branchClicks.ts` (geo/platform/os/browser) including `?short-redirect=<code>` → `fromShortcode`.
- **Well-knowns on every served domain**: `/.well-known/apple-app-site-association` (appID `<TEAMID>.io.tlon.groups` — DISCOVER team ID + any preview/debug bundle ids from the iOS project) and `/.well-known/assetlinks.json` (package + SHA-256 signing certs — DISCOVER from Play console). `Content-Type: application/json`, no redirect, no auth.

**Acceptance**: staging deploy; AASA passes Apple CDN validator; assetlinks passes `adb shell pm verify-app-links`; plus a minimal vitest harness in serverless-infra (the repo has none) covering: every token shape (0v, multi-segment, dm-, unknown), UA routing, the zero-cookie invariant, no third-party requests, and the bait-down degradation case — so this acceptance is runnable, not manual curl checks.

### P0.2 [HUMAN] device tests T1/T2 (~1 day; physical devices; Branch Liveview open; temporarily log full `params` at `branch.tsx:94`)

- **T1 — pasteboard contract**: (a) iPhone without app: tap a production `join.tlon.io` link, tap Branch's CTA, paste into Notes → record exactly what their page writes. (b) Delete app, copy that string from Notes, install dev build, first open → expect `+clicked_branch_link: true, +match_guaranteed: true` + lure params. (c) Repeat with plain `join.tlon.io/<token>` and with the `app.link` URL. **Output → `CLIPBOARD_PAYLOAD`.**
- **T2 — referrer format**: Android, app deleted, clean clipboard; install via Play internal-testing from URLs carrying (separately): (i) `referrer=<raw token>`, (ii) `referrer=link_click_id%3D<id from Liveview>`, (iii) `referrer=<urlencoded link URL>`. Record which the shipped binary resolves deterministically. **Output → `REFERRER_PAYLOAD`** + urgency of P2.1's first-party referrer read for old binaries.
- **Not flip-blocking**: only T1(a) must precede the flip (needs Branch's page reachable — `app.link` URL works even after). Payloads are server config; tune post-flip same-day.

### P0.3 [CODEX · landscape-apps] telemetry diff (ship via OTA immediately)
In the `+clicked_branch_link` block (`branch.tsx:136`):

```ts
logger.trackEvent('Detected Branch Link Click', {
  inviteId: lureId,
  matchGuaranteed: params?.['+match_guaranteed'] === true,
  isFirstSession: params?.['+is_first_session'] === true,
});
```

**Acceptance**: both props visible in PostHog; no behavior change; update saved insight [4G2SLfbF](https://eu.posthog.com/project/7233/insights/4G2SLfbF) to split bucket 2 on the new props (`2a · probabilistic` / `2b · reinstall or other`; pre-telemetry events fall into `2 · unsplit`).

### P0.4 [CODEX · landscape-apps] Branch-independent universal-link parser (ship via OTA before the flip; gate A requirement)
Two parallel intake paths feeding one shared, **idempotent** handler (both paths may observe the same URL — dedup on token):

1. **expo-linking path (Branch-independent)**: `Linking.getInitialURL()` + `addEventListener('url')` in the provider. Caveat: while the Branch SDK is installed, its AppDelegate integration may consume universal links before RN's `Linking` sees them (platform/wiring dependent) — the acceptance test measures actual interim coverage per OS. Harmless if dormant; becomes cascade step 1 in P2.1/P3.1.
2. **`+non_branch_link` path**: extend `branch.tsx:95–127` for URLs the SDK delivers but doesn't resolve.

Shared handler: host ∈ invite-domain list (`join.tlon.io`, `invite.tlon.io`, the app's `app.link` domain) → parse per 1.1 →
- **lure token** → `getMetadataFromInviteToken(token)` (`deeplinks.ts:66`, bait-backed — same path the paste screen uses) → `setLure(appInvite)` (persists `storage.invitation`), `source: 'universal_link'`.
- **metadata fetch fails** (bait down, deleted group) → intentionally store an **id-only invite** (`{ id: token, shouldAutoJoin: !isAuthenticated }`): attribution and hosted auto-join key off the id; preview UX degrades to generic. Never drop the token.
- **`dm-<ship>` alias** → `deepLinkPath` (`wer`-style), no lure.

Why pre-flip: installed-app opens should keep resolving through Branch post-flip (their SDK matches URL strings against dashboard config, not DNS), but their domain-revalidation behavior is unverifiable — this makes installed-app invite opens Branch-independent before anything changes. OTA coverage of the *installed* base is fast (this path only matters for users who already have the app).

**Acceptance**: unit tests for all token shapes + dedup; on a device with the OTA applied, tapping a `join.tlon.io/<token>` link with Branch resolution artificially failing (block api2.branch.io via local DNS, or a token minted outside Branch) still produces the lure — and **record which intake path fired, per OS** (determines the expo-linking listener's interim coverage).

### P0.5 [HUMAN] warm invite.tlon.io
DNS → the P0.1 service now (serves both hosts). Submit categorization to Cisco Umbrella/Talos, McAfee/Trellix, Palo Alto, Symantec as "software / instant messaging." Never CNAME it to anything.

### P0.6 [HUMAN, optional] canary domain-divorce experiment
Throwaway subdomain (`jointest.tlon.io`): register as a Branch link domain, mint test links, repoint DNS to our service (self-serve AASA), re-test link resolution weekly. Measures whether Branch disables domains whose DNS leaves — informs how long `join.tlon.io`-URL clipboard payloads keep resolving. (`app.link` payload makes failure non-fatal.)

---

## Phase 1 — DNS cutover + delisting (no code)

### P1.1 [HUMAN] preconditions (gate A)
P0.1 deployed + smoke-tested on staging · T1(a) done, payload config set from any T1/T2 results so far · P0.3 telemetry **and P0.4 token parser** live in production via OTA · installed-app smoke passes (P0.4 acceptance) · AASA/assetlinks verified against the production service (temp host header) · `join.tlon.io` TTL lowered to 300s a day ahead.

### P1.2 [HUMAN] flip
Repoint `join.tlon.io` CNAME `custom.bnc.lt` → Vercel. Immediately verify: AASA fetch · old single-segment link · legacy `~ship/name` link · `dm-` page · desktop redirect · iOS clipboard write on CTA · Android referrer present in Play URL.
**Rollback:** repoint the CNAME back. (Branch dashboard domain config stays untouched until P3 precisely so rollback and pasteboard resolution keep working.)

Note on mechanism: installed-app link opens keep resolving through the Branch SDK after the flip — Branch matches the URL string against its dashboard config and link records, not DNS. P0.4 exists as the hedge against their *unverified* domain-revalidation behavior, not because resolution breaks on flip day.

### P1.3 [HUMAN] delisting (start same week)
1. **AdGuardTeam/cname-trackers** (upstream): issue/PR with `dig join.tlon.io CNAME` before/after — domain no longer resolves through Branch; request removal from `data/clickthroughs/branch_io.{json,txt}` and the combined justdomains output.
2. **easylist/easylist**: reference the upstream removal and PR #23244 ("the concern raised there is now resolved; CNAME removed"); request deletion of the disabled `! ||join.tlon.io^` line in `easyprivacy/easyprivacy_specific_cname_branch.txt`.
3. Derived DNS lists regenerate on their own; calendar 30/60/90-day checks of each list (feeds gate C).

**Monitoring from flip day**: `Invite Page View → cta_clicked` conversion by platform · `Detected Branch Link Click` matchGuaranteed/isFirstSession mix · manual-paste share of attributed signups (expected to fall as delisting propagates).

---

## Phase 2 — client release (JS via OTA; native parts ride next binary)

### P2.1 [CODEX] deferred-source cascade module (shadow mode) — OTA
New module `packages/app/lib/deferredInvite.ts` (or `packages/shared` if store access needed) implementing cascade 1.1 **without taking lure ownership**:

- `getUniversalLinkInvite()`: promotes P0.4's expo-linking intake into the cascade as step 1 (same shared handler).
- `getInstallReferrerInvite()`: Android + first run → `Application.getInstallReferrerAsync()` (`expo-application`, already shipped) → parse `REFERRER_PAYLOAD` format *plus* raw-token and URL fallbacks.
- `getClipboardInvite()`: first run → `Clipboard.hasUrlAsync()` gate → `getUrlAsync()` → shared parser. Triggers the standard iOS paste prompt (same as Branch today). **Sequencing rule:** only read clipboard first-party after the Branch callback has produced nothing (avoid double paste prompts).
- Shared parser per 1.1 (both domains + `app.link`; `dm-` → `wer` path).
- **First-run detection**: own storage flag, not literal launch #1 — fresh installs run the embedded bundle on first launch (no launch wait in the updates config), so an OTA'd cascade may first execute on launch 2–3. Still attempt recovery then (referrer persists; clipboard usually survives) and tag late recoveries distinctly.
- **Shadow behavior**: deterministic sources may set the lure only when `branch.subscribe` produced nothing after a short grace window; matcher is log-only (P2.3).
- Emit `Deferred Invite Recovery {source, token, branchAgreed: same|only_ours|only_branch|neither}`.

**Acceptance**: unit tests for every parser input shape; event flowing with agreement fields.

### P2.2 [CODEX] matcher (log-only)
- **App**: on first launch when universal link + referrer + Branch all missed → `POST ${INVITE_SERVICE_ENDPOINT}/deferred-match` with `{device_class, os_major}` (server derives IP) → log `{source: 'ip_match_shadow', …}`. Do not set lure.
- **Contract (frozen by the P0.1 implementation)**: `device_class` must use the page's vocabulary — `iphone | ipad | android_phone | android_tablet`; `os_major` is a string. Response is 200 with `{token, confidence, clickedAt, matchedAfterMs}` on a unique hit, or 200 with an **empty body** on miss/ambiguity — treat empty as null.
- **serverless-infra**: `api/deferredMatch.ts` — normalize + HMAC caller IP (same IPv4-exact / IPv6-/64 rule as the click log), KV lookup, return unique in-window hit `{token, confidence}` or null; **refuse on multiple candidates**; delete-on-read; per-IP rate limiting; log `matched_at − clicked_at` gap (tunes TTL). Expect low match rates on cellular (CGNAT → ambiguity refusals) — correct behavior, not a bug.

### P2.3 [CODEX] flip groundwork — binary
- `app.config.ts`: `associatedDomains += 'applinks:invite.tlon.io'`; Android autoVerify intent filter for `invite.tlon.io` (extend the same mechanism that produces the existing `join.tlon.io` filter — verify manifest vs config plugin).
- Dual-domain regexes: `createInviteLinkRegex` (`deeplinks.ts:162`) and `DEEPLINK_REGEX` (`MessageInput/index.tsx:444`) accept `(join|invite).tlon.io`.
- Env: keep `BRANCH_DOMAIN` name for now; add `INVITE_DOMAINS = ['join.tlon.io','invite.tlon.io']` consumed by parsers.
- Copy sweep: `PasteInviteLinkScreen.tsx:170` placeholder.

### P2.4 [CODEX, optional] no-prompt paste affordance
Welcome/PasteInviteLink screens: `Clipboard.hasUrlAsync()` (no prompt) → render `ClipboardPasteButton` (expo-clipboard, iOS 16+, no permission alert) → shared parser → `setLure`. Source `paste_button`.

### P2.5 [CODEX] tests
Parser unit tests (all shapes, both referrer formats, clipboard formats) · `apps/tlon-web/e2e/invite-service.spec.ts:53` accepts either domain.

**Phase 2 done when**: `Deferred Invite Recovery` agreement data flowing · deterministic parity confirmed · no regression in attribution rate.

---

## Phase 2.5 — optional mint-domain flip (config-level; gate C)

Prereqs: gate C + P2.3 binary dominant (old binaries lose deferred on new-domain links; Phase-2 builds recover via fallback clipboard read).

- [CODEX · serverless-infra] mint-domain config → `invite.tlon.io` (both domains keep resolving; `join.tlon.io` handler stays forever).
- [CODEX · desk] `widgets.hoon:44` dm-link base URL → `invite.tlon.io`. (`branch-update.hoon` untouched — deleted in P3.)
- [CODEX] cosmetic strings: `SplashSequence.tsx:2684`, fixture, `.maestro/03-signup.yaml`.

---

## Phase 3 — SDK removal + decommission

### P3.1 [CODEX · gate B] client — binary release
- Remove `react-native-branch`: `apps/tlon-mobile/package.json`, config plugin/keys in `app.config.ts`, `checkPasteboardOnInstall` call in iOS AppDelegate, `branch_*` keys near `Info.plist:107`, Android manifest-merger inputs, `BRANCH_KEY_*` env plumbing. **Keep** `applinks:` entitlements and App Links intent filters.
- Rewrite `packages/app/contexts/branch.tsx` → `DeepLinkProvider`, preserving the exported surface: `useBranch`, `useSignupParams`, `useLureMetadata`, `setLure`/`clearLure`/`clearDeepLink`, `deepLinkPath`. Consumers to verify (grep `useBranch|useSignupParams|useLureMetadata`): `useDeepLinkListener.ts`, `signupContext.tsx`, `useHandleLogout.ts`, `CheckOTPScreen`, `WelcomeScreen`, `PasteInviteLinkScreen`. Internals = cascade 1.1 with clipboard now first-party (read once per install, `hasUrlAsync`-gated).
- Promote matcher: a unique `/deferred-match` hit sets the lure exactly like any other source (parity with current Branch probabilistic behavior — no new UX). Keep `source: 'ip_match'` tagging for analytics.
- Delete dead code: `getDmLink` (`packages/api/src/client/branch.ts:156` — stubbed, always returns `''`) and `useBranchLink` (`packages/app/hooks/useBranchLink.ts`, consumed by both Settings screens). Note for the team: this share-DM-link path is already a silent no-op in production — decide whether to remove the UI or implement it first-party.
- Drop shadow/agreement instrumentation; keep source tagging. Keep emitting `Installed with Deferred Deeplink Invite` for deterministic first-install recoveries (metric continuity).

### P3.2 [CODEX · gate B′] serverless + desk (code can merge early behind `MINT_MODE`; the switch is what's gated)
- `api/inviteLink.ts`: replace `Branch.upsertInviteLink` with `https://<MINT_DOMAIN>/${inviteId}`; keep validation + `InviteLinkCreated` event.
- `api/checkLink.ts`: reimplement as bait metadata existence check (200 iff `GET /lure/<token>/metadata` resolves).
- Delete `lib/branchApi.ts`, `api/branchClicks.ts`. [HUMAN] remove the webhook config in the Branch dashboard.
- landscape-apps: delete api2 helpers in `packages/api/src/client/branch.ts` (`fetchBranchApi`, `getDeepLink`, `getBranchLinkMeta`, `getDmLink`) and the enrichment fallback `deeplinks.ts:132–150`; keep types + `extractLureMetadata`. `createDeepLink`/`getLinkFromInviteService` work unchanged.
- Delete `desk/ted/branch-update.hoon`; confirm `widgets.hoon` dm-links render as plain invite URLs.
- Secrets: remove `BRANCH_KEY_*`/`VITE_BRANCH_*` from the four workflows; drop `BRANCH_DOMAIN` env (fold into `INVITE_DOMAINS`); serverless Vercel env `BRANCH_*`/`TEST_BRANCH_*` → `MINT_DOMAIN`; remove `VITE_BRANCH_*` typings from `apps/tlon-web/src/env.d.ts` (web has no other Branch surface — inbound web attribution is `?inviteToken`).

### P3.3 [HUMAN · gate B′] decommission
Branch account → read-only until pre-P2 binaries negligible, then close. **DNS hygiene audit**: enumerate every Branch-pointing record in `tlon.io`/`tlon.network` zones (including email click-tracking CNAMEs) — repoint or delete, never dangle (subdomain-takeover risk).

### P3.4 [CODEX] cleanup pass
Per CLAUDE.md pre-PR rules: no transitional shims for branch-only states, no stale Branch-param comments, no dead code.

---

## Monitoring reference (PostHog)

- **Live grouped view**: saved insight [4G2SLfbF](https://eu.posthog.com/project/7233/insights/4G2SLfbF) — attribution by recovery path, rolling 90d, self-updating through the migration.
- **Alert (set before P1.2)**: PostHog alert on the attributed-signup rate so a cutover regression notifies someone instead of waiting for a dashboard glance.
- **Gate B metric**: `Deferred Invite Recovery` — distribution of `branchAgreed`; gate clears at `only_branch = 0` across ≥30 first-open deferred recoveries or 4 weeks.
- **Exact probabilistic share** (post-P0.3): `Detected Branch Link Click` where `isFirstSession AND NOT matchGuaranteed` (distinct persons; intersect with attributed `Account Created` for converted users).
- **Attribution rate**: `Onboarding Action · actionName='Account Created'` — share with `lure ∉ {null, '~nibset-napwyn/tlon'}`, by `$os`.
- **Page funnel**: `Invite Page View` → `Invite Page CTA Click` (join on `pageViewId`) → install-side recovery, by platform.
- **Delisting propagation** (gate C input): manual-paste share trend + 30/60/90-day list checks.

## Config parameters

| Parameter | Set by | Default until then |
|---|---|---|
| `CLIPBOARD_PAYLOAD` | T1 | plain `https://join.tlon.io/<token>`; if T1 selects the `app.link` form, revert to canonical URL at gate B′ |
| `REFERRER_PAYLOAD` | T2 | raw token (if T2 fails, old-binary Android *first-open* deferred stays degraded until the P2.3 binary is in stores — OTA cannot reach a fresh install's first launch; monitor) |
| `app.link` default subdomain | Branch dashboard | n/a |
| matcher TTL / window | KV gap data | 4h |
| `SERVED_DOMAINS` | fixed | `['join.tlon.io', 'invite.tlon.io']` |
| `MINT_MODE` / `MINT_DOMAIN` | gate B′ (or gate C for domain) | `branch` / `join.tlon.io` |
