# 04 — Sandbox egress and navigation: is the posture still what we claim?

Read-only audit. Nothing was changed. Evidence includes a live run of
`pnpm e2e:sandbox` (chromium, 53/53 passing, 1.8m) and `pnpm exec vitest run`
in `packages/surface-shell` (103/103 passing).

---

## Verdict

The **navigation** half of the posture is in much better shape than the spike
documents describe — F1 was not merely acknowledged, it was closed to the
extent the web platform allows: option D was verified, `frame-src` was adopted
(D43), and `ENFORCE_HOST_CSP` is now `true`, which I confirmed end-to-end by
running the matrix (all five probed vectors BLOCKED-PREFLIGHT under the shipped
policy, zero attacker-server hits). The **egress** half has quietly become the
weaker one, and it is weak in exactly the way F1 was: `sandbox.spec.ts` — the
only test that claims `fetch`/XHR/WebSocket/beacons are blocked — fires every
probe at `beacon.invalid`, an RFC-6761 reserved TLD that can never resolve. Each
probe records `'blocked'` from a `catch`/`onerror` branch that a DNS failure
produces identically, and the network-level backstop (`no request to
beacon.invalid ever succeeded`) is satisfied by DNS failure too. **If
`SURFACE_SANDBOX_CSP` stopped working tomorrow, that test would still pass.**
The project already knows this methodology is invalid — `navigation.spec.ts`
names `sandbox.spec.ts` by name as the anti-pattern it was written to avoid, and
D43 calls the real-attacker-server method "the standard for future leak tests" —
but the fix was applied only to the navigation probes and never back-ported to
the egress ones. Add to that: one named, reproduced vector (the Navigation API)
that the matrix does not probe, no native leak test at all, and the entire
posture suite running nowhere in CI.

---

## What the spike documents claimed

`surface-channels-f1-navigation-escape.md` is **a 309-byte truncated stub**. It
ends mid-word ("The web sandbox host runs unt"), is untracked in git, and has no
history to recover from. It is not a second document; it is an aborted write of
the same F1 write-up. Everything below comes from
`surface-channels-f1-sandbox-egress.md`, which is complete.

**Found NOT containable (web):**

- Self-navigation. `location.replace(url)` performs egress — the URL is the
  payload — and the response then runs _unpinned_ code in a script-enabled frame
  with no injected meta CSP, which can then use ordinary network APIs freely.
- No `sandbox` token covers self-navigation; CSP `default-src` governs fetches,
  not navigation; `navigate-to` was dropped from CSP3.
- In-realm freezing of `location` is not a boundary — shell and bundle share one
  realm, and `document.write` meta-refresh and synthetic anchor clicks bypass JS
  accessors entirely.
- The probe set of the day was `fetch`/`xhr`/`websocket`/`imageBeacon`/
  `sendBeacon`/`topAccess`/`storage`, and "the gap was invisible because the
  missing probe made it invisible."

**Found containable:** no same-origin access (opaque origin), no top navigation,
popups, downloads or forms, no host capability beyond the bridge.

**Documented mitigations / non-negotiables:** correct D36 and the session-4
report; add navigation probes asserting _true_ behavior; extend the publish-gate
lint to navigation; amend plan §5; and run the option-D `frame-src` experiment.

**All five non-negotiables were done.** D36 carries an in-place "AMENDED
(session 4.5, correction of record)" block; plan §5 now states the honest claim
including "navigation egress on web is not prevented today"; the lint grew a
separate `navigation-vector` rule; and D43/D44/D96/D97 record the `frame-src`
experiment, its delivery constraints, and the flip to enforcing.

---

## Vector coverage

"Fails if containment broke?" is the question that matters: would the test go
red if the mechanism it names silently stopped working?

