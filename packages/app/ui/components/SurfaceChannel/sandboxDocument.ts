/**
 * Sandbox document assembly (plan §5): the host owns the whole document —
 * the CSP arrives via a host-injected meta tag (a srcdoc/`source={{html}}`
 * document has no headers of its own to trust), the shell loads first
 * (D31), and the bundle is a plain script after it. Pure and
 * dependency-free so the browser-level sandbox-posture test can import it
 * directly.
 */

/**
 * `default-src 'none'` shape: every fetch/XHR/WebSocket/image/font/media/
 * frame request is denied; only the inline script and style the host
 * itself injects may run. No network can originate inside the sandbox.
 */
export const SURFACE_SANDBOX_CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'";

/**
 * Iframe sandbox flags: scripts only. No allow-same-origin (the document
 * gets an opaque origin), no forms, no popups, no downloads, no modals,
 * no top-navigation.
 */
export const SURFACE_SANDBOX_IFRAME_FLAGS = 'allow-scripts';

/**
 * A `</script` inside either source would terminate the wrapping script
 * element and let document text escape into markup. Inside JS strings
 * `<\/` is identical to `</`, so this rewrite is semantics-preserving for
 * the embedded code while making the sequence inert in HTML.
 */
export function escapeInlineScript(source: string): string {
  return source.replace(/<\/script/gi, '<\\/script');
}

/**
 * ============================================================
 * IN-REALM SELF-NAVIGATION HARDENING — BAR-RAISING, NOT A BOUNDARY
 * ============================================================
 *
 * The shell and the bundle share ONE JavaScript realm. Anything the host
 * injects into that realm is, from the bundle's point of view, just
 * another mutable global it can read, compare against a pristine copy,
 * or reach around. Two independent reasons this can never be containment:
 *
 * 1. `location` cannot be taken away, at all. Every member of the
 *    `Location` interface is `[LegacyUnforgeable]` — `replace`, `assign`
 *    and `href` are OWN, non-configurable properties of the `location`
 *    instance, and `Location.prototype` carries none of them. Measured
 *    identically on chromium/firefox/webkit inside this exact sandbox:
 *    `Object.getOwnPropertyDescriptor(Location.prototype, 'replace')` is
 *    `undefined`; the own `replace`/`assign` are
 *    `{writable:false, configurable:false}` and
 *    `Object.defineProperty` on them THROWS; `location.replace = fn`
 *    silently fails; `delete location.replace` returns false; and
 *    `window.location` is itself a non-configurable accessor, so the
 *    object cannot be swapped either. Freezing or replacing the real
 *    accessors is therefore impossible in-realm — a "freeze the Location
 *    prototype" patch would be dead code that reads like protection.
 *
 *    The only in-realm lever the platform leaves is LEXICAL SHADOWING of
 *    the bare `location` identifier inside the bundle's own function
 *    scope (`wrapBundleSource` below). A bundle walks around it in one
 *    property access — `window.location`, `self.location`,
 *    `globalThis.location`, `document.location`, `frames.location` — so
 *    it stops naive and reused-off-the-shelf exfil code and nothing more.
 *    (`window.open` is the opposite case: it IS writable, so the guard
 *    below replaces it globally and no shadowing is needed.)
 *
 * 2. Whole vectors never touch a patchable accessor in the first place.
 *    `document.write('<meta http-equiv="refresh" content="0;url=…">')`
 *    navigates through the parser, and a synthetic `<a target="_self">`
 *    click navigates through the click machinery. Neither reads
 *    `location`, so no amount of JS patching sees them coming.
 *
 * The post-mitigation matrix — exactly which vectors this stops and which
 * walk straight past it — is measured and asserted in
 * `apps/tlon-web/sandbox-posture/navigation.spec.ts`. Actual containment
 * against self-navigation comes from the host page's `frame-src`
 * allowlist (D43) and, structurally, from the Worker-realm migration
 * (M4). Nothing in this file is a substitute for either.
 */

/**
 * Runs before the shell and the bundle.
 *
 * `window.open` is the one navigation-adjacent global the platform lets
 * us actually replace (measured writable + configurable on all three
 * engines). It is also already inert here — `allow-popups` is withheld,
 * so the sandbox refuses the call regardless — so this removes a probe
 * point rather than closing a hole.
 */
export const SURFACE_SANDBOX_NAV_GUARD_JS = `
(function () {
  try {
    window.open = function () { return null; };
  } catch (e) {}
})();
`;

/**
 * A stand-in handed to the bundle in place of the real `location`. Reads
 * report nothing (the frame's real URL is \`about:srcdoc\` under an opaque
 * origin, so there is nothing to report) and every navigating member is a
 * no-op. It exists only to make the bare-identifier forms inert; see the
 * header comment for why that is bar-raising and not containment.
 */
const NEUTERED_LOCATION_JS = `Object.freeze({
    assign: function () {},
    replace: function () {},
    reload: function () {},
    toString: function () { return ''; },
    get href() { return ''; },
    set href(value) {},
    origin: '', protocol: '', host: '', hostname: '', port: '',
    pathname: '', search: '', hash: ''
  })`;

/**
 * Wraps the bundle in a function whose parameter shadows `location`.
 * `.call(this, …)` keeps top-level `this` pointing at the global exactly
 * as an unwrapped classic script would, so the only semantic change is
 * that bundle-level `var`/function declarations become local to the
 * bundle instead of properties of the global object — which the
 * single-script bundle convention (D31) already assumes.
 */
export function wrapBundleSource(bundleSource: string): string {
  return [
    ';(function (location) {',
    bundleSource,
    `}).call(this, ${NEUTERED_LOCATION_JS});`,
  ].join('\n');
}

export function buildSandboxDocument(options: {
  shellJs: string;
  shellCss: string;
  bundleSource: string;
}): string {
  return [
    '<!doctype html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8" />',
    `<meta http-equiv="Content-Security-Policy" content="${SURFACE_SANDBOX_CSP}" />`,
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<style>${options.shellCss}</style>`,
    '</head>',
    '<body>',
    `<script>${escapeInlineScript(SURFACE_SANDBOX_NAV_GUARD_JS)}</script>`,
    `<script>${escapeInlineScript(options.shellJs)}</script>`,
    `<script>${escapeInlineScript(wrapBundleSource(options.bundleSource))}</script>`,
    '</body>',
    '</html>',
  ].join('\n');
}