| Vector                                                | Probed?    | Where                                                                                                    | Fails if containment broke?                                                                                                                                                                                                   |
| ----------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fetch`                                               | yes        | `sandbox.spec.ts:53`                                                                                     | **No.** Target is `beacon.invalid`; `'blocked'` is the `.catch` branch, which DNS failure also takes                                                                                                                          |
| `XMLHttpRequest`                                      | yes        | `sandbox.spec.ts:59`                                                                                     | **No.** Same confound (`onerror`)                                                                                                                                                                                             |
| `WebSocket`                                           | yes        | `sandbox.spec.ts:70`                                                                                     | **No.** Same confound (`onerror`)                                                                                                                                                                                             |
| image beacon                                          | yes        | `sandbox.spec.ts:79`                                                                                     | **No.** Same confound (`img.onerror`)                                                                                                                                                                                         |
| `sendBeacon`                                          | yes        | `sandbox.spec.ts:92`                                                                                     | **No.** Return value explicitly disclaimed; the network backstop it defers to is itself DNS-confounded                                                                                                                        |
| network-level backstop (`no beacon.invalid response`) | yes        | `sandbox.spec.ts:224`                                                                                    | **No.** An unresolvable host produces zero responses regardless of CSP                                                                                                                                                        |
| `window.top` access                                   | yes        | `sandbox.spec.ts:102`                                                                                    | **Uncertain** — see gap 6. Real probe, but the test host is `about:blank`                                                                                                                                                     |
| `localStorage`                                        | yes        | `sandbox.spec.ts:109`                                                                                    | **Uncertain** — same reason                                                                                                                                                                                                   |
| `location.replace` (bare)                             | yes        | `navigation.spec.ts` `nav-replace`                                                                       | **Yes.** Asserted BLOCKED-PREFLIGHT in _every_ config incl. attacker-allowlisted — the uniformity is what attributes it to the shim, not the policy                                                                           |
| `location.href =` (bare)                              | yes        | `navigation.spec.ts` `nav-href`                                                                          | **Yes.** Same design                                                                                                                                                                                                          |
| `window.location.replace` (member)                    | yes        | `navigation.spec.ts` `nav-window-location`                                                               | **Yes.** Strongest probe in the repo: real attacker HTTP server, `probe-armed` liveness signal, positive control (A/no-csp → NOT-BLOCKED, 1 server hit, committed) and mechanism control (attacker-allowlisted → NOT-BLOCKED) |
| anchor click `target="_self"`                         | yes        | `navigation.spec.ts` `nav-anchor`                                                                        | **Yes.** Same design                                                                                                                                                                                                          |
| `document.write` meta-refresh                         | yes        | `navigation.spec.ts` `nav-meta`                                                                          | **Yes.** Same design                                                                                                                                                                                                          |
| **Navigation API** (`window.navigation.navigate()`)   | **NO**     | —                                                                                                        | **N/A — not probed.** Named in plan §5, D93 and `surface-lint.ts:842`; reproduced reaching the attacker origin in Chromium                                                                                                    |
| `window.open`                                         | partly     | `document.test.ts:61` (unit)                                                                             | Unit-asserts the guard replaces it. Never browser-probed; `allow-popups` is withheld anyway                                                                                                                                   |
| form submission                                       | no         | —                                                                                                        | Relies on withheld `allow-forms`; asserted nowhere                                                                                                                                                                            |
| top navigation                                        | no         | —                                                                                                        | Relies on withheld `allow-top-navigation`; asserted nowhere                                                                                                                                                                   |
| `data:` / `blob:` navigation targets                  | **NO**     | —                                                                                                        | D43 records this as untested                                                                                                                                                                                                  |
| redirect chain: allowlisted origin → attacker         | **NO**     | —                                                                                                        | D43 records this as a "known-untested residual"; any non-empty allowlist reintroduces the hop                                                                                                                                 |
| `SURFACE_SANDBOX_CSP` string                          | yes        | `packages/tlon-skill/scripts/surface-preview.test.ts:138`                                                | **Yes**, for a _string_ change (hardcoded literal, runs in CI). Not a behavioral test                                                                                                                                         |
| `SURFACE_SANDBOX_IFRAME_FLAGS` value                  | indirectly | `surface-preview.test.ts` asserts `not.toContain('allow-same-origin')` on the **preview host page** only | Partial — the constant itself is pinned nowhere                                                                                                                                                                               |
| shell asset delivery reaches only bundled assets      | **NO**     | —                                                                                                        | Property holds today; nothing asserts it (gap 7)                                                                                                                                                                              |
| **native (iOS/Android) egress**                       | **NO**     | —                                                                                                        | No test of any kind exists (gap 4)                                                                                                                                                                                            |

---

## Gaps, ranked

### 1. The egress leak test cannot fail — `sandbox.spec.ts` (highest)

`apps/tlon-web/sandbox-posture/sandbox.spec.ts:45-126`. All five network probes
target `https://beacon.invalid/…`. `.invalid` is IETF-reserved and guaranteed
never to resolve — a fact this repo states in its own words elsewhere
(`apps/tlon-web/e2e/host-csp.spec.ts:41`: "`.invalid` is reserved (RFC 6761) and
cannot resolve, so nothing leaves the machine either way"). Every probe's
"blocked" verdict is a failure branch shared with DNS failure, and the
network-level assertion at line 224 is satisfied for the same reason. This is
the guard-that-cannot-fail pattern, sitting under the _only_ remaining
unqualified claim in the posture ("resource-fetch egress blocked").

What makes this a live finding rather than a stylistic one: the project already
solved it next door. `navigation.spec.ts:49-53` says, of this exact file — "An
unresolvable `.invalid` host (what sandbox.spec.ts uses for the fetch probes)
cannot separate 'CSP blocked it' from 'DNS failed', and that ambiguity is
precisely what this experiment must avoid" — and D43 elevates the real-server
method to "the standard for future leak tests." The attacker-server harness,
the `probe-armed` liveness signal and the allowlist-the-attacker control all
exist, 400 lines away, and were never applied to the egress probes.

Partial mitigation, worth stating: the CSP _string_ is pinned by a hardcoded
literal in `surface-preview.test.ts:138`, which does run in CI, so a silent
edit or removal of the meta tag would be caught. What is uncovered is every
_behavioral_ break — an engine change, the meta being ignored in some delivery,
or a policy that parses but no longer denies.

### 2. The Navigation API is a named, reproduced vector the matrix does not probe

`NAV_PROBES` (`navigation.spec.ts:179-207`) contains five entries; none touches
`window.navigation`. Meanwhile `surface-lint.ts:838-845` records that the
Navigation API "is modeled here only because an audit found it unmodeled — and
found the sandbox-posture matrix does not probe it either — after a bundle
calling `window.navigation.navigate()` from a click handler passed this gate
clean **while the request left the frame in Chromium**." D93 repeats it and
explicitly defers it: "a follow-up for that suite rather than for this file."
Plan §5 names it too.

`frame-src` very likely does block it — the directive is evaluated on the
navigation request irrespective of the initiating API — but "very likely" is
what D36's own standing rule forbids: _"a passing posture test may only be
cited for the vectors it probes, and claims cite probe lists, not suite
names."_ Under that rule the shipped-policy row (`C/meta/shipped-policy`)
currently licenses a claim about five spellings, not about self-navigation as a
class. Cheap to close: one more entry in `NAV_PROBES`.

### 3. The entire posture suite runs nowhere in CI

`e2e:sandbox`, `playwright.sandbox.config.ts` and `SANDBOX_ENGINES` appear
**zero times** anywhere under `.github/`. The 53 tests that constitute all
behavioral containment evidence run only when a human runs them, and only on
chromium unless `SANDBOX_ENGINES=all` is passed. `packages/surface-shell`'s
`check:all` (determinism, import boundary, styles, tokens) is likewise absent
from CI — including `check:determinism`, which is what enforces "no dynamic
`import()` in the artifact." What does run per-PR is `pnpm test:ci` (vitest,
which covers `document.test.ts` and `hostCsp.test.ts`) and the tlon-skill bun
tests (which cover the CSP string pin), plus `e2e/host-csp.spec.ts` in the e2e
shards. So regression protection is string pins, not behavior. This gap
multiplies gaps 1 and 2 rather than standing alone.

### 4. Native has neither the promised mechanism nor any leak test

Plan §5 promises "iOS: WKWebView + WKContentRuleList deny-all. Android: WebView
with `shouldInterceptRequest` deny-all," and M0's exit criterion (1) requires
"Egress posture on **all three platforms** with a leak test each." Neither
mechanism exists: `WKContentRuleList` and `shouldInterceptRequest` appear
nowhere in the repo outside comments. `SurfaceSandboxHost.native.tsx:82-115`
ships `originWhitelist={['about:blank']}` plus an
`onShouldStartLoadWithRequest` that admits only `about:blank` and
`data:text/html` — which, as its own comment says, "only vetoes NAVIGATIONS,
not subresource requests." The document's meta CSP is the sole resource-level
gate. There is **no automated test of native egress or navigation anywhere** —
not Jest, not Maestro, not vitest; `SurfaceSandboxHost.test.tsx` resolves to the
_web_ host under jsdom. To its credit the file self-labels "WRITTEN BUT
UNVERIFIED… Do not treat this file as providing enforced egress blocking." The
finding is that M0's exit criterion is unmet for two of three platforms, and
that this is visible only inside a source comment.

### 5. Three artifacts say `frame-src` is disabled; it is enforcing

`ENFORCE_HOST_CSP = true` (`apps/tlon-web/hostCsp.ts`), recorded in D96/D97 and
confirmed by my run. But `surface-lint.ts:869-871` still says "(D43; ships
written-but-disabled behind D44's flip criteria)", D93 says "(D43, written and
disabled)", and plan §5 line 206 says "the enforcing policy ships
written-but-disabled behind a one-line flag." The drift is in the safe
direction — the docs understate the protection — but it is the same defect
class as original-F1 (an artifact that no longer describes the mechanism), and
it misleads in a decision-relevant way: a reader weighing whether `frame-src`
can be relied on reads "disabled." My native subagent read the stale comment and
reported the boundary as inactive, which is a live demonstration of the cost.

### 6. `sandbox.spec.ts`'s escape probes may share the same confound (unconfirmed)

`topAccess` and `storage` are genuine probes of the _sandbox flags_ rather than
the CSP, and would be my two "confident" probes in that file — except that
`mountSandbox` uses `page.setContent`, leaving the host page on `about:blank`
with an opaque origin. If `allow-same-origin` were ever added to
`SURFACE_SANDBOX_IFRAME_FLAGS`, the child would inherit the _parent's_ origin —
here an opaque one — and both probes would, on my reading of origin semantics,
still throw and still report `'blocked'`, while in production (a real ship
origin) the same change would hand the bundle cookies, `localStorage` and the
host DOM. I did **not** measure this and I am not asserting it; see "could not
determine." `navigation.spec.ts` does not have the problem — it serves a real
host page from `127.0.0.1`. The fix, if confirmed, is the same as gap 1: move
these probes onto that harness.

### 7. "Only shell-bundled assets" holds, but nothing asserts it

Plan §5 requires that the mechanism delivering the shell's JS/CSS/fonts into the
sandbox reach only shell-bundled assets. It does, today, and I verified it three
ways: the shell CSS has no `url(`, no `@import` and no `@font-face` (source or
built); the built JS contains only XML-namespace URIs (`w3.org/2000/svg` and
friends), which are identifiers, not fetches; and the delivery path is
build-time embedding via `emit-artifact-module.mjs` → `artifactStrings.js`
(JSON-stringified) → `SurfaceSandboxContainer.tsx:5-9` → `buildSandboxDocument`,
with no runtime fetch anywhere.

But the guarantee is a comment, not an assertion: "The embedded artifact is the
ONLY shell delivery path — never fetched at runtime"
(`emit-artifact-module.mjs:5`). `check-styles.mjs` checks colors and
font-families, not `url(`. `check-deterministic-build.mjs` checks for zod,
`process.env`, dynamic `import(` and presence markers, not external references.
The one real assertion in this family is narrow and component-local:
`sigil.test.tsx:41-43` requires no `<image`, `src`, `href` or `xlink:href` in
sigil output. A vendored dependency or a token change that introduced
`@font-face { src: url(https://…) }` would ship unremarked. Consequence today is
mild (`default-src 'none'` makes it a dead reference and a visual regression,
not a leak) — but it is a per-viewer beacon the moment anything relaxes that
CSP, and it is precisely the class of thing the plan asked to be asserted.

### 8. Residuals D43 named and nobody has measured

`data:`/`blob:` navigation targets, and redirect chains from an allowlisted
origin to an attacker origin. D43 flags the redirect case as something that
"must be measured before anyone calls the hole closed," and `hostCsp.ts` repeats
it for `https://tlon.network` specifically: a source matches an origin and
nothing below it, so a redirect from `/account` to a subdomain would break
account management silently — and the inverse, a redirect _out_ to an
attacker, is the security-relevant half. Still unmeasured.

---

## Self-navigation: current status

**Materially better than the F1 document describes, and materially better than
three current artifacts describe.** Measured by me today, chromium,
`pnpm e2e:sandbox`:

- `A/no-csp` (what F1 documented): `nav-window-location`, `nav-anchor` and
  `nav-meta` all NOT-BLOCKED — `attackerServerHits=1`, `committed=true`, frame
  now showing the attacker's document. F1's finding reproduces exactly.
- `C/meta/shipped-policy` (what actually ships, `frame-src 'self'
https://tlon.network`, delivered by the `<meta>` the build injects): all five
  probes BLOCKED-PREFLIGHT, `attackerServerHits=0`, and the srcdoc sandbox frame
  still loads. Nothing left the device.
- The mechanism controls hold: allowlisting the attacker under the same delivery
  returns the three policy-governed vectors to NOT-BLOCKED, which is what makes
  the blocking attributable to `frame-src` source matching rather than to the
  page merely carrying a policy.

So on web, for the five probed spellings, self-navigation is contained
pre-flight in production. Three qualifications:

1. **It is a host-page policy, not a property of the sandbox.** D43 says this
   plainly: `frame-src` "depends on a host-page policy that a future deployment
   change could drop silently." With the posture suite outside CI (gap 3),
   "silently" is accurate.
2. **Five spellings, not the vector class** (gap 2), and enforcement failures
   are invisible in production — `report-uri` is unavailable in `<meta>`, so the
   only surviving signal is `SecurityPolicyViolationEvent` via
   `hostCspViolations.ts`, which routes through PostHog and therefore reports
   nothing at all for a telemetry-opted-out user. `hostCsp.ts` says so itself.
3. **Native is unchanged and unverified** (gap 4).

**The M4 conclusion is unaltered.** Nothing found here retires the Worker-realm
migration, and D43 anticipated exactly why: `frame-src` restricts _where_ a
frame may navigate, not _whether_ unpinned code can run in it. Plan §5 and D36
still gate shared-group trust on the Worker realm — "another member's bot's code
runs on your device" — and that migration remains unbuilt. If anything the case
firmed up: gap 2 is a fresh instance of the open-capability-set argument (the
platform shipped a new navigation API and both the lint and the matrix were
behind it), which is the structural reason a list can never be the boundary.

---

## What I could not determine, and what I would have needed

- **Whether gap 6 is real.** Whether `allow-same-origin` added to the flags
  would actually go undetected by `sandbox.spec.ts`'s `topAccess`/`storage`
  probes turns on opaque-origin inheritance for a srcdoc child of an
  `about:blank` parent. I reasoned it, I did not measure it, and I was scoped
  read-only. Needed: a throwaway spec on `navigation.spec.ts`'s real-host
  harness, flags flipped, ~10 minutes. I deliberately did not write it — a
  reasoned claim labeled as such is better than an unlabeled one, which is the
  whole subject of this audit.
- **Whether `frame-src` blocks the Navigation API.** Same constraint. Needed:
  one entry in `NAV_PROBES` and a rerun. I expect BLOCKED-PREFLIGHT; I am not
  asserting it.
- **The `data:`/`blob:` and redirect-chain residuals.** The redirect case needs
  a second local server issuing a 302 from an allowlisted origin to the
  attacker; the harness supports it, but writing it was out of scope.
- **Firefox and WebKit today.** I ran chromium only (the default). D96 records
  159/159 across all three engines; I did not re-verify. Needed:
  `SANDBOX_ENGINES=all` plus `npx playwright install firefox webkit`.
- **Whether the truncated `surface-channels-f1-navigation-escape.md` ever had
  more content.** It is untracked, so there is no git history and no recovery
  path. If it was meant to hold findings distinct from
  `-f1-sandbox-egress.md`, those findings are gone and I cannot say what they
  were.
- **Anything about the shipped native binaries.** I did not build or run
  iOS/Android, and per the constraints I touched no ship, container or dev
  server. The native conclusion rests on source reading and the absence of test
  files.

### Note on repo state

The working tree was not clean when I started, contrary to the session's
opening snapshot: `packages/tlon-skill/skills/surfaces/PARADIGM.md` and
`SKILL.md` carry uncommitted edits (a state-size limit changed 64 KB → 128 KB,
plus SKILL.md wording). **These are not mine — I made no writes outside this
file.** Flagging them so they are not later mistaken for audit side-effects.
